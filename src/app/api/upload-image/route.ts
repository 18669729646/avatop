import { NextRequest, NextResponse } from 'next/server';
import { URL_EXPIRE_TIME } from '@/lib/storage-types';
import { authenticateRequest, unauthorizedResponse, INTERNAL_AUTH_HEADER, INTERNAL_AUTH_USER_ID } from '@/lib/auth-middleware';
import { s3Storage } from '@/lib/s3-client';
import { optimizeImage, isSupportedImageFormat } from '@/lib/image-optimizer';

// 生成唯一 trace ID
function generateTraceId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

// 创建带耗时统计的日志函数
function createTraceLogger(traceId: string) {
  const startTime = Date.now();
  return {
    log: (step: string, data?: Record<string, unknown>) => {
      const elapsed = Date.now() - startTime;
      const dataStr = data ? ` ${JSON.stringify(data)}` : '';
      console.log(`[TRACE-${traceId}] ${step} (+${elapsed}ms)${dataStr}`);
    },
    error: (step: string, data?: Record<string, unknown>) => {
      const elapsed = Date.now() - startTime;
      const dataStr = data ? ` ${JSON.stringify(data)}` : '';
      console.error(`[TRACE-${traceId}] ${step} (+${elapsed}ms)${dataStr}`);
    },
    getElapsed: () => Date.now() - startTime,
  };
}

/**
 * 通用图片上传 API
 * 支持 FormData 二进制上传（推荐）和 base64 上传
 */
