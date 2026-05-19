/**
 * 充值套餐管理 API
 * GET: 获取所有套餐
 * PUT: 更新套餐
 * POST: 新增套餐
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-middleware';
import { logAdminAction } from '@/lib/admin-log';
import { randomBytes } from 'crypto';
import { pool } from '@/lib/db-pool';

function generateId(): string {
  return `pkg_${Date.now()}_${randomBytes(4).toString('hex')}`;
}

/**
 * GET /api/admin/credit-packages
 * 获取所有充值套餐
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
    const result = await pool.query(`
      SELECT 
        id, name, credits, price, bonus_credits, description, is_active, sort_order, created_at, updated_at
      FROM credit_packages
      ORDER BY sort_order ASC, created_at ASC
    `);

    // 获取新用户赠送积分配置
    const bonusResult = await pool.query(
      "SELECT value FROM system_settings WHERE key = 'new_user_bonus_credits'"
    );
    const newUserBonusCredits = bonusResult.rows.length > 0
      ? parseInt(bonusResult.rows[0].value, 10) || 50
      : 50;

    return NextResponse.json({
      success: true,
      data: {
        packages: result.rows.map(row => ({
          id: row.id,
          name: row.name,
          credits: row.credits,
          price: row.price,
          bonusCredits: row.bonus_credits || 0,
          description: row.description,
          isActive: row.is_active,
          sortOrder: row.sort_order,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        })),
        newUserBonusCredits,
      },
    });
  } catch (error) {
    console.error('[Admin] 获取套餐列表失败:', error);
    return NextResponse.json(
      { success: false, error: '获取套餐列表失败' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/credit-packages
 * 更新套餐
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
    const body = await request.json();
    const { packages, newUserBonusCredits } = body;

    if (!Array.isArray(packages) && newUserBonusCredits === undefined) {
      return NextResponse.json(
        { success: false, error: '请提供套餐数据或新用户赠送积分' },
        { status: 400 }
      );
    }

    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // 更新套餐
      if (Array.isArray(packages)) {
        for (const pkg of packages) {
          if (!pkg.id) continue;

          // 验证数据
          if (pkg.credits < 0 || pkg.price < 0 || pkg.bonusCredits < 0) {
            await client.query('ROLLBACK');
            return NextResponse.json(
              { success: false, error: '积分、价格、赠送积分不能为负数' },
              { status: 400 }
            );
          }

          await client.query(`
            UPDATE credit_packages
            SET 
              name = $1,
              credits = $2,
              price = $3,
              bonus_credits = $4,
              description = $5,
              is_active = $6,
              sort_order = $7,
              updated_at = NOW()
            WHERE id = $8
          `, [
            pkg.name,
            pkg.credits,
            pkg.price,
            pkg.bonusCredits || 0,
            pkg.description || null,
            pkg.isActive !== false,
            pkg.sortOrder || 0,
            pkg.id,
          ]);
        }
      }

      // 更新新用户赠送积分
      if (newUserBonusCredits !== undefined) {
        if (newUserBonusCredits < 0) {
          await client.query('ROLLBACK');
          return NextResponse.json(
            { success: false, error: '新用户赠送积分不能为负数' },
            { status: 400 }
          );
        }

        await client.query(`
          INSERT INTO system_settings (key, value, description, updated_at)
          VALUES ('new_user_bonus_credits', $1, '新用户注册赠送积分', NOW())
          ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()
        `, [newUserBonusCredits.toString()]);
      }

      await client.query('COMMIT');

      // 记录操作日志
      await logAdminAction({
        adminId: authResult.userId,
        actionType: 'system_config',
        actionName: 'update_credit_packages',
        detail: { 
          packageCount: Array.isArray(packages) ? packages.length : 0,
          newUserBonusCredits,
        },
        request,
      });

      return NextResponse.json({
        success: true,
        message: '配置已保存',
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('[Admin] 更新套餐失败:', error);
    return NextResponse.json(
      { success: false, error: '更新套餐失败' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/credit-packages
 * 新增套餐
 */
export async function POST(request: NextRequest) {
  const authResult = await requireAdmin(request);
  if (!authResult.success) {
    return NextResponse.json(
      { success: false, error: authResult.error },
      { status: authResult.status }
    );
  }

  try {
    const body = await request.json();
    const { name, credits, price, bonusCredits, description, sortOrder } = body;

    // 验证必填字段
    if (!name || typeof credits !== 'number' || typeof price !== 'number') {
      return NextResponse.json(
        { success: false, error: '套餐名称、积分、价格为必填项' },
        { status: 400 }
      );
    }

    // 验证数值
    if (credits < 0 || price < 0 || (bonusCredits || 0) < 0) {
      return NextResponse.json(
        { success: false, error: '积分、价格、赠送积分不能为负数' },
        { status: 400 }
      );
    }

    const id = generateId();

    const result = await pool.query(`
      INSERT INTO credit_packages (id, name, credits, price, bonus_credits, description, is_active, sort_order, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, true, $7, NOW(), NOW())
      RETURNING *
    `, [
      id,
      name,
      credits,
      price,
      bonusCredits || 0,
      description || null,
      sortOrder || 0,
    ]);

    // 记录操作日志
    await logAdminAction({
      adminId: authResult.userId,
      actionType: 'system_config',
      actionName: 'create_credit_package',
      targetId: id,
      detail: { name, credits, price, bonusCredits: bonusCredits || 0 },
      request,
    });

    return NextResponse.json({
      success: true,
      data: {
        id,
        name,
        credits,
        price,
        bonusCredits: bonusCredits || 0,
        description,
        isActive: true,
        sortOrder: sortOrder || 0,
      },
    });
  } catch (error) {
    console.error('[Admin] 新增套餐失败:', error);
    return NextResponse.json(
      { success: false, error: '新增套餐失败' },
      { status: 500 }
    );
  }
}
