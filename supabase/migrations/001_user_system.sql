-- ============================================================
-- 用户系统迁移 SQL
-- 执行前请先备份数据库
-- ============================================================

-- ============================================================
-- 1. 创建新表
-- ============================================================

-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY,
  phone VARCHAR(32) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  nickname VARCHAR(64),
  avatar_url TEXT,
  role VARCHAR(32) DEFAULT 'user',
  status VARCHAR(32) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_login_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS users_status_idx ON users(status);

-- 用户积分表
CREATE TABLE IF NOT EXISTS user_credits (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  balance INTEGER DEFAULT 0 NOT NULL,
  total_purchased INTEGER DEFAULT 0 NOT NULL,
  total_used INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 积分套餐表
CREATE TABLE IF NOT EXISTS credit_packages (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(128) NOT NULL,
  credits INTEGER NOT NULL,
  price INTEGER NOT NULL,
  bonus_credits INTEGER DEFAULT 0,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS credit_packages_active_idx ON credit_packages(is_active, sort_order);

-- 积分订单表
CREATE TABLE IF NOT EXISTS credit_orders (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  package_id VARCHAR(64) REFERENCES credit_packages(id),
  credits INTEGER NOT NULL,
  amount INTEGER NOT NULL,
  payment_method VARCHAR(32),
  payment_status VARCHAR(32) DEFAULT 'pending',
  payment_transaction_id VARCHAR(128),
  admin_note TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS credit_orders_user_idx ON credit_orders(user_id, created_at);
CREATE INDEX IF NOT EXISTS credit_orders_status_idx ON credit_orders(payment_status, created_at);

-- 系统积分价格表
CREATE TABLE IF NOT EXISTS system_credit_prices (
  id VARCHAR(64) PRIMARY KEY,
  action_type VARCHAR(64) UNIQUE NOT NULL,
  credits_required INTEGER NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 使用记录表
CREATE TABLE IF NOT EXISTS usage_records (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action_type VARCHAR(64) NOT NULL,
  credits_used INTEGER NOT NULL,
  resource_id VARCHAR(64),
  resource_type VARCHAR(32),
  balance_before INTEGER,
  balance_after INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS usage_records_user_type_idx ON usage_records(user_id, action_type, created_at);

-- 登录日志表
CREATE TABLE IF NOT EXISTS auth_logs (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(32) NOT NULL,
  ip_address VARCHAR(64),
  user_agent TEXT,
  success BOOLEAN DEFAULT true,
  fail_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS auth_logs_user_idx ON auth_logs(user_id, created_at);
CREATE INDEX IF NOT EXISTS auth_logs_created_idx ON auth_logs(created_at);

-- 用户设置表
CREATE TABLE IF NOT EXISTS user_settings (
  user_id VARCHAR(64) PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  language VARCHAR(16) DEFAULT 'zh-CN',
  timezone VARCHAR(64) DEFAULT 'Asia/Shanghai',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 系统配置表
CREATE TABLE IF NOT EXISTS system_settings (
  key VARCHAR(64) PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 2. 视频复刻业务表（如尚未创建）
-- ============================================================

CREATE TABLE IF NOT EXISTS video_remake_projects (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(256) NOT NULL,
  source_type VARCHAR(16) NOT NULL,
  source_url TEXT,
  source_path TEXT,
  original_video_key TEXT,
  file_size INTEGER,
  video_duration INTEGER,
  parse_status VARCHAR(32) DEFAULT 'pending',
  parse_result JSONB,
  parse_error TEXT,
  script JSONB,
  customizations JSONB,
  merged_video_key TEXT,
  merged_video_url TEXT,
  merge_error TEXT,
  status VARCHAR(32) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS video_remake_scenes (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
  project_id VARCHAR(64) NOT NULL REFERENCES video_remake_projects(id) ON DELETE CASCADE,
  scene_index INTEGER NOT NULL,
  start_time INTEGER,
  end_time INTEGER,
  duration INTEGER,
  description TEXT,
  action_sequence JSONB,
  audio_text TEXT,
  audio_style TEXT,
  pace TEXT,
  visual_prompt TEXT,
  audio_prompt TEXT,
  speech_text TEXT,
  voice_over TEXT,
  background_music TEXT,
  generated_image_key TEXT,
  generated_image_url TEXT,
  generated_video_key TEXT,
  generated_video_url TEXT,
  video_key TEXT,
  video_url TEXT,
  video_file_size INTEGER,
  status VARCHAR(32) DEFAULT 'pending',
  video_status VARCHAR(32) DEFAULT 'pending',
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS video_remake_outputs (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
  project_id VARCHAR(64) NOT NULL REFERENCES video_remake_projects(id) ON DELETE CASCADE,
  output_type VARCHAR(32) NOT NULL,
  output_key TEXT,
  output_url TEXT,
  thumbnail_key TEXT,
  duration INTEGER,
  resolution VARCHAR(32),
  file_size INTEGER,
  metadata JSONB,
  status VARCHAR(32) DEFAULT 'completed',
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS video_remake_projects_user_idx ON video_remake_projects(user_id);
CREATE INDEX IF NOT EXISTS video_remake_projects_status_idx ON video_remake_projects(status);
CREATE INDEX IF NOT EXISTS video_remake_projects_parse_status_idx ON video_remake_projects(parse_status);
CREATE INDEX IF NOT EXISTS video_remake_projects_created_at_idx ON video_remake_projects(created_at);
CREATE INDEX IF NOT EXISTS video_remake_scenes_user_idx ON video_remake_scenes(user_id);
CREATE INDEX IF NOT EXISTS video_remake_scenes_project_idx ON video_remake_scenes(project_id, scene_index);
CREATE INDEX IF NOT EXISTS video_remake_scenes_status_idx ON video_remake_scenes(status);
CREATE INDEX IF NOT EXISTS video_remake_scenes_video_status_idx ON video_remake_scenes(video_status);
CREATE INDEX IF NOT EXISTS video_remake_outputs_user_idx ON video_remake_outputs(user_id);
CREATE INDEX IF NOT EXISTS video_remake_outputs_project_idx ON video_remake_outputs(project_id, created_at);
CREATE INDEX IF NOT EXISTS video_remake_outputs_created_at_idx ON video_remake_outputs(created_at);

-- ============================================================
-- 3. 现有表添加 user_id 字段
-- ============================================================

-- 任务队列表
ALTER TABLE task_queue ADD COLUMN IF NOT EXISTS user_id VARCHAR(64);
CREATE INDEX IF NOT EXISTS task_queue_user_idx ON task_queue(user_id);

-- 图片历史表
ALTER TABLE image_history ADD COLUMN IF NOT EXISTS user_id VARCHAR(64);
CREATE INDEX IF NOT EXISTS image_history_user_idx ON image_history(user_id);

-- 视频历史表
ALTER TABLE video_history ADD COLUMN IF NOT EXISTS user_id VARCHAR(64);
CREATE INDEX IF NOT EXISTS video_history_user_idx ON video_history(user_id);

-- 角色图库表
ALTER TABLE character_library ADD COLUMN IF NOT EXISTS user_id VARCHAR(64);
CREATE INDEX IF NOT EXISTS character_library_user_idx ON character_library(user_id);

-- 产品表
ALTER TABLE products ADD COLUMN IF NOT EXISTS user_id VARCHAR(64);
CREATE INDEX IF NOT EXISTS products_user_idx ON products(user_id);

-- 短片项目表
ALTER TABLE shortfilm_projects ADD COLUMN IF NOT EXISTS user_id VARCHAR(64);
CREATE INDEX IF NOT EXISTS shortfilm_projects_user_idx ON shortfilm_projects(user_id);

-- 短片模板表
ALTER TABLE shortfilm_templates ADD COLUMN IF NOT EXISTS user_id VARCHAR(64);
CREATE INDEX IF NOT EXISTS shortfilm_templates_user_idx ON shortfilm_templates(user_id);

-- 视频复刻项目表
ALTER TABLE video_remake_projects ADD COLUMN IF NOT EXISTS user_id VARCHAR(64);
CREATE INDEX IF NOT EXISTS video_remake_projects_user_idx ON video_remake_projects(user_id);

-- 视频复刻分镜表
ALTER TABLE video_remake_scenes ADD COLUMN IF NOT EXISTS user_id VARCHAR(64);
CREATE INDEX IF NOT EXISTS video_remake_scenes_user_idx ON video_remake_scenes(user_id);

-- 视频复刻输出表
ALTER TABLE video_remake_outputs ADD COLUMN IF NOT EXISTS user_id VARCHAR(64);
CREATE INDEX IF NOT EXISTS video_remake_outputs_user_idx ON video_remake_outputs(user_id);

-- 提示词模板表
ALTER TABLE prompt_templates ADD COLUMN IF NOT EXISTS user_id VARCHAR(64);
CREATE INDEX IF NOT EXISTS prompt_templates_user_idx ON prompt_templates(user_id);

-- 用户偏好表
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS user_id VARCHAR(64);
CREATE INDEX IF NOT EXISTS user_preferences_user_idx ON user_preferences(user_id);

-- 系统提示词配置表
ALTER TABLE system_prompt_config ADD COLUMN IF NOT EXISTS user_id VARCHAR(64);
CREATE INDEX IF NOT EXISTS system_prompt_config_user_idx ON system_prompt_config(user_id);

-- ============================================================
-- 3. 添加外键约束（可选，根据需要执行）
-- ============================================================

-- 注意：添加外键约束前，需要确保现有数据的 user_id 都有效
-- 或者先清空现有数据

-- ALTER TABLE task_queue ADD CONSTRAINT fk_task_queue_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
-- ALTER TABLE image_history ADD CONSTRAINT fk_image_history_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
-- ALTER TABLE video_history ADD CONSTRAINT fk_video_history_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
-- ALTER TABLE character_library ADD CONSTRAINT fk_character_library_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
-- ALTER TABLE products ADD CONSTRAINT fk_products_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
-- ALTER TABLE shortfilm_projects ADD CONSTRAINT fk_shortfilm_projects_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
-- ALTER TABLE shortfilm_templates ADD CONSTRAINT fk_shortfilm_templates_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
-- ALTER TABLE prompt_templates ADD CONSTRAINT fk_prompt_templates_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
-- ALTER TABLE user_preferences ADD CONSTRAINT fk_user_preferences_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- ============================================================
-- 4. 插入默认数据
-- ============================================================

-- 默认积分价格配置
INSERT INTO system_credit_prices (id, action_type, credits_required, description, is_active) VALUES
  ('price_1', 'image_generate', 5, '生成一张图片', true),
  ('price_2', 'video_generate', 20, '生成一个视频', true),
  ('price_3', 'video_trim', 10, '截取视频', true),
  ('price_4', 'video_concat', 10, '合并视频', true),
  ('price_5', 'storage_upload', 1, '上传存储（每MB）', true)
ON CONFLICT (action_type) DO NOTHING;

-- 默认积分套餐配置
INSERT INTO credit_packages (id, name, credits, price, bonus_credits, description, is_active, sort_order) VALUES
  ('pkg_1', '体验包', 100, 1000, 0, '适合初次体验用户', true, 1),
  ('pkg_2', '标准包', 500, 4500, 50, '日常使用首选', true, 2),
  ('pkg_3', '超值包', 1000, 8000, 150, '赠送150积分', true, 3),
  ('pkg_4', '企业包', 5000, 35000, 1000, '适合企业用户', true, 4),
  ('pkg_5', '旗舰包', 10000, 60000, 3000, '最高性价比', true, 5)
ON CONFLICT (id) DO NOTHING;

-- 系统配置：新用户注册赠送积分
INSERT INTO system_settings (key, value, description) VALUES
  ('new_user_bonus_credits', '50', '新用户注册赠送积分'),
  ('jwt_secret', '', 'JWT 密钥（启动时自动生成）'),
  ('jwt_expires_days', '7', 'JWT 过期天数')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- 5. 管理员账号
-- ============================================================
-- 管理员账号通过环境变量配置：
-- ADMIN_PHONE: 管理员手机号
-- ADMIN_PASSWORD: 管理员密码
-- 
-- 启动时系统会自动检查并创建管理员账号
-- 首次登录时需要强制修改密码
-- ============================================================

-- ============================================================
-- 迁移完成
-- ============================================================
