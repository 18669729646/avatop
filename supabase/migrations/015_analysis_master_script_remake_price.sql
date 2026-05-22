-- 创建分析大师脚本复刻表
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

-- 添加脚本复刻积分价格配置（默认10积分）
INSERT INTO system_credit_prices (action_type, credits_required, description, is_active, created_at, updated_at)
SELECT 'analysis_master_script_remake', 10, '分析大师脚本复刻', true, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM system_credit_prices WHERE action_type = 'analysis_master_script_remake');

-- 添加脚本复刻提示词配置
INSERT INTO system_prompt_config (id, system_prompt, description, created_at, updated_at)
SELECT 'analysis_master_script_remake', '', '分析大师脚本复刻提示词配置', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM system_prompt_config WHERE id = 'analysis_master_script_remake');