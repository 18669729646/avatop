import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth-middleware';
import { logAdminAction } from '@/lib/admin-log';
import { pool } from '@/lib/db-pool';
import { s3Storage } from '@/lib/s3-client';

function extractKeyFromUrl(url: string): string | null {
  if (!url) return null;
  try {
    const urlObj = new URL(url);
    return urlObj.pathname.substring(1);
  } catch {
    return null;
  }
}

async function deleteS3File(url: string): Promise<boolean> {
  const key = extractKeyFromUrl(url);
  if (!key) return false;
  return s3Storage.deleteFile(key);
}

/**
 * POST /api/data/clear
 * 清除历史数据
 * - 普通用户：清除自己的数据
 * - 管理员：清除全站数据
 */
export async function POST(request: NextRequest) {
  // 验证用户身份
  const authResult = await verifyAuth(request);
  if (!authResult.success) {
    return NextResponse.json(
      { success: false, error: authResult.error },
      { status: authResult.status }
    );
  }

  const userId = authResult.userId;
  const isAdmin = authResult.payload.role === 'admin';

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    if (isAdmin) {
      // 管理员：清除全站数据
      await clearGlobalData(client);
      console.log(`[Admin] ${userId} cleared all global data`);
    } else {
      // 普通用户：清除自己的数据
      await clearUserData(client, userId);
      console.log(`[User] ${userId} cleared their data`);
    }

    await client.query('COMMIT');

    // 记录操作日志（管理员清除全站数据时）
    if (isAdmin) {
      await logAdminAction({
        adminId: userId,
        actionType: 'data_manage',
        actionName: 'clear_data',
        targetInfo: '全站数据',
        detail: {
          type: 'global_clear',
        },
        request,
      });
    }

    return NextResponse.json({
      success: true,
      message: isAdmin ? '全站数据已清除' : '您的数据已清除',
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('清除数据失败:', error);
    return NextResponse.json(
      { success: false, error: '清除数据失败' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}

/**
 * 清除单个用户的数据
 */
async function clearUserData(client: any, userId: string) {
  // 1. 删除图片历史并清理 S3 文件
  const imageResult = await client.query(
    'SELECT url FROM image_history WHERE user_id = $1',
    [userId]
  );
  for (const row of imageResult.rows) {
    if (row.url) {
      await deleteS3File(row.url).catch(() => {});
    }
  }
  await client.query('DELETE FROM image_history WHERE user_id = $1', [userId]);

  // 2. 删除视频历史并清理 S3 文件
  const videoResult = await client.query(
    'SELECT url FROM video_history WHERE user_id = $1',
    [userId]
  );
  for (const row of videoResult.rows) {
    if (row.url) {
      await deleteS3File(row.url).catch(() => {});
    }
  }
  await client.query('DELETE FROM video_history WHERE user_id = $1', [userId]);

  // 3. 删除角色图库并清理 S3 文件
  const characterResult = await client.query(
    'SELECT url FROM character_library WHERE user_id = $1',
    [userId]
  );
  for (const row of characterResult.rows) {
    if (row.url) {
      await deleteS3File(row.url).catch(() => {});
    }
  }
  await client.query('DELETE FROM character_library WHERE user_id = $1', [userId]);

  // 4. 删除产品图库并清理 S3 文件
  const productResult = await client.query(
    'SELECT images FROM products WHERE user_id = $1',
    [userId]
  );
  for (const row of productResult.rows) {
    const images = row.images;
    if (Array.isArray(images)) {
      for (const img of images) {
        if (img.url) {
          await deleteS3File(img.url).catch(() => {});
        }
      }
    }
  }
  await client.query('DELETE FROM products WHERE user_id = $1', [userId]);

  // 注意：不删除 usage_records（使用记录是消费凭证，应永久保留）
  
  // 6. 删除任务队列记录
  await client.query('DELETE FROM task_queue WHERE user_id = $1', [userId]);
  
  // 7. 删除短片项目（先清理 S3 文件）
  const projectResult = await client.query(
    'SELECT product_images, image_tasks, video_tasks FROM shortfilm_projects WHERE user_id = $1',
    [userId]
  );
  for (const row of projectResult.rows) {
    // 清理产品图片
    const productImages = row.product_images;
    if (Array.isArray(productImages)) {
      for (const img of productImages) {
        if (img.url || img.key) {
          await deleteS3File(img.url || extractKeyFromUrl(img.key || '')).catch(() => {});
        }
      }
    }
    
    // 清理生成的图片
    const imageTasks = row.image_tasks;
    if (Array.isArray(imageTasks)) {
      for (const task of imageTasks) {
        // 清理参考图
        if (task.referenceImages && Array.isArray(task.referenceImages)) {
          for (const refImg of task.referenceImages) {
            await deleteS3File(refImg).catch(() => {});
          }
        }
        
        // 清理生成的图片
        if (task.generatedImages && Array.isArray(task.generatedImages)) {
          for (const img of task.generatedImages) {
            if (img.url || img.key) {
              await deleteS3File(img.url || extractKeyFromUrl(img.key || '')).catch(() => {});
            }
          }
        }
      }
    }
    
    // 清理生成的视频
    const videoTasks = row.video_tasks;
    if (Array.isArray(videoTasks)) {
      for (const task of videoTasks) {
        if (task.generatedVideos && Array.isArray(task.generatedVideos)) {
          for (const vid of task.generatedVideos) {
            if (vid.url || vid.key) {
              await deleteS3File(vid.url || extractKeyFromUrl(vid.key || '')).catch(() => {});
            }
          }
        }
      }
    }
  }
  await client.query('DELETE FROM shortfilm_projects WHERE user_id = $1', [userId]);
  
  // 8. 删除用户创建的广告模板（不删除系统模板）
  await client.query('DELETE FROM shortfilm_templates WHERE user_id = $1 AND (is_system = false OR is_system IS NULL)', [userId]);
}

/**
 * 清除全站数据（管理员专用）
 */
async function clearGlobalData(client: any) {
  // 1. 删除所有图片历史并清理 S3 文件
  const imageResult = await client.query('SELECT url FROM image_history');
  for (const row of imageResult.rows) {
    if (row.url) {
      await deleteS3File(row.url).catch(() => {});
    }
  }
  await client.query('DELETE FROM image_history');

  // 2. 删除所有视频历史并清理 S3 文件
  const videoResult = await client.query('SELECT url FROM video_history');
  for (const row of videoResult.rows) {
    if (row.url) {
      await deleteS3File(row.url).catch(() => {});
    }
  }
  await client.query('DELETE FROM video_history');

  // 3. 删除所有角色图库并清理 S3 文件
  const characterResult = await client.query('SELECT url FROM character_library');
  for (const row of characterResult.rows) {
    if (row.url) {
      await deleteS3File(row.url).catch(() => {});
    }
  }
  await client.query('DELETE FROM character_library');

  // 4. 删除所有产品图库并清理 S3 文件
  const productResult = await client.query('SELECT images FROM products WHERE images IS NOT NULL');
  for (const row of productResult.rows) {
    const images = row.images;
    if (Array.isArray(images)) {
      for (const img of images) {
        if (img.url) {
          await deleteS3File(img.url).catch(() => {});
        }
      }
    }
  }
  await client.query('DELETE FROM products');

  // 注意：不删除 usage_records（使用记录是消费凭证，应永久保留）

  // 6. 删除所有任务队列记录
  await client.query('DELETE FROM task_queue');
  
  // 7. 删除所有短片项目（先清理 S3 文件）
  const projectResult = await client.query(
    'SELECT product_images, image_tasks, video_tasks FROM shortfilm_projects'
  );
  for (const row of projectResult.rows) {
    // 清理产品图片
    const productImages = row.product_images;
    if (Array.isArray(productImages)) {
      for (const img of productImages) {
        if (img.url || img.key) {
          await deleteS3File(img.url || extractKeyFromUrl(img.key || '')).catch(() => {});
        }
      }
    }
    
    // 清理生成的图片
    const imageTasks = row.image_tasks;
    if (Array.isArray(imageTasks)) {
      for (const task of imageTasks) {
        // 清理参考图
        if (task.referenceImages && Array.isArray(task.referenceImages)) {
          for (const refImg of task.referenceImages) {
            await deleteS3File(refImg).catch(() => {});
          }
        }
        
        // 清理生成的图片
        if (task.generatedImages && Array.isArray(task.generatedImages)) {
          for (const img of task.generatedImages) {
            if (img.url || img.key) {
              await deleteS3File(img.url || extractKeyFromUrl(img.key || '')).catch(() => {});
            }
          }
        }
      }
    }
    
    // 清理生成的视频
    const videoTasks = row.video_tasks;
    if (Array.isArray(videoTasks)) {
      for (const task of videoTasks) {
        if (task.generatedVideos && Array.isArray(task.generatedVideos)) {
          for (const vid of task.generatedVideos) {
            if (vid.url || vid.key) {
              await deleteS3File(vid.url || extractKeyFromUrl(vid.key || '')).catch(() => {});
            }
          }
        }
      }
    }
  }
  await client.query('DELETE FROM shortfilm_projects');
  
  // 8. 删除所有广告模板（保留系统模板）
  await client.query('DELETE FROM shortfilm_templates WHERE is_system = false OR is_system IS NULL');
}