export async function POST(request: NextRequest) {
  const traceId = `Upload-${generateTraceId()}`;
  const trace = createTraceLogger(traceId);
  
  trace.log('Step 1: 收到上传请求');
  
  try {
    // 检查是否是内部服务器调用（不需要认证）
    const internalAuth = request.headers.get(INTERNAL_AUTH_HEADER);
    if (internalAuth !== 'true') {
      // 前端调用，需要验证用户身份
      const auth = await authenticateRequest(request);
      if (!auth.success) {
        return unauthorizedResponse(auth.error, auth.status);
      }
    }
    
    // 检查环境变量
    trace.log('Step 2: 检查环境变量', {
      hasEndpointUrl: !!process.env.COZE_BUCKET_ENDPOINT_URL,
      hasBucketName: !!process.env.COZE_BUCKET_NAME,
      bucketName: process.env.COZE_BUCKET_NAME,
    });
    
    const contentType = request.headers.get('content-type') || '';
    trace.log('Step 3: 检查 Content-Type', {
      isFormData: contentType.includes('multipart/form-data'),
      isJson: contentType.includes('application/json'),
    });
    
    // 支持 FormData 二进制上传（更高效）
    if (contentType.includes('multipart/form-data')) {
      // 先解析 FormData 检查是否为预热请求
      const formData = await request.formData();
      if (formData.get('warmup') === 'true') {
        trace.log('Step 3.5: 预热请求，快速返回');
        return NextResponse.json({ success: true, message: 'API warmed up' });
      }
      return await handleFormDataUpload(formData, traceId, trace);
    }
    
    // 兼容 base64 JSON 上传
    return await handleBase64Upload(request, traceId, trace);
  } catch (error) {
    console.error(`[TRACE-Upload-API-${traceId}] ERROR: 整体异常`, {
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { success: false, error: '上传服务异常', details: error instanceof Error ? error.message : '未知错误', traceId },
      { status: 500 }
    );
  }
}

// 处理 FormData 二进制上传（推荐，更高效）
async function handleFormDataUpload(formData: FormData, traceId: string, trace: ReturnType<typeof createTraceLogger>): Promise<NextResponse> {
  trace.log('Step 4: FormData 已解析');
  
  const file = formData.get('file') as File | null;
  const folder = formData.get('folder') as string || 'images';
  const customFileName = formData.get('fileName') as string | null;

  trace.log('Step 5: 提取表单字段', {
    hasFile: !!file,
    fileName: file?.name,
    fileSize: file ? `${(file.size / 1024).toFixed(2)}KB` : null,
    fileType: file?.type,
    folder,
  });

  if (!file) {
    trace.error('Step 5-ERROR: 未找到文件');
    return NextResponse.json(
      { success: false, error: '未找到上传文件', traceId },
      { status: 400 }
    );
  }

  // 验证文件类型
  if (!file.type.startsWith('image/')) {
    trace.error('Step 6-ERROR: 文件类型不支持', { fileType: file.type });
    return NextResponse.json(
      { success: false, error: '只支持图片文件', fileType: file.type, traceId },
      { status: 400 }
    );
  }

  trace.log('Step 7: 开始读取文件内容');
  
  // 读取文件内容
  let buffer: Buffer;
  let originalSize = 0;
  let compressionRatio = 0;
  try {
    const arrayBuffer = await file.arrayBuffer();
    buffer = Buffer.from(arrayBuffer);
    originalSize = buffer.length;
    trace.log('Step 8: 文件读取成功', {
      bufferSize: `${(buffer.length / 1024).toFixed(2)}KB`,
    });
  } catch (readError) {
    trace.error('Step 8-ERROR: 文件读取失败', {
      errorMessage: readError instanceof Error ? readError.message : String(readError),
    });
    return NextResponse.json(
      { success: false, error: '文件读取失败', details: readError instanceof Error ? readError.message : '未知错误', traceId },
      { status: 500 }
    );
  }
  
  // 图片优化（转换为 WebP）
  let contentType = file.type || 'image/jpeg';
  let extension = contentType.split('/')[1] || 'jpg';
  
  if (isSupportedImageFormat(contentType)) {
    try {
      const result = await optimizeImage(buffer, {
        maxWidth: 2048,
        maxHeight: 2048,
        quality: 85,
        convertToWebP: true,
      });
      buffer = result.buffer;
      contentType = result.mimeType;
      extension = result.extension;
      compressionRatio = result.compressionRatio;
      trace.log('Step 8.5: 图片优化成功', {
        originalSize: `${(originalSize / 1024).toFixed(2)}KB`,
        optimizedSize: `${(result.optimizedSize / 1024).toFixed(2)}KB`,
        compressionRatio: `${compressionRatio}%`,
        format: result.format,
      });
    } catch (optimizeError) {
      trace.error('Step 8.5-WARN: 图片优化失败，使用原始文件', {
        errorMessage: optimizeError instanceof Error ? optimizeError.message : String(optimizeError),
      });
      // 优化失败，继续使用原始文件
    }
  }

  // 生成文件名
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 8);
  const finalFileName = customFileName || `${folder}/${timestamp}_${randomStr}.${extension}`;

  trace.log('Step 9: 准备上传到对象存储', {
    finalFileName,
    contentType,
    bufferSize: `${(buffer.length / 1024).toFixed(2)}KB`,
  });

  // 上传到对象存储
  let key: string;
  try {
    key = await s3Storage.uploadFile({
      fileContent: buffer,
      fileName: finalFileName,
      contentType,
    });
    trace.log('Step 10: 对象存储上传成功', { key });
  } catch (uploadError) {
    trace.error('Step 10-ERROR: 对象存储上传失败', {
      errorMessage: uploadError instanceof Error ? uploadError.message : String(uploadError),
    });
    return NextResponse.json(
      { success: false, error: '对象存储上传失败', details: uploadError instanceof Error ? uploadError.message : '未知错误', traceId },
      { status: 500 }
    );
  }

  // 生成访问 URL（有效期1年）
  let url: string;
  try {
    url = await s3Storage.generatePresignedUrl({
      key,
      expireTime: URL_EXPIRE_TIME,
    });
    trace.log('Step 11: 生成签名URL成功', {
      urlLength: url.length,
    });
  } catch (urlError) {
    trace.error('Step 11-ERROR: 生成签名URL失败', {
      errorMessage: urlError instanceof Error ? urlError.message : String(urlError),
    });
    return NextResponse.json(
      { success: false, error: '生成访问URL失败', details: urlError instanceof Error ? urlError.message : '未知错误', traceId },
      { status: 500 }
    );
  }

  trace.log('Step 12: 上传完成', { totalMs: trace.getElapsed() });

  return NextResponse.json({
    success: true,
    url,
    key,
    fileSize: buffer.length, // 文件大小（字节）
    generatedAt: Date.now(), // URL 生成时间
    traceId,
  });
}

