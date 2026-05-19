/**
 * 图片处理工具函数
 * 用于压缩图片、获取图片尺寸等
 */

import { authFetch } from '@/lib/auth-context';

export interface CompressionOptions {
  maxWidth?: number;       // 最大宽度
  maxHeight?: number;      // 最大高度
  quality?: number;        // 质量 0-1
  maxSizeKB?: number;      // 最大文件大小（KB）
  mimeType?: string;       // 输出格式
}

const DEFAULT_OPTIONS: CompressionOptions = {
  maxWidth: 2048,          // 最大尺寸 2K
  maxHeight: 2048,
  quality: 1,              // 质量 100%
  mimeType: 'image/jpeg',
};

/**
 * 压缩图片
 * @param file 原始图片文件
 * @param options 压缩选项
 * @returns 压缩后的 Blob
 */
export async function compressImage(
  file: File,
  options: CompressionOptions = {}
): Promise<Blob> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  // 如果是 GIF 或 WebP 动图，不压缩
  if (file.type === 'image/gif' || file.type === 'image/webp') {
    // 但仍需检查尺寸
    const img = await loadImage(file);
    if (img.width <= opts.maxWidth! && img.height <= opts.maxHeight!) {
      return file;
    }
    // 需要缩放
    return resizeImage(img, opts);
  }
  
  // 加载图片
  const img = await loadImage(file);
  
  // 计算目标尺寸
  let targetWidth = img.width;
  let targetHeight = img.height;
  
  if (img.width > opts.maxWidth! || img.height > opts.maxHeight!) {
    const ratio = Math.min(
      opts.maxWidth! / img.width,
      opts.maxHeight! / img.height
    );
    targetWidth = Math.round(img.width * ratio);
    targetHeight = Math.round(img.height * ratio);
  }
  
  // 创建 canvas 进行压缩
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('无法创建 Canvas 上下文');
  }
  
  // 绘制图片
  ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
  
  // 尝试不同的质量等级，直到满足大小要求
  let quality = opts.quality!;
  let blob: Blob | null = null;
  const maxAttempts = 5;
  
  for (let i = 0; i < maxAttempts; i++) {
    blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, opts.mimeType, quality);
    });
    
    if (!blob) {
      throw new Error('图片压缩失败');
    }
    
    const sizeKB = blob.size / 1024;
    
    // 如果满足大小要求，或者已经是最低质量，返回结果
    if (sizeKB <= opts.maxSizeKB! || quality <= 0.1) {
      return blob;
    }
    
    // 降低质量重试
    quality *= 0.7;
  }
  
  return blob!;
}

/**
 * 加载图片
 */
function loadImage(file: File | Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('图片加载失败'));
    };
    
    img.src = url;
  });
}

/**
 * 缩放图片
 */
async function resizeImage(
  img: HTMLImageElement,
  options: CompressionOptions
): Promise<Blob> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  let targetWidth = img.width;
  let targetHeight = img.height;
  
  if (img.width > opts.maxWidth! || img.height > opts.maxHeight!) {
    const ratio = Math.min(
      opts.maxWidth! / img.width,
      opts.maxHeight! / img.height
    );
    targetWidth = Math.round(img.width * ratio);
    targetHeight = Math.round(img.height * ratio);
  }
  
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('无法创建 Canvas 上下文');
  }
  
  ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
  
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('图片缩放失败'));
        }
      },
      opts.mimeType,
      opts.quality
    );
  });
}

/**
 * 获取图片尺寸
 */
export async function getImageDimensions(
  file: File | Blob
): Promise<{ width: number; height: number }> {
  const img = await loadImage(file);
  return { width: img.width, height: img.height };
}

/**
 * 将 File/Blob 转换为 base64
 */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // 返回不带 data:xxx;base64, 前缀的部分
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * 批量上传图片到对象存储（并行）
 * @param files 文件列表
 * @param options 上传选项
 * @returns 上传结果列表
 */
export async function uploadImagesParallel(
  files: File[],
  options: {
    folder?: string;
    compress?: boolean;
    compressionOptions?: CompressionOptions;
    maxConcurrent?: number;
    onProgress?: (index: number, progress: number) => void;
  } = {}
): Promise<Array<{ success: boolean; url?: string; error?: string; originalFile: File }>> {
  const {
    folder = 'images',
    compress = true,
    compressionOptions = {},
    maxConcurrent = 3,
  } = options;
  
  const results: Array<{ success: boolean; url?: string; error?: string; originalFile: File }> = [];
  
  // 并发上传，控制并发数
  for (let i = 0; i < files.length; i += maxConcurrent) {
    const batch = files.slice(i, i + maxConcurrent);
    
    const batchResults = await Promise.allSettled(
      batch.map(async (file) => {
        try {
          // 压缩图片
          let blob: Blob = file;
          if (compress && file.type.startsWith('image/')) {
            blob = await compressImage(file, compressionOptions);
            console.log(`[上传] 压缩: ${(file.size / 1024).toFixed(1)}KB → ${(blob.size / 1024).toFixed(1)}KB`);
          }
          
          // 上传
          const formData = new FormData();
          formData.append('file', blob, file.name);
          formData.append('folder', folder);
          
          const response = await authFetch('/api/upload-image', {
            method: 'POST',
            body: formData,
          });
          
          const result = await response.json();
          
          if (result.success && result.url) {
            return { success: true, url: result.url, originalFile: file };
          } else {
            return { success: false, error: result.error || '上传失败', originalFile: file };
          }
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : '上传异常',
            originalFile: file,
          };
        }
      })
    );
    
    // 收集结果
    batchResults.forEach((result) => {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        results.push({
          success: false,
          error: result.reason?.message || '上传失败',
          originalFile: files[results.length], // 注意：这里的索引可能不准确
        });
      }
    });
  }
  
  return results;
}
