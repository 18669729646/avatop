/**
 * 积分服务
 */

import { getSupabaseClient } from '@/storage/database/supabase-client';
import { randomUUID } from 'crypto';
import { pool } from '@/lib/db-pool';

// 积分价格类型
export interface CreditPrice {
  id: string;
  actionType: string;
  creditsRequired: number;
  description: string | null;
  isActive: boolean;
}

// 积分套餐类型
export interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  price: number;
  bonusCredits: number;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
}

// 使用记录类型
export interface UsageRecord {
  id: string;
  userId: string;
  actionType: string;
  creditsUsed: number;
  resourceId: string | null;
  resourceType: string | null;
  balanceBefore: number;
  balanceAfter: number;
  createdAt: string;
}

/**
 * 获取用户积分余额
 */
export async function getUserCredits(userId: string): Promise<{
  balance: number;
  totalPurchased: number;
  totalUsed: number;
}> {
  const client = getSupabaseClient();
  
  const { data, error } = await client
    .from('user_credits')
    .select('*')
    .eq('user_id', userId)
    .single();
  
  if (error || !data) {
    return { balance: 0, totalPurchased: 0, totalUsed: 0 };
  }
  
  return {
    balance: data.balance || 0,
    totalPurchased: data.total_purchased || 0,
    totalUsed: data.total_used || 0,
  };
}

/**
 * 获取积分价格配置
 */
export async function getCreditPrice(actionType: string): Promise<CreditPrice | null> {
  const client = getSupabaseClient();
  
  const { data, error } = await client
    .from('system_credit_prices')
    .select('*')
    .eq('action_type', actionType)
    .eq('is_active', true)
    .single();
  
  if (error || !data) return null;
  
  return {
    id: data.id,
    actionType: data.action_type,
    creditsRequired: data.credits_required,
    description: data.description,
    isActive: data.is_active,
  };
}

/**
 * 获取所有积分价格配置
 */
export async function getAllCreditPrices(): Promise<Record<string, number>> {
  const client = getSupabaseClient();
  
  const { data, error } = await client
    .from('system_credit_prices')
    .select('*')
    .eq('is_active', true);
  
  if (error || !data) return {};
  
  const prices: Record<string, number> = {};
  for (const item of data) {
    prices[item.action_type] = item.credits_required;
  }
  
  return prices;
}

/**
 * 检查用户是否有足够积分
 */
export async function checkUserCredits(userId: string, requiredCredits: number): Promise<{
  hasEnough: boolean;
  balance: number;
  required: number;
}> {
  const credits = await getUserCredits(userId);
  
  return {
    hasEnough: credits.balance >= requiredCredits,
    balance: credits.balance,
    required: requiredCredits,
  };
}

/**
 * 消耗积分（使用事务和行级锁防止并发超扣）
 * 同时检查 resourceId 是否已扣除过，防止重复扣积分
 */
