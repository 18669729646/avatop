-- ============================================================
-- 管理员密码安全改造迁移
-- ============================================================

-- 1. 添加 force_change_password 字段
-- 标记用户是否需要在下次登录时强制修改密码
ALTER TABLE users ADD COLUMN IF NOT EXISTS force_change_password BOOLEAN DEFAULT false;

-- 2. 添加 password_changed_at 字段
-- 记录用户最后修改密码的时间
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ;

-- 3. 为现有管理员设置强制修改密码标志（如果存在）
-- 原硬编码的管理员需要在下次登录时修改密码
UPDATE users 
SET force_change_password = true 
WHERE phone = '13800000000' AND role = 'admin' AND password_changed_at IS NULL;

-- ============================================================
-- 说明：
-- 1. 新创建的管理员（通过环境变量初始化）会自动设置 force_change_password = true
-- 2. 用户修改密码后会自动设置 force_change_password = false 和 password_changed_at = NOW()
-- 3. 管理员首次登录时会被强制跳转到修改密码页面
-- ============================================================
