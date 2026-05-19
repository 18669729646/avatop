import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { authenticateRequest } from '@/lib/auth-middleware';
import { checkUserCredits, getCreditPrice } from '@/lib/credits';
import { checkStorageQuota } from '@/lib/storage-quota';
import { getServerVideoApiByBaseUrlOrModel } from '@/lib/server-config';
import { logApiError } from '@/lib/logger';

interface SeedanceRequest {
  // 鍩虹鍙傛暟
  model: 'doubao-seedance-2.0' | 'doubao-seedance-2.0-fast';
  prompt: string;

  // 濯掍綋鍙傝€?  image?: string;        // 棣栧抚鍥剧墖 URL锛圫3 棰勭鍚嶏級
  image_tail?: string;  // 灏惧抚鍥剧墖 URL锛圫3 棰勭鍚嶏級
  images?: string[];    // 鍙傝€冨浘鍒楄〃锛堟渶澶?寮狅級
  video?: string;       // 鍙傝€冭棰?URL
  audio?: string[];     // 鍙傝€冮煶棰?URL 鍒楄〃锛堟渶澶?涓級

  // 瑙嗛鍙傛暟
  aspect_ratio?: '16:9' | '9:16' | '3:4' | '4:3' | '1:1' | '21:9' | 'adaptive';
  resolution?: '480p' | '720p' | '1080p';
  duration?: number;    // 4-15 绉掞紝榛樿 5
  watermark?: boolean;  // 榛樿 false

  // 楂樼骇鍙傛暟
  extra_body?: {
    real_person_mode?: boolean;       // 鐪熶汉妯″紡
    movement_amplitude?: string;      // 杩愬姩骞呭害
    camera_strength?: string;        // 闀滃ご寮哄害
    camera_control?: string;         // 闀滃ご鎺у埗
    image_list?: string[];           // 鍥剧墖鍒楄〃锛堢敤浜庨暅澶存帶鍒讹級
    video_list?: string[];           // 瑙嗛鍒楄〃
    static_mask?: string;            // 闈欐€侀伄缃?    draft?: boolean;                 // 鑽夌妯″紡
    return_last_frame?: boolean;     // 杩斿洖灏惧抚
  };

  // 涓氬姟鍏宠仈
  project_id?: string;
}

