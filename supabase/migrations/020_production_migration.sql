-- ============================================================
-- 生产环境合并迁移脚本
-- 包含所有缺失的迁移，按顺序执行
-- ============================================================

-- 1. 创建分析大师脚本复刻表 (来自 015_analysis_master_script_remake_price.sql)
CREATE TABLE IF NOT EXISTS analysis_master_script_remakes (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id VARCHAR(64) NOT NULL REFERENCES analysis_master_projects(id) ON DELETE CASCADE,
  product_id VARCHAR(64) NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  language VARCHAR(16) DEFAULT 'en-US',
  status VARCHAR(32) NOT NULL DEFAULT 'completed',
  title TEXT,
  hook TEXT,
  pain_point TEXT,
  selling_point_script TEXT,
  cta TEXT,
  full_script TEXT,
  full_script_cn TEXT,
  segments JSONB DEFAULT '[]'::jsonb,
  shooting_notes TEXT,
  visual_notes TEXT,
  compliance_notes TEXT,
  product_snapshot JSONB,
  analysis_snapshot JSONB,
  raw_result JSONB,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS analysis_master_script_remakes_user_idx ON analysis_master_script_remakes(user_id, created_at);
CREATE INDEX IF NOT EXISTS analysis_master_script_remakes_project_idx ON analysis_master_script_remakes(project_id);
CREATE INDEX IF NOT EXISTS analysis_master_script_remakes_product_idx ON analysis_master_script_remakes(product_id);

ALTER TABLE analysis_master_script_remakes DISABLE ROW LEVEL SECURITY;

-- 添加脚本复刻积分价格配置（默认50积分）
INSERT INTO system_credit_prices (action_type, credits_required, description, is_active, created_at, updated_at)
SELECT 'analysis_master_script_remake', 50, '分析大师脚本复刻', true, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM system_credit_prices WHERE action_type = 'analysis_master_script_remake');

-- 2. analysis_master_projects 添加 import_metadata 列 (来自 015_analysis_master_import_metadata.sql)
ALTER TABLE analysis_master_projects
  ADD COLUMN IF NOT EXISTS import_metadata JSONB DEFAULT '{}'::jsonb;

-- 3. task_queue.type 扩展为 varchar(50) (来自 016_task_queue_type_varchar50.sql)
ALTER TABLE task_queue ALTER COLUMN type TYPE varchar(50);

-- 4. system_prompt_config 种子数据 (来自 015b_system_prompt_config_seed.sql)

-- 确保 shortfilm 记录存在
INSERT INTO system_prompt_config (id, system_prompt, default_prompt, variables_used)
VALUES (
  'shortfilm',
  '', '', ''
) ON CONFLICT (id) DO NOTHING;

-- 确保 video_remake 记录存在
INSERT INTO system_prompt_config (id, system_prompt, default_prompt, variables_used)
VALUES (
  'video_remake',
  '', '', ''
) ON CONFLICT (id) DO NOTHING;

-- 确保 analysis_master 记录存在
INSERT INTO system_prompt_config (id, system_prompt, default_prompt, variables_used)
VALUES (
  'analysis_master',
  '', '', ''
) ON CONFLICT (id) DO NOTHING;

-- 确保 analysis_master_script_remake 记录存在
INSERT INTO system_prompt_config (id, system_prompt, default_prompt, variables_used)
VALUES (
  'analysis_master_script_remake',
  '', '', ''
) ON CONFLICT (id) DO NOTHING;
