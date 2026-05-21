import { execFile } from 'child_process';
import { lookup } from 'dns/promises';
import { mkdtemp, readFile, readdir, rm, stat } from 'fs/promises';
import { isIP } from 'net';
import { tmpdir } from 'os';
import path from 'path';
import { promisify } from 'util';

export type VideoDownloadProvider = 'ssstik' | 'yt-dlp' | 'auto';

export interface VideoDownloadOptions {
  provider?: VideoDownloadProvider;
  projectId?: string;
  timeoutMs?: number;
  maxBytes?: number;
}

export interface VideoDownloadResult {
  buffer: Buffer;
  contentType: string;
  fileName: string;
  title?: string;
  duration?: number;
  uploader?: string;
  thumbnail?: string;
  provider: Exclude<VideoDownloadProvider, 'auto'>;
}

interface YtDlpInfo {
  title?: string;
  description?: string;
  duration?: number;
  uploader?: string;
  webpage_url?: string;
  thumbnail?: string;
  [key: string]: unknown;
}

const execFileAsync = promisify(execFile);

const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;
const DEFAULT_MAX_BYTES = 500 * 1024 * 1024;
const SSSTIK_BASE_URL = 'https://ssstik.io';

function getConfiguredProvider(provider?: VideoDownloadProvider): VideoDownloadProvider {
  const configured = (provider || process.env.VIDEO_DOWNLOAD_PROVIDER || 'auto').toLowerCase();
  if (configured === 'ssstik' || configured === 'yt-dlp' || configured === 'auto') {
    return configured;
  }
  return 'auto';
}

function isTiktokLikeUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return hostname.includes('tiktok.com') || hostname.includes('douyin.com');
  } catch {
    return false;
  }
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&#038;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function extractSsstikToken(html: string): string | null {
  const tokenPatterns = [
    /name=["']tt["']\s+value=["']([^"']+)["']/i,
    /value=["']([^"']+)["']\s+name=["']tt["']/i,
    /tt:\s*["']([^"']+)["']/i,
    /["']tt["']\s*:\s*["']([^"']+)["']/i,
  ];

  for (const pattern of tokenPatterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      return decodeHtmlEntities(match[1]);
    }
  }

  return null;
}

function extractFirstMp4Url(html: string): string | null {
  const normalized = decodeHtmlEntities(html);
  const candidates = [
    ...normalized.matchAll(/href=["']([^"']+\.mp4[^"']*)["']/gi),
    ...normalized.matchAll(/src=["']([^"']+\.mp4[^"']*)["']/gi),
    ...normalized.matchAll(/(https?:\/\/[^"'\\\s<>]+\.mp4[^"'\\\s<>]*)/gi),
  ].map(match => match[1]);

  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      return new URL(candidate, SSSTIK_BASE_URL).toString();
    } catch {}
  }

  const downloadLink = normalized.match(/href=["']([^"']+)["'][^>]*>(?:[^<]*)(?:Download|Without watermark|No watermark|下载)/i);
  if (downloadLink?.[1]) {
    try {
      return new URL(downloadLink[1], SSSTIK_BASE_URL).toString();
    } catch {}
  }

  return null;
}

function getFileNameFromUrl(url: string, fallback: string): string {
  try {
    const pathname = new URL(url).pathname;
    const baseName = path.basename(pathname);
    if (baseName && baseName.includes('.')) {
      return baseName.replace(/[^\w.-]/g, '_');
    }
  } catch {}
  return fallback;
}

function isPrivateIpAddress(address: string): boolean {
  const ipVersion = isIP(address);
  if (ipVersion === 4) {
    const [a, b] = address.split('.').map(Number);
    return (
      a === 10 ||
      a === 127 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 169 && b === 254) ||
      a === 0 ||
      a >= 224
    );
  }

  if (ipVersion === 6) {
    const normalized = address.toLowerCase();
    return (
      normalized === '::1' ||
      normalized === '::' ||
      normalized.startsWith('fc') ||
      normalized.startsWith('fd') ||
      normalized.startsWith('fe80') ||
      normalized.startsWith('ff')
    );
  }

  return false;
}

function assertPublicHttpUrlFormat(url: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('视频链接格式不正确');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('视频链接仅支持 http/https');
  }

  const hostname = parsed.hostname.toLowerCase();
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname === 'metadata.google.internal'
  ) {
    throw new Error('不允许访问本地或云元数据地址');
  }

  const ipVersion = isIP(hostname);
  if (ipVersion && isPrivateIpAddress(hostname)) {
    throw new Error('涓嶅厑璁歌闂唴缃戣棰戝湴鍧€');
  }

  if (ipVersion === 4) {
    const [a, b] = hostname.split('.').map(Number);
    const isPrivate =
      a === 10 ||
      a === 127 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 169 && b === 254) ||
      a === 0;
    if (isPrivate) {
      throw new Error('不允许访问内网视频地址');
    }
  }

  if (ipVersion === 6) {
    if (hostname === '::1' || hostname.startsWith('fc') || hostname.startsWith('fd') || hostname.startsWith('fe80')) {
      throw new Error('不允许访问内网视频地址');
    }
  }
  return parsed;
}

async function assertPublicHttpUrl(url: string): Promise<void> {
  const parsed = assertPublicHttpUrlFormat(url);
  const hostname = parsed.hostname.toLowerCase();
  if (isIP(hostname)) return;

  let addresses: Array<{ address: string }> = [];
  try {
    addresses = await lookup(hostname, { all: true });
  } catch {
    throw new Error('瑙嗛閾炬帴鍩熷悕瑙ｆ瀽澶辫触');
  }

  if (addresses.length === 0 || addresses.some(item => isPrivateIpAddress(item.address))) {
    throw new Error('涓嶅厑璁歌闂唴缃戣棰戝湴鍧€');
  }
}

async function fetchText(url: string, timeoutMs: number, init?: RequestInit): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        ...(init?.headers || {}),
      },
    });

    if (!response.ok) {
      throw new Error(`请求 ssstik 失败: ${response.status}`);
    }

    return response.text();
  } finally {
    clearTimeout(timeout);
  }
}

