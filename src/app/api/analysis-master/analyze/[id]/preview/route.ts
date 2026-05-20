import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { authenticateRequest } from '@/lib/auth-middleware';
import { getAnalysisMasterPrompt } from '@/lib/analysis-master';
import { s3Storage } from '@/lib/s3-client';
import { URL_EXPIRE_TIME } from '@/lib/storage-types';
import { getServerDefaultTextApi } from '@/lib/server-config';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // 鉴权
  const authResult = await authenticateRequest(request);
  if ('error' in authResult || !authResult.userId) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }
  const userId = authResult.userId;

  const supabase = getSupabaseClient();

  // 查询项目
  const { data: project, error } = await supabase
    .from('analysis_master_projects')
    .select('id, user_id, name, video_key, source_type, video_duration')
    .eq('id', id)
    .eq('user_id', userId)
    .single();

  if (error || !project) {
    return NextResponse.json({ error: '项目不存在' }, { status: 404 });
  }

  // 生成 presigned URL 并下载视频
  if (!project.video_key) {
    return NextResponse.json({ error: '项目无视频' }, { status: 400 });
  }

  let videoBuffer: Buffer;
  try {
    const presignedUrl = await s3Storage.generatePresignedUrl({
      key: project.video_key,
      expireTime: URL_EXPIRE_TIME,
    });
    const response = await fetch(presignedUrl);
    if (!response.ok) {
      return NextResponse.json({ error: `视频下载失败: HTTP ${response.status}` }, { status: 500 });
    }
    const arrayBuffer = await response.arrayBuffer();
    videoBuffer = Buffer.from(arrayBuffer);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `视频读取失败: ${message}` }, { status: 500 });
  }

  // 压缩视频（与实际分析一致）
  const { execFile } = require('child_process');
  const { promisify } = require('util');
  const execFileAsync = promisify(execFile);
  const fs = require('fs');
  const path = require('path');
  const os = require('os');

  const inputPath = path.join(os.tmpdir(), `am-preview-input-${Date.now()}.mp4`);
  const outputPath = path.join(os.tmpdir(), `am-preview-output-${Date.now()}.mp4`);

  try {
    fs.writeFileSync(inputPath, videoBuffer);
    await execFileAsync('ffmpeg', [
      '-i', inputPath,
      '-vf', 'scale=480:-2',
      '-crf', '28',
      '-preset', 'fast',
      '-movflags', '+faststart',
      '-y',
      outputPath,
    ], { timeout: 120000 });

    const compressedBuffer = fs.readFileSync(outputPath);

    // 构建完整 prompt
    const prompt = await getAnalysisMasterPrompt({
      projectName: project.name,
      sourceType: project.source_type === 'link' ? '链接导入' : '上传视频',
      videoDuration: project.video_duration || '未知',
    });

    // 获取后台文本模型配置
    const apiConfig = await getServerDefaultTextApi();
    const model = apiConfig?.model || 'gemini-2.5-flash';

    // 构造与实际发送一致的请求体（video 以 base64 大小显示，便于预览）
    const base64Data = compressedBuffer.toString('base64');
    const requestBody = {
      model,
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: 'video/mp4',
                data: `[视频数据 base64, ${(base64Data.length / 1024 / 1024).toFixed(1)} MB]`,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.3,
        topP: 0.9,
        maxOutputTokens: 32768,
        response_mime_type: 'application/json',
      },
    };

    return NextResponse.json({
      success: true,
      data: {
        projectId: project.id,
        projectName: project.name,
        model,
        originalSize: videoBuffer.length,
        compressedSize: compressedBuffer.length,
        compressedBase64Size: base64Data.length,
        prompt,
        requestBody,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `预览构建失败: ${message}` }, { status: 500 });
  } finally {
    try { fs.unlinkSync(inputPath); } catch {}
    try { fs.unlinkSync(outputPath); } catch {}
  }
}
