-- ============================================================
-- 管理员操作日志表迁移
-- ============================================================

-- 创建管理员操作日志表
CREATE TABLE IF NOT EXISTS admin_logs (
  id SERIAL PRIMARY KEY,
  admin_id TEXT NOT NULL REFERENCES users(id),
  action_type TEXT NOT NULL,           -- 操作类型: user_manage, system_settings
  action_name TEXT NOT NULL,           -- 操作动作: freeze, unfreeze, adjust_credits, update_settings
  target_id TEXT,                       -- 操作目标ID（如被操作的用户ID）
  target_info TEXT,                     -- 操作目标信息（如用户昵称、手机号）
  detail JSONB,                         -- 操作详情（JSON格式）
  ip_address TEXT,                      -- 操作IP地址
  user_agent TEXT,                      -- 浏览器UA
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引优化查询
CREATE INDEX IF NOT EXISTS idx_admin_logs_admin_id ON admin_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_logs_action_type ON admin_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_admin_logs_created_at ON admin_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_logs_target_id ON admin_logs(target_id);

-- ============================================================
-- 操作类型说明：
-- action_type:
--   - user_manage: 用户管理操作
--   - system_settings: 系统设置操作
--
-- action_name:
--   - freeze: 冻结用户
--   - unfreeze: 解冻用户
--   - adjust_credits: 调整积分
--   - update_settings: 修改系统设置
--   - clear_data: 清除数据
--
-- detail 示例:
-- {
--   "before": {"status": "active"},
--   "after": {"status": "frozen"},
--   "reason": "违规操作"
-- }
-- ============================================================
