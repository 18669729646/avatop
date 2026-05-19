/**
 * 客服二维码管理 API
 * GET: 获取客服二维码配置
 * PUT: 更新客服二维码
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-middleware';
import { logAdminAction } from '@/lib/admin-log';
import { URL_EXPIRE_TIME } from '@/lib/storage-types';
import { pool } from '@/lib/db-pool';
import { s3Storage } from '@/lib/s3-client';

// 从 URL 中提取存储 key
function extractKeyFromUrl(url: string): string | null {
  if (!url) return null;
  try {
    const urlObj = new URL(url);
    return urlObj.pathname.substring(1);
  } catch {
    return null;
  }
}

// 删除旧的 S3 文件
async function deleteS3File(url: string): Promise<boolean> {
  const bucketName = process.env.COZE_BUCKET_NAME;
  const key = extractKeyFromUrl(url);
  if (!bucketName || !key) return false;

  try {
    await s3Storage.deleteFile(key);
    return true;
  } catch (error) {
    console.error(`删除 S3 文件失败: ${key}`, error);
    return false;
  }
}

/**
 * GET /api/admin/customer-service
 * 获取客服二维码配置
 */
export async function GET(request: NextRequest) {
  const authResult = await requireAdmin(request);
  if (!authResult.success) {
    return NextResponse.json(
      { success: false, error: authResult.error },
      { status: authResult.status }
    );
  }

  try {
    // 获取客服二维码 key
    const qrResult = await pool.query(
      "SELECT value, updated_at FROM system_settings WHERE key = 'customer_service_qrcode'"
    );
    
    // 如果存储的是 key，生成签名 URL
    let qrcodeUrl = qrResult.rows[0]?.value || '';
    if (qrcodeUrl && !qrcodeUrl.startsWith('http')) {
      // 存储的是 key，生成签名 URL
      try {
        qrcodeUrl = await s3Storage.generatePresignedUrl({
          key: qrcodeUrl,
          expireTime: URL_EXPIRE_TIME,
        });
      } catch (e) {
        console.error('[Admin] 生成二维码URL失败:', e);
        qrcodeUrl = '';
      }
    }

    // 获取客服微信号
    const wechatResult = await pool.query(
      "SELECT value FROM system_settings WHERE key = 'customer_service_wechat'"
    );

    // 获取客服电话
    const phoneResult = await pool.query(
      "SELECT value FROM system_settings WHERE key = 'customer_service_phone'"
    );

    // 获取客服说明
    const descResult = await pool.query(
      "SELECT value FROM system_settings WHERE key = 'customer_service_description'"
    );

    return NextResponse.json({
      success: true,
      data: {
        qrcodeUrl,
        qrcodeUpdatedAt: qrResult.rows[0]?.updated_at || null,
        wechatId: wechatResult.rows[0]?.value || '',
        phone: phoneResult.rows[0]?.value || '',
        description: descResult.rows[0]?.value || '',
      },
    });
  } catch (error) {
    console.error('[Admin] 获取客服配置失败:', error);
    return NextResponse.json(
      { success: false, error: '获取客服配置失败' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/customer-service
 * 更新客服二维码配置
 */
export async function PUT(request: NextRequest) {
  const authResult = await requireAdmin(request);
  if (!authResult.success) {
    return NextResponse.json(
      { success: false, error: authResult.error },
      { status: authResult.status }
    );
  }

  try {
    const formData = await request.formData();
    
    const qrcodeFile = formData.get('qrcode') as File | null;
    const wechatId = formData.get('wechatId') as string | null;
    const phone = formData.get('phone') as string | null;
    const description = formData.get('description') as string | null;

    // 至少需要更新一项
    if (!qrcodeFile && !wechatId && !phone && description === null) {
      return NextResponse.json(
        { success: false, error: '请提供要更新的内容' },
        { status: 400 }
      );
    }

    const client = await pool.connect();
    let newQrcodeUrl = '';

    try {
      await client.query('BEGIN');

      // 处理二维码图片上传
      if (qrcodeFile && qrcodeFile.size > 0) {
        // 验证文件类型
        if (!qrcodeFile.type.startsWith('image/')) {
          await client.query('ROLLBACK');
          return NextResponse.json(
            { success: false, error: '只支持图片文件' },
            { status: 400 }
          );
        }

        // 获取旧的二维码 URL 并删除
        const oldQrResult = await client.query(
          "SELECT value FROM system_settings WHERE key = 'customer_service_qrcode'"
        );
        if (oldQrResult.rows[0]?.value) {
          await deleteS3File(oldQrResult.rows[0].value);
        }

        // 读取文件内容
        const arrayBuffer = await qrcodeFile.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const contentType = qrcodeFile.type || 'image/jpeg';

        // 生成文件名
        const timestamp = Date.now();
        const ext = contentType.split('/')[1] || 'jpg';
        const fileName = `customer-service/qrcode_${timestamp}.${ext}`;

        // 上传到对象存储
        let uploadedKey: string;
        try {
          uploadedKey = await s3Storage.uploadFile({
            fileContent: buffer,
            fileName,
            contentType,
          });
          console.log('[Admin] 客服二维码上传成功, key:', uploadedKey);
        } catch (uploadError) {
          console.error('[Admin] 客服二维码上传失败:', uploadError);
          await client.query('ROLLBACK');
          return NextResponse.json(
            { success: false, error: `图片上传失败: ${uploadError instanceof Error ? uploadError.message : '未知错误'}` },
            { status: 500 }
          );
        }

        // 生成访问 URL（用于返回给前端显示）
        try {
          newQrcodeUrl = await s3Storage.generatePresignedUrl({
            key: uploadedKey,
            expireTime: URL_EXPIRE_TIME,
          });
        } catch (urlError) {
          console.error('[Admin] 生成签名URL失败:', urlError);
          await client.query('ROLLBACK');
          return NextResponse.json(
            { success: false, error: `生成访问链接失败: ${urlError instanceof Error ? urlError.message : '未知错误'}` },
            { status: 500 }
          );
        }

        // 保存 key 到数据库（而不是签名 URL）
        await client.query(`
          INSERT INTO system_settings (key, value, description, updated_at)
          VALUES ('customer_service_qrcode', $1, '客服微信二维码Key', NOW())
          ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()
        `, [uploadedKey]);
      }

      // 更新微信号
      if (wechatId !== null) {
        await client.query(`
          INSERT INTO system_settings (key, value, description, updated_at)
          VALUES ('customer_service_wechat', $1, '客服微信号', NOW())
          ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()
        `, [wechatId]);
      }

      // 更新电话
      if (phone !== null) {
        await client.query(`
          INSERT INTO system_settings (key, value, description, updated_at)
          VALUES ('customer_service_phone', $1, '客服电话', NOW())
          ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()
        `, [phone]);
      }

      // 更新说明
      if (description !== null) {
        await client.query(`
          INSERT INTO system_settings (key, value, description, updated_at)
          VALUES ('customer_service_description', $1, '客服联系说明', NOW())
          ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()
        `, [description]);
      }

      await client.query('COMMIT');

      // 记录操作日志
      await logAdminAction({
        adminId: authResult.userId,
        actionType: 'system_settings',
        actionName: 'update_settings',
        detail: {
          updatedQrcode: !!qrcodeFile,
          updatedWechatId: !!wechatId,
          updatedPhone: !!phone,
          updatedDescription: description !== null,
        },
        request,
      });

      return NextResponse.json({
        success: true,
        message: '客服配置已更新',
        data: newQrcodeUrl ? { qrcodeUrl: newQrcodeUrl } : undefined,
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('[Admin] 更新客服配置失败:', error);
    const errorMessage = error instanceof Error ? error.message : '更新客服配置失败';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
