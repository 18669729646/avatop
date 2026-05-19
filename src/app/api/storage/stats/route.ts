import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { getSupabaseClient } from '@/storage/database/supabase-client';

/**
 * 存储统计 API
 * 从数据库统计当前用户的存储使用量
 */
export async function GET(request: NextRequest) {
  try {
    // 验证用户认证
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    if (!token) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }
    
    const user = await verifyToken(token);
    if (!user) {
      return NextResponse.json(
        { success: false, error: '无效的认证令牌' },
        { status: 401 }
      );
    }

    const userId = user.userId;
    const client = getSupabaseClient();
    let totalSize = 0;
    let fileCount = 0;

    // 1. 统计图片历史记录
    const { data: imageHistory } = await client
      .from('image_history')
      .select('file_size')
      .eq('user_id', userId);
    
    if (imageHistory) {
      imageHistory.forEach((item) => {
        totalSize += item.file_size || 0;
        if (item.file_size) fileCount++;
      });
    }

    // 2. 统计视频历史记录
    const { data: videoHistory } = await client
      .from('video_history')
      .select('file_size')
      .eq('user_id', userId);
    
    if (videoHistory) {
      videoHistory.forEach((item) => {
        totalSize += item.file_size || 0;
        if (item.file_size) fileCount++;
      });
    }

    // 3. 统计角色图库
    const { data: characters } = await client
      .from('character_library')
      .select('file_size')
      .eq('user_id', userId);

    if (characters) {
      characters.forEach((item) => {
        totalSize += item.file_size || 0;
        if (item.file_size) fileCount++;
      });
    }

    // 4. 统计产品图片
    const { data: products } = await client
      .from('products')
      .select('images')
      .eq('user_id', userId);

    if (products) {
      products.forEach((product) => {
        const images = product.images as Array<{ fileSize?: number }> | null;
        if (images) {
          images.forEach((img) => {
            totalSize += img.fileSize || 0;
            if (img.fileSize) fileCount++;
          });
        }
      });
    }

    // 5. 统计任务队列中的成功任务
    const { data: tasks } = await client
      .from('task_queue')
      .select('type, result')
      .eq('user_id', userId)
      .eq('status', 'success');

    if (tasks) {
      tasks.forEach((task) => {
        if (!task.result) return;
        const result = task.result as {
          fileSize?: number;
          url?: string;
          videoUrl?: string;
        };
        const fileSize = result.fileSize || 0;
        
        if ((task.type === 'image' && result.url) || 
            (task.type === 'video' && result.videoUrl)) {
          // 避免重复计算（历史记录表已有记录）
          // 任务队列中的数据可能是临时文件，不计入总存储
        }
      });
    }

    console.log(
      `[Storage Stats] 用户 ${userId} 存储统计: ${fileCount} 个文件, ${(totalSize / 1024 / 1024).toFixed(2)} MB`
    );

    return NextResponse.json({
      success: true,
      data: {
        totalSize,
        fileCount,
      },
    });
  } catch (error) {
    console.error('[Storage Stats API] 错误:', error);
    return NextResponse.json({
      success: true,
      data: {
        totalSize: 0,
        fileCount: 0,
      },
    });
  }
}
