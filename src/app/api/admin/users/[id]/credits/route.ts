import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-middleware';
import { logAdminAction } from '@/lib/admin-log';
import { randomBytes } from 'crypto';
import { pool } from '@/lib/db-pool';

// 生成唯一 ID
function generateId(): string {
  return `${Date.now()}_${randomBytes(4).toString('hex')}`;
}

/**
 * PUT /api/admin/users/[id]/credits
 * 调整用户积分（管理员专用）
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // 验证管理员权限
  const authResult = await requireAdmin(request);
  if (!authResult.success) {
    return NextResponse.json(
      { success: false, error: authResult.error },
      { status: authResult.status }
    );
  }

  const client = await pool.connect();
  let transactionStarted = false;

  try {
    const { id: userId } = await params;
    const body = await request.json();
    const { amount, type, reason } = body;

    // 验证参数
    if (typeof amount !== 'number' || amount === 0) {
      return NextResponse.json(
        { success: false, error: '积分变动数量必须为非零数字' },
        { status: 400 }
      );
    }

    if (!['add', 'deduct'].includes(type)) {
      return NextResponse.json(
        { success: false, error: '类型必须是 add 或 deduct' },
        { status: 400 }
      );
    }

    // 扣减时确保金额为负数
    const actualAmount = type === 'deduct' ? -Math.abs(amount) : Math.abs(amount);

    // 检查用户是否存在
    const userResult = await client.query(
      'SELECT id, phone, nickname FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: '用户不存在' },
        { status: 404 }
      );
    }

    const targetUser = userResult.rows[0];

    await client.query('BEGIN');
    transactionStarted = true;

    try {
      // 获取当前积分
      const creditsResult = await client.query(
        'SELECT balance FROM user_credits WHERE user_id = $1 FOR UPDATE',
        [userId]
      );

      let currentBalance = 0;
      if (creditsResult.rows.length === 0) {
        // 创建积分账户
        await client.query(
          `INSERT INTO user_credits (id, user_id, balance, total_purchased, total_used, created_at, updated_at)
           VALUES ($1, $2, 0, 0, 0, NOW(), NOW())`,
          [`credits_${generateId()}`, userId]
        );
      } else {
        currentBalance = creditsResult.rows[0]?.balance || 0;
      }

      const newBalance = currentBalance + actualAmount;

      // 扣减时检查余额是否足够
      if (newBalance < 0) {
        await client.query('ROLLBACK');
        return NextResponse.json(
          { success: false, error: `积分不足，当前余额 ${currentBalance}` },
          { status: 400 }
        );
      }

      // 更新积分
      await client.query(
        `UPDATE user_credits 
         SET balance = $1, 
             total_purchased = total_purchased + CASE WHEN $2 > 0 THEN $2 ELSE 0 END,
             total_used = total_used + CASE WHEN $2 < 0 THEN ABS($2) ELSE 0 END,
             updated_at = NOW()
         WHERE user_id = $3`,
        [newBalance, actualAmount, userId]
      );

      // 记录交易（当前数据库未使用 credit_transactions 表，跳过明细写入）

      // 记录到 usage_records（用户操作记录）
      await client.query(
        `INSERT INTO usage_records (id, user_id, action_type, credits_used, resource_id, resource_type, balance_before, balance_after, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
        [
          `usage_${generateId()}`,
          userId,
          actualAmount > 0 ? 'admin_add_credits' : 'admin_deduct_credits',
          Math.abs(actualAmount),
          null,
          null,
          currentBalance,
          newBalance,
        ]
      );

      await client.query('COMMIT');

      // 记录操作日志
      await logAdminAction({
        adminId: authResult.userId,
        actionType: 'user_manage',
        actionName: 'adjust_credits',
        targetId: userId,
        targetInfo: `${targetUser.nickname || ''} (${targetUser.phone})`,
        detail: {
          amount: actualAmount,
          type: type,
          reason: reason || undefined,
          previousBalance: currentBalance,
          newBalance,
        },
        request,
      });

      return NextResponse.json({
        success: true,
        message: actualAmount > 0 ? `已增加 ${Math.abs(actualAmount)} 积分` : `已扣减 ${Math.abs(actualAmount)} 积分`,
        data: {
          previousBalance: currentBalance,
          change: actualAmount,
          newBalance,
        },
      });
    } catch (err) {
      if (transactionStarted) {
        await client.query('ROLLBACK');
      }
      throw err;
    }
  } catch (error) {
    console.error('调整积分失败:', error);
    return NextResponse.json(
      { success: false, error: '调整积分失败' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
