/**
 * 客服信息公开 API
 * GET: 获取客服联系信息（无需登录）
 */

import { NextRequest, NextResponse } from 'next/server';
import { URL_EXPIRE_TIME } from '@/lib/storage-types';
import { pool } from '@/lib/db-pool';
import { s3Storage } from '@/lib/s3-client';

/**
 * GET /api/customer-service
 * 获取客服联系信息（公开接口）
 */
export async function GET(request: NextRequest) {
  try {
    // 获取客服二维码 key
    const qrResult = await pool.query(
      "SELECT value, updated_at FROM system_settings WHERE key = 'customer_service_qrcode'"
    );

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

    // 如果没有任何配置，返回默认信息
    const hasConfig = qrResult.rows.length > 0 || wechatResult.rows.length > 0 
      || phoneResult.rows.length > 0 || descResult.rows.length > 0;

    if (!hasConfig) {
      return NextResponse.json({
        success: true,
        data: {
          qrcodeUrl: '/wechat-qrcode.jpg', // 默认静态图片
          wechatId: '',
          phone: '',
          description: '扫描二维码添加客服微信，转账后即可充值积分',
        },
      });
    }

    // 处理二维码 URL
    let qrcodeUrl = qrResult.rows[0]?.value || '/wechat-qrcode.jpg';
    
    // 如果存储的是 key（不以 http 开头），生成签名 URL
    if (qrcodeUrl && !qrcodeUrl.startsWith('http') && !qrcodeUrl.startsWith('/')) {
      try {
        qrcodeUrl = await s3Storage.generatePresignedUrl({
          key: qrcodeUrl,
          expireTime: URL_EXPIRE_TIME,
        });
      } catch (e) {
        console.error('[Customer Service] 生成二维码URL失败:', e);
        qrcodeUrl = '/wechat-qrcode.jpg';
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        qrcodeUrl,
        wechatId: wechatResult.rows[0]?.value || '',
        phone: phoneResult.rows[0]?.value || '',
        description: descResult.rows[0]?.value || '扫描二维码添加客服微信，转账后即可充值积分',
      },
    });
  } catch (error) {
    console.error('获取客服信息失败:', error);
    return NextResponse.json(
      { success: false, error: '获取客服信息失败' },
      { status: 500 }
    );
  }
}
