/**
 * 管理员操作日志 - 客户端工具函数
 * 此文件不包含任何 Node.js 依赖，可安全在客户端使用
 */

// 操作类型
export type AdminActionType = 'user_manage' | 'system_settings' | 'data_manage' | 'system_config';

// 操作动作
export type AdminActionName = 
  | 'freeze' 
  | 'unfreeze' 
  | 'adjust_credits' 
  | 'update_settings'
  | 'clear_data'
  | 'clear_user_data'
  | 'update_credit_packages'
  | 'create_credit_package'
  | 'deactivate_credit_package'
  | 'delete_credit_package'
  | 'update_credit_prices'
  | 'create_credit_price'
  | 'update_storage_config';

// 日志详情类型
export interface AdminLogDetail {
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  reason?: string;
  amount?: number;
  type?: 'add' | 'deduct' | 'system_prompt' | 'system_prompt_shortfilm' | 'system_prompt_video_remake' | 'system_prompt_analysis_master' | 'system_prompt_analysis_master_script_remake' | 'set_default_prompt' | 'set_default_prompt_shortfilm' | 'set_default_prompt_video_remake' | 'set_default_prompt_analysis_master' | 'set_default_prompt_analysis_master_script_remake' | 'reset_prompt' | 'reset_prompt_shortfilm' | 'reset_prompt_video_remake' | 'reset_prompt_analysis_master' | 'reset_prompt_analysis_master_script_remake' | 'global_clear';
  [key: string]: unknown;
}

/**
 * 获取操作类型的中文名称
 */
export function getActionTypeName(actionType: string): string {
  const names: Record<string, string> = {
    user_manage: '用户管理',
    system_settings: '系统设置',
    data_manage: '数据管理',
    system_config: '系统配置',
  };
  return names[actionType] || actionType;
}

/**
 * 获取操作动作的中文名称
 */
export function getActionDisplayName(actionName: string): string {
  const names: Record<string, string> = {
    freeze: '冻结用户',
    unfreeze: '解冻用户',
    adjust_credits: '调整积分',
    update_settings: '修改系统设置',
    clear_data: '清除全站数据',
    clear_user_data: '清除用户数据',
    update_credit_packages: '更新充值套餐',
    create_credit_package: '新增充值套餐',
    deactivate_credit_package: '禁用充值套餐',
    delete_credit_package: '删除充值套餐',
    update_credit_prices: '更新积分价格',
    create_credit_price: '新增积分价格',
    update_storage_config: '更新存储配置',
  };
  return names[actionName] || actionName;
}