export async function consumeCredits(
  userId: string,
  actionType: string,
  resourceId?: string,
  resourceType?: string
): Promise<{
  success: boolean;
  creditsUsed: number;
  balanceBefore: number;
  balanceAfter: number;
  error?: string;
  skipped?: boolean; // 是否跳过（已扣除过）
}> {
  // 获取积分价格
  const price = await getCreditPrice(actionType);
  if (!price) {
    return {
      success: false,
      creditsUsed: 0,
      balanceBefore: 0,
      balanceAfter: 0,
      error: `未知的操作类型: ${actionType}`,
    };
  }
  
  const creditsRequired = price.creditsRequired;
  
  // 使用事务和行级锁
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // 检查是否已经为该资源扣除过积分（防重复）
    if (resourceId) {
      const existingRecord = await client.query(
        'SELECT id, credits_used FROM usage_records WHERE user_id = $1 AND resource_id = $2 AND action_type = $3',
        [userId, resourceId, actionType]
      );
      
      if (existingRecord.rows.length > 0) {
        await client.query('ROLLBACK');
        console.log(`[Credits] 资源 ${resourceId} 已扣除过积分，跳过重复扣除`);
        return {
          success: true,
          creditsUsed: existingRecord.rows[0].credits_used,
          balanceBefore: 0,
          balanceAfter: 0,
          skipped: true,
        };
      }
    }
    
    // 获取当前余额并加锁（FOR UPDATE）
    const creditsResult = await client.query(
      'SELECT balance, total_used FROM user_credits WHERE user_id = $1 FOR UPDATE',
      [userId]
    );
    
    if (creditsResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return {
        success: false,
        creditsUsed: creditsRequired,
        balanceBefore: 0,
        balanceAfter: 0,
        error: '积分账户不存在',
      };
    }
    
    const balanceBefore = creditsResult.rows[0].balance;
    const totalUsed = creditsResult.rows[0].total_used;
    
    // 检查余额是否足够
    if (balanceBefore < creditsRequired) {
      await client.query('ROLLBACK');
      return {
        success: false,
        creditsUsed: creditsRequired,
        balanceBefore,
        balanceAfter: balanceBefore,
        error: '积分不足',
      };
    }
    
    const balanceAfter = balanceBefore - creditsRequired;
    
    // 更新积分余额
    await client.query(
      'UPDATE user_credits SET balance = $1, total_used = $2, updated_at = NOW() WHERE user_id = $3',
      [balanceAfter, totalUsed + creditsRequired, userId]
    );
    
    // 记录使用日志
    await client.query(
      `INSERT INTO usage_records (id, user_id, action_type, credits_used, resource_id, resource_type, balance_before, balance_after, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
      [
        `usage_${randomUUID()}`,
        userId,
        actionType,
        creditsRequired,
        resourceId || null,
        resourceType || null,
        balanceBefore,
        balanceAfter,
      ]
    );
    
    await client.query('COMMIT');
    
    return {
      success: true,
      creditsUsed: creditsRequired,
      balanceBefore,
      balanceAfter,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[Credits] 消耗积分失败:', error);
    return {
      success: false,
      creditsUsed: creditsRequired,
      balanceBefore: 0,
      balanceAfter: 0,
      error: '扣除积分失败',
    };
  } finally {
    client.release();
  }
}

/**
 * 充值积分
 */
export async function consumeFixedCredits(
  userId: string,
  actionType: string,
  creditsRequired: number,
  resourceId?: string,
  resourceType?: string
): Promise<{
  success: boolean;
  creditsUsed: number;
  balanceBefore: number;
  balanceAfter: number;
  error?: string;
  skipped?: boolean;
}> {
  if (!Number.isFinite(creditsRequired) || creditsRequired <= 0) {
    return {
      success: false,
      creditsUsed: 0,
      balanceBefore: 0,
      balanceAfter: 0,
      error: '无效的积分数量',
    };
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    if (resourceId) {
      const existingRecord = await client.query(
        'SELECT id, credits_used FROM usage_records WHERE user_id = $1 AND resource_id = $2 AND action_type = $3',
        [userId, resourceId, actionType]
      );

      if (existingRecord.rows.length > 0) {
        await client.query('ROLLBACK');
        console.log(`[Credits] 资源 ${resourceId} 已扣除过积分，跳过重复扣除`);
        return {
          success: true,
          creditsUsed: existingRecord.rows[0].credits_used,
          balanceBefore: 0,
          balanceAfter: 0,
          skipped: true,
        };
      }
    }

    const creditsResult = await client.query(
      'SELECT balance, total_used FROM user_credits WHERE user_id = $1 FOR UPDATE',
      [userId]
    );

    if (creditsResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return {
        success: false,
        creditsUsed: creditsRequired,
        balanceBefore: 0,
        balanceAfter: 0,
        error: '积分账户不存在',
      };
    }

    const balanceBefore = creditsResult.rows[0].balance;
    const totalUsed = creditsResult.rows[0].total_used;

    if (balanceBefore < creditsRequired) {
      await client.query('ROLLBACK');
      return {
        success: false,
        creditsUsed: creditsRequired,
        balanceBefore,
        balanceAfter: balanceBefore,
        error: '积分不足',
      };
    }

    const balanceAfter = balanceBefore - creditsRequired;

    await client.query(
      'UPDATE user_credits SET balance = $1, total_used = $2, updated_at = NOW() WHERE user_id = $3',
      [balanceAfter, totalUsed + creditsRequired, userId]
    );

    await client.query(
      `INSERT INTO usage_records (id, user_id, action_type, credits_used, resource_id, resource_type, balance_before, balance_after, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
      [
        `usage_${randomUUID()}`,
        userId,
        actionType,
        creditsRequired,
        resourceId || null,
        resourceType || null,
        balanceBefore,
        balanceAfter,
      ]
    );

    await client.query('COMMIT');

    return {
      success: true,
      creditsUsed: creditsRequired,
      balanceBefore,
      balanceAfter,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[Credits] 固定积分扣除失败:', error);
    return {
      success: false,
      creditsUsed: creditsRequired,
      balanceBefore: 0,
      balanceAfter: 0,
      error: '扣除积分失败',
    };
  } finally {
    client.release();
  }
}

export async function rechargeCredits(
  userId: string,
  credits: number,
  orderId?: string
): Promise<{
  success: boolean;
  balanceBefore: number;
  balanceAfter: number;
  error?: string;
}> {
  const pgClient = await pool.connect();

  try {
    await pgClient.query('BEGIN');

    const creditsResult = await pgClient.query(
      'SELECT balance, total_purchased FROM user_credits WHERE user_id = $1 FOR UPDATE',
      [userId]
    );

    if (creditsResult.rows.length === 0) {
      await pgClient.query('ROLLBACK');
      return {
        success: false,
        balanceBefore: 0,
        balanceAfter: 0,
        error: '积分账户不存在',
      };
    }

    const balanceBeforeValue = creditsResult.rows[0].balance;
    const totalPurchasedValue = creditsResult.rows[0].total_purchased;

    const balanceAfter = balanceBeforeValue + credits;

    await pgClient.query(
      'UPDATE user_credits SET balance = $1, total_purchased = $2, updated_at = NOW() WHERE user_id = $3',
      [balanceAfter, totalPurchasedValue + credits, userId]
    );

    await pgClient.query(
      `INSERT INTO usage_records (id, user_id, action_type, credits_used, resource_id, resource_type, balance_before, balance_after, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
      [
        `usage_${randomUUID()}`,
        userId,
        'recharge',
        credits,
        orderId || null,
        'recharge',
        balanceBeforeValue,
        balanceAfter,
      ]
    );

    await pgClient.query('COMMIT');

    return {
      success: true,
      balanceBefore: balanceBeforeValue,
      balanceAfter,
    };
  } catch (error) {
    await pgClient.query('ROLLBACK');
    console.error('[Credits] 充值积分失败:', error);
    return {
      success: false,
      balanceBefore: 0,
      balanceAfter: 0,
      error: '充值积分失败',
    };
  } finally {
    pgClient.release();
  }
}

/**
 * 获取积分套餐列表
 */
export async function getCreditPackages(): Promise<CreditPackage[]> {
  const client = getSupabaseClient();
  
  const { data, error } = await client
    .from('credit_packages')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });
  
  if (error || !data) return [];
  
  return data.map(item => ({
    id: item.id,
    name: item.name,
    credits: item.credits,
    price: item.price,
    bonusCredits: item.bonus_credits || 0,
    description: item.description,
    isActive: item.is_active,
    sortOrder: item.sort_order,
  }));
}

/**
 * 获取用户使用记录
 */
export async function getUserUsageRecords(
  userId: string,
  limit: number = 50,
  offset: number = 0
): Promise<UsageRecord[]> {
  const client = getSupabaseClient();
  
  const { data, error } = await client
    .from('usage_records')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  
  if (error || !data) return [];
  
  return data.map(item => ({
    id: item.id,
    userId: item.user_id,
    actionType: item.action_type,
    creditsUsed: item.credits_used,
    resourceId: item.resource_id,
    resourceType: item.resource_type,
    balanceBefore: item.balance_before,
    balanceAfter: item.balance_after,
    createdAt: item.created_at,
  }));
}
