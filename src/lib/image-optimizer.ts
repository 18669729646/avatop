import sharp from 'sharp';

/**
 * 图片优化配置
 */
export interface ImageOptimizeOptions {
  /** 最大宽度，默认 2048 */
  maxWidth?: number;
  /** 最大高度，默认 2048 */
  maxHeight?: number;
  /** WebP 质量，默认 85 */
  quality?: number;
  /** 是否转换为 WebP，默认 true */
  convertToWebP?: boolean;
  /** 是否保留透明度（PNG 转 WebP 时），默认 true */
  preserveTransparency?: boolean;
}

/**
 * 图片优化结果
 */
export interface ImageOptimizeResult {
  /** 优化后的图片 Buffer */
  buffer: Buffer;
  /** 原始大小（字节） */
  originalSize: number;
  /** 优化后大小（字节） */
  optimizedSize: number;
  /** 压缩比例 */
  compressionRatio: number;
  /** 输出格式 */
  format: 'webp' | 'jpeg' | 'png';
  /** 输出 MIME 类型 */
  mimeType: string;
  /** 文件扩展名 */
  extension: string;
}

/**
 * 默认配置
 */
const DEFAULT_OPTIONS: Required<ImageOptimizeOptions> = {
  maxWidth: 2048,
  maxHeight: 2048,
  quality: 85,
  convertToWebP: true,
  preserveTransparency: true,
};

/**
 * 优化图片
 * 自动调整尺寸并转换为 WebP 格式
 * 
 * @param input 输入图片 Buffer 或文件路径
 * @param options 优化选项
 * @returns 优化结果
 */
export async function optimizeImage(
  input: Buffer | string,
  options: ImageOptimizeOptions = {}
): Promise<ImageOptimizeResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  // 创建 sharp 实例
  let image = sharp(input);
  
  // 获取原始图片信息
  const metadata = await image.metadata();
  const originalSize = metadata.size || 0;
  
  // 调整尺寸（如果超过最大尺寸）
  if (metadata.width && metadata.height) {
    if (metadata.width > opts.maxWidth || metadata.height > opts.maxHeight) {
      image = image.resize(opts.maxWidth, opts.maxHeight, {
        fit: 'inside',
        withoutEnlargement: true,
      });
    }
  }
  
  // 确定输出格式
  let format: 'webp' | 'jpeg' | 'png' = 'webp';
  let mimeType = 'image/webp';
  let extension = 'webp';
  
  if (opts.convertToWebP) {
    // WebP 格式
    if (metadata.hasAlpha && opts.preserveTransparency) {
      // 有透明度，使用 WebP
      image = image.webp({ quality: opts.quality, alphaQuality: 100 });
    } else {
      // 无透明度，使用 WebP
      image = image.webp({ quality: opts.quality });
    }
  } else {
    // 保持原格式
    switch (metadata.format) {
      case 'jpeg':
      case 'jpg':
        format = 'jpeg';
        mimeType = 'image/jpeg';
        extension = 'jpg';
        image = image.jpeg({ quality: opts.quality });
        break;
      case 'png':
        format = 'png';
        mimeType = 'image/png';
        extension = 'png';
        image = image.png({ compressionLevel: 9 });
        break;
      default:
        // 默认转 WebP
        image = image.webp({ quality: opts.quality });
        break;
    }
  }
  
  // 生成输出
  const buffer = await image.toBuffer();
  const optimizedSize = buffer.length;
  const compressionRatio = originalSize > 0 
    ? Math.round((1 - optimizedSize / originalSize) * 100) 
    : 0;
  
  return {
    buffer,
    originalSize,
    optimizedSize,
    compressionRatio,
    format,
    mimeType,
    extension,
  };
}

/**
 * 检查文件是否为图片
 */
export function isImageFile(contentType: string): boolean {
  return contentType.startsWith('image/');
}

/**
 * 检查文件类型是否支持优化
 */
export function isSupportedImageFormat(contentType: string): boolean {
  const supportedTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/bmp',
    'image/tiff',
  ];
  return supportedTypes.includes(contentType.toLowerCase());
}

/**
 * 根据 MIME 类型获取文件扩展名
 */
export function getExtensionFromMimeType(mimeType: string): string {
  const mapping: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/bmp': 'bmp',
    'image/tiff': 'tiff',
  };
  return mapping[mimeType.toLowerCase()] || 'bin';
}