export async function POST(request: NextRequest) {
  try {
    // 楠岃瘉鐢ㄦ埛韬唤
    const auth = await authenticateRequest(request);
    if (!auth.success) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const userId = auth.userId!;
    const body: SeedanceRequest = await request.json();

    // 参数校验
    const { model, prompt } = body;
    if (!model || !prompt) {
      return NextResponse.json({ error: 'model 和 prompt 为必填参数' }, { status: 400 });
    }

    // 仅支持 Seedance 2.0 模型
    const validModels = ['doubao-seedance-2.0', 'doubao-seedance-2.0-fast'];
    if (!validModels.includes(model)) {
      return NextResponse.json(
        { error: `不支持的模型，仅支持: ${validModels.join(', ')}` },
        { status: 400 }
      );
    }

    // 时长校验：4-15 秒
    const duration = Math.min(15, Math.max(4, body.duration ?? 5));
    if (body.duration !== undefined && (body.duration < 4 || body.duration > 15)) {
      return NextResponse.json({ error: '时长必须在 4-15 秒之间' }, { status: 400 });
    }

    // 分辨率校验
    const validResolutions = ['480p', '720p', '1080p'];
    const resolution = body.resolution ?? '720p';
    if (!validResolutions.includes(resolution)) {
      return NextResponse.json({ error: '不支持的分辨率' }, { status: 400 });
    }

    // 宽高比校验
    const validAspectRatios = ['16:9', '9:16', '3:4', '4:3', '1:1', '21:9', 'adaptive'];
    const aspectRatio = body.aspect_ratio ?? '16:9';
    if (body.aspect_ratio && !validAspectRatios.includes(body.aspect_ratio)) {
      return NextResponse.json({ error: '不支持的宽高比' }, { status: 400 });
    }

    // 获取 API 配置
    const apiConfig = await getServerVideoApiByBaseUrlOrModel(undefined, model);
    if (!apiConfig) {
      return NextResponse.json({ error: `未找到模型 ${model} 的配置，请联系管理员` }, { status: 500 });
    }

    // 计算积分消耗
    const isFast = model === 'doubao-seedance-2.0-fast';
    const resolutionKey = `video_seedance2_${isFast ? 'fast_' : ''}${resolution}`;
    const price = await getCreditPrice(resolutionKey);
    if (!price) {
      return NextResponse.json({ error: `未配置 ${resolutionKey} 每秒积分价格，请联系管理员` }, { status: 500 });
    }
    const creditsPerSecond = price.creditsRequired;
    const totalCredits = creditsPerSecond * duration;

    // 检查积分
    const creditCheck = await checkUserCredits(userId, totalCredits);
    if (!creditCheck.hasEnough) {
      return NextResponse.json(
        { error: `积分不足，当前 ${creditCheck.balance} 积分，需要 ${totalCredits} 积分` },
        { status: 402 }
      );
    }

    // 检查存储空间
    const storageCheck = await checkStorageQuota(userId);
    if (!storageCheck.allowed) {
      return NextResponse.json({ error: storageCheck.error }, { status: 507 });
    }

    const taskId = `seedance_${crypto.randomUUID()}`;
    const supabase = getSupabaseClient();

    // 鏋勫缓浠诲姟鍙傛暟锛堟墍鏈?Seedance 鍙傛暟閮戒紶鍏ワ級
    const taskParams = {
      model,
      prompt,
      baseUrl: apiConfig.baseUrl,
      apiKey: apiConfig.apiKey,
      apiKeyMasked: apiConfig.apiKeyMasked,
      // 濯掍綋鍙傝€?      image: body.image,
      image_tail: body.image_tail,
      images: body.images,
      video: body.video,
      audio: body.audio,
      // 瑙嗛鍙傛暟
      aspect_ratio: aspectRatio,
      resolution,
      duration,
      watermark: body.watermark ?? false,
      // 楂樼骇鍙傛暟
      extra_body: body.extra_body,
      // 绉垎璁＄畻
      credits_required: totalCredits,
      action_type: resolutionKey,
    };

    // 过滤敏感字段（不存储 apiKey）
    const safeParams = { ...taskParams };
    delete (safeParams as Record<string, unknown>).apiKey;

    // 鍒涘缓浠诲姟璁板綍
    const { error: insertError } = await supabase
      .from('task_queue')
      .insert({
        id: taskId,
        user_id: userId,
        type: 'video',
        status: 'pending',
        params: safeParams,
        project_id: body.project_id || null,
        retry_count: 0,
        max_retry: 5,
      });

    if (insertError) {
      logApiError('seedance/generate', '鍒涘缓浠诲姟', insertError, { userId });
      return NextResponse.json({ error: '鍒涘缓浠诲姟澶辫触' }, { status: 500 });
    }

    // 瑙﹀彂鍚庡彴澶勭悊
    const baseUrl = process.env.COZE_PROJECT_DOMAIN_DEFAULT || `http://localhost:${process.env.DEPLOY_RUN_PORT || 5000}`;
    const authHeader = request.headers.get('authorization');
    const processHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authHeader) {
      processHeaders.Authorization = authHeader;
    }
    fetch(`${baseUrl}/api/tasks/process`, {
      method: 'POST',
      headers: processHeaders,
      body: JSON.stringify({ taskId }),
    }).catch(() => {});
    return NextResponse.json({
      success: true,
      taskId,
      creditsRequired: totalCredits,
      model,
      duration,
      resolution,
    });

  } catch (error) {
    logApiError('seedance/generate', '澶勭悊璇锋眰', error as Error, {});
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '鍒涘缓浠诲姟澶辫触' },
      { status: 500 }
    );
  }
}