async function downloadUrlToBuffer(url: string, timeoutMs: number, maxBytes: number): Promise<{ buffer: Buffer; contentType: string; fileName: string }> {
  await assertPublicHttpUrl(url);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'video/mp4,video/*,*/*',
        'Referer': SSSTIK_BASE_URL,
      },
    });

    if (!response.ok) {
      throw new Error(`下载视频失败: ${response.status}`);
    }

    await assertPublicHttpUrl(response.url);

    const contentLength = Number(response.headers.get('content-length') || 0);
    if (contentLength > maxBytes) {
      throw new Error(`视频文件过大，超过 ${Math.round(maxBytes / 1024 / 1024)}MB 限制`);
    }

    const contentType = response.headers.get('content-type') || 'video/mp4';
    if (!response.body) {
      throw new Error('下载响应缺少视频内容');
    }

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let receivedBytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      receivedBytes += value.byteLength;
      if (receivedBytes > maxBytes) {
        controller.abort();
        throw new Error(`视频文件过大，超过 ${Math.round(maxBytes / 1024 / 1024)}MB 限制`);
      }
      chunks.push(value);
    }

    const buffer = Buffer.concat(chunks.map(chunk => Buffer.from(chunk)));
    if (buffer.length === 0) {
      throw new Error('下载到的视频内容为空');
    }
    if (buffer.length > maxBytes) {
      throw new Error(`视频文件过大，超过 ${Math.round(maxBytes / 1024 / 1024)}MB 限制`);
    }

    return {
      buffer,
      contentType: contentType.includes('video/') ? contentType.split(';')[0] : 'video/mp4',
      fileName: getFileNameFromUrl(url, `source-${Date.now()}.mp4`),
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function downloadWithSsstik(url: string, timeoutMs: number, maxBytes: number): Promise<VideoDownloadResult> {
  console.log(`[VideoDownloader] [ssstik] 开始下载，url=${url}, timeout=${timeoutMs}ms`);
  if (!isTiktokLikeUrl(url)) {
    throw new Error('ssstik 仅支持 TikTok/抖音类链接');
  }

  const homeHtml = await fetchText(`${SSSTIK_BASE_URL}/en`, timeoutMs);
  const token = extractSsstikToken(homeHtml);
  const requestBody = new URLSearchParams();
  requestBody.set('id', url);
  requestBody.set('locale', 'en');
  requestBody.set('tt', token || '');

  const endpoints = [
    `${SSSTIK_BASE_URL}/abc?url=dl`,
    `${SSSTIK_BASE_URL}/abc`,
    `${SSSTIK_BASE_URL}/en/abc?url=dl`,
  ];

  let lastError: Error | null = null;
  for (const endpoint of endpoints) {
    try {
      console.log(`[VideoDownloader] [ssstik] 尝试 endpoint=${endpoint}`);
      const html = await fetchText(endpoint, timeoutMs, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'HX-Request': 'true',
          'Origin': SSSTIK_BASE_URL,
          'Referer': `${SSSTIK_BASE_URL}/en`,
        },
        body: requestBody.toString(),
      });

      const videoUrl = extractFirstMp4Url(html);
      if (!videoUrl) {
        throw new Error('ssstik 响应中未找到可下载 MP4 地址');
      }

      console.log(`[VideoDownloader] [ssstik] 提取到视频地址，size=${videoUrl.length}`);
      const downloaded = await downloadUrlToBuffer(videoUrl, timeoutMs, maxBytes);
      console.log(`[VideoDownloader] [ssstik] 下载完成，bufferSize=${downloaded.buffer.length}`);
      return {
        ...downloaded,
        title: 'TikTok 视频',
        provider: 'ssstik',
      };
    } catch (error) {
      console.warn(`[VideoDownloader] [ssstik] endpoint=${endpoint} 失败: ${(error as Error).message}`);
      lastError = error as Error;
    }
  }

  console.error(`[VideoDownloader] [ssstik] 所有 endpoint 均失败`);
  throw lastError || new Error('ssstik 下载失败');
}