// 处理 base64 JSON 上传（兼容旧方式）
async function handleBase64Upload(request: NextRequest, traceId: string, trace: ReturnType<typeof createTraceLogger>): Promise<NextResponse> {
  trace.log('Step 4: 开始解析 JSON body');
  
  const body = await request.json();
  const { image, fileName, folder = 'images' } = body;

  trace.log('Step 5: 解析请求体', {
    hasImage: !!image,
    imageType: image ? (image.startsWith('data:') ? 'base64' : image.startsWith('http') ? 'url' : 'unknown') : null,
    imageLength: image?.length,
    fileName,
    folder,
  });

  if (!image) {
    return NextResponse.json(
      { success: false, error: '图片数据不能为空', traceId },
      { status: 400 }
    );
  }

  // 解析 base64 数据
  let buffer: Buffer;
  let contentType = 'image/jpeg';
  
  if (image.startsWith('data:')) {
    const matches = image.match(/^data:(image\/\w+);base64,(.+)$/);
    if (matches && matches.length === 3) {
      contentType = matches[1];
      const base64Data = matches[2];
      buffer = Buffer.from(base64Data, 'base64');
      trace.log('Step 6: base64 解析成功', {
        contentType,
        bufferSize: `${(buffer.length / 1024).toFixed(2)}KB`,
      });
    } else {
      trace.error('Step 6-ERROR: base64 格式无效');
      return NextResponse.json(
        { success: false, error: '无效的 base64 图片格式', traceId },
        { status: 400 }
      );
    }
  } else if (image.startsWith('http')) {
    trace.log('Step 6: 图片已是 URL，直接返回');
    return NextResponse.json({
      success: true,
      url: image,
      key: null,
      message: '图片已是 URL 格式，无需上传',
      traceId,
    });
  } else {
    trace.error('Step 6-ERROR: 不支持的图片格式');
    return NextResponse.json(
      { success: false, error: '不支持的图片格式', traceId },
      { status: 400 }
    );
  }

  // 生成文件名
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 8);
  const ext = contentType.split('/')[1] || 'jpg';
  const finalFileName = fileName || `${folder}/${timestamp}_${randomStr}.${ext}`;

  trace.log('Step 7: 准备上传到对象存储', {
    finalFileName,
    contentType,
    bufferSize: `${(buffer.length / 1024).toFixed(2)}KB`,
  });

  // 上传到对象存储
  let key: string;
  try {
    key = await s3Storage.uploadFile({
      fileContent: buffer,
      fileName: finalFileName,
      contentType,
    });
    trace.log('Step 8: 对象存储上传成功', { key });
  } catch (uploadError) {
    trace.error('Step 8-ERROR: 对象存储上传失败', {
      errorMessage: uploadError instanceof Error ? uploadError.message : String(uploadError),
    });
    return NextResponse.json(
      { success: false, error: '对象存储上传失败', details: uploadError instanceof Error ? uploadError.message : '未知错误', traceId },
      { status: 500 }
    );
  }

  // 生成访问 URL
  let url: string;
  try {
    url = await s3Storage.generatePresignedUrl({
      key,
      expireTime: URL_EXPIRE_TIME,
    });
    trace.log('Step 9: 生成签名URL成功');
  } catch (urlError) {
    trace.error('Step 9-ERROR: 生成签名URL失败');
    return NextResponse.json(
      { success: false, error: '生成访问URL失败', traceId },
      { status: 500 }
    );
  }

  trace.log('Step 10: 上传完成', { totalMs: trace.getElapsed() });

  return NextResponse.json({
    success: true,
    url,
    key,
    generatedAt: Date.now(), // URL 生成时间
    traceId,
  });
}
