-- ============================================================
-- 性能优化索引 - 2024年
-- 基于查询模式分析添加缺失的索引
-- ============================================================

-- 1. 任务队列索引优化
-- 常用查询：按用户+状态筛选，按时间排序
CREATE INDEX IF NOT EXISTS task_queue_user_status_idx ON task_queue(user_id, status);
CREATE INDEX IF NOT EXISTS task_queue_status_idx ON task_queue(status);
CREATE INDEX IF NOT EXISTS task_queue_created_idx ON task_queue(created_at DESC);

-- 2. 历史记录时间索引（用于排序）
CREATE INDEX IF NOT EXISTS image_history_created_idx ON image_history(created_at DESC);
CREATE INDEX IF NOT EXISTS video_history_created_idx ON video_history(created_at DESC);

-- 3. 短片项目状态索引
CREATE INDEX IF NOT EXISTS shortfilm_projects_status_idx ON shortfilm_projects(status);
CREATE INDEX IF NOT EXISTS shortfilm_projects_user_status_idx ON shortfilm_projects(user_id, status);
CREATE INDEX IF NOT EXISTS shortfilm_projects_created_idx ON shortfilm_projects(created_at DESC);

-- 4. 短片模板时间索引
CREATE INDEX IF NOT EXISTS shortfilm_templates_created_idx ON shortfilm_templates(created_at DESC);

-- 5. 产品表时间索引
CREATE INDEX IF NOT EXISTS products_created_idx ON products(created_at DESC);

-- 6. 角色库时间索引
CREATE INDEX IF NOT EXISTS character_library_created_idx ON character_library(created_at DESC);

-- 7. 用户积分查询优化（按用户查询最新积分记录）
CREATE INDEX IF NOT EXISTS user_credits_user_idx ON user_credits(user_id);

-- 8. 使用记录时间索引（用于统计和清理）
CREATE INDEX IF NOT EXISTS usage_records_created_idx ON usage_records(created_at DESC);