async function getYtDlpInfo(url: string, timeoutMs: number): Promise<YtDlpInfo> {
  console.log(`[VideoDownloader] [yt-dlp] 获取元信息，url=${url}, timeout=${Math.min(timeoutMs, 60 * 1000)}ms`);
  const { stdout } = await execFileAsync(
    'yt-dlp',
    ['--dump-json', '--no-download', '--no-warnings', url],
    { timeout: Math.min(timeoutMs, 60 * 1000), maxBuffer: 10 * 1024 * 1024 }
  );
  console.log(`[VideoDownloader] [yt-dlp] 元信息获取成功`);
  return JSON.parse(stdout.trim());
}

async function downloadWithYtDlp(url: string, options: VideoDownloadOptions): Promise<VideoDownloadResult> {
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
  const maxBytes = options.maxBytes || DEFAULT_MAX_BYTES;
  console.log(`[VideoDownloader] [yt-dlp] 开始下载，url=${url}, timeout=${timeoutMs}ms`);
  const workDir = await mkdtemp(path.join(tmpdir(), `avatop-ytdlp-${options.projectId || 'tmp'}-`));

  try {
    const info = await getYtDlpInfo(url, timeoutMs);
    const outputTemplate = path.join(workDir, 'video.%(ext)s');

    console.log(`[VideoDownloader] [yt-dlp] 开始下载视频文件，title=${info.title || 'unknown'}`);
    await execFileAsync(
      'yt-dlp',
      ['-f', 'best[ext=mp4]/best', '--merge-output-format', 'mp4', '-o', outputTemplate, '--no-warnings', url],
      { timeout: timeoutMs }
    );
    console.log(`[VideoDownloader] [yt-dlp] 视频文件下载完成`);

    const files = (await readdir(workDir)).filter(file => file.startsWith('video.'));
    if (files.length === 0) {
      throw new Error('yt-dlp 下载完成但未找到视频文件');
    }

    const videoPath = path.join(workDir, files[0]);
    const [buffer, fileStat] = await Promise.all([readFile(videoPath), stat(videoPath)]);
    console.log(`[VideoDownloader] [yt-dlp] 文件读取完成，size=${fileStat.size}`);
    if (fileStat.size === 0) {
      throw new Error('yt-dlp 下载到的视频内容为空');
    }
    if (fileStat.size > maxBytes) {
      throw new Error(`视频文件过大，超过 ${Math.round(maxBytes / 1024 / 1024)}MB 限制`);
    }

    console.log(`[VideoDownloader] [yt-dlp] 下载成功，bufferSize=${buffer.length}`);
    return {
      buffer,
      contentType: 'video/mp4',
      fileName: files[0],
      title: info.title,
      duration: typeof info.duration === 'number' ? Math.round(info.duration) : undefined,
      uploader: info.uploader,
      thumbnail: info.thumbnail,
      provider: 'yt-dlp',
    };
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

export async function downloadVideoFromUrl(url: string, options: VideoDownloadOptions = {}): Promise<VideoDownloadResult> {
  console.log(`[VideoDownloader] >>> downloadVideoFromUrl 开始，url=${url}, provider=${options.provider || 'auto'}, timeout=${options.timeoutMs || DEFAULT_TIMEOUT_MS}ms`);
  try {
    await assertPublicHttpUrl(url);
    const provider = getConfiguredProvider(options.provider);
    const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
    const maxBytes = options.maxBytes || DEFAULT_MAX_BYTES;

    if (provider === 'ssstik') {
      const result = await downloadWithSsstik(url, timeoutMs, maxBytes);
      console.log(`[VideoDownloader] <<< downloadVideoFromUrl 完成，provider=ssstik, size=${result.buffer.length}`);
      return result;
    }

    if (provider === 'yt-dlp') {
      const result = await downloadWithYtDlp(url, options);
      console.log(`[VideoDownloader] <<< downloadVideoFromUrl 完成，provider=yt-dlp, size=${result.buffer.length}`);
      return result;
    }

    if (isTiktokLikeUrl(url)) {
      try {
        console.log(`[VideoDownloader] [auto] 优先尝试 ssstik`);
        const result = await downloadWithSsstik(url, timeoutMs, maxBytes);
        console.log(`[VideoDownloader] <<< downloadVideoFromUrl 完成，provider=ssstik, size=${result.buffer.length}`);
        return result;
      } catch (ssstikError) {
        console.warn(`[VideoDownloader] [auto] ssstik 失败，降级 yt-dlp: ${(ssstikError as Error).message}`);
      }
    }

    console.log(`[VideoDownloader] [auto] 使用 yt-dlp 下载`);
    const result = await downloadWithYtDlp(url, options);
    console.log(`[VideoDownloader] <<< downloadVideoFromUrl 完成，provider=yt-dlp, size=${result.buffer.length}`);
    return result;
  } catch (error) {
    console.error(`[VideoDownloader] <<< downloadVideoFromUrl 失败，url=${url}: ${(error as Error).message}`);
    throw error;
  }
}
