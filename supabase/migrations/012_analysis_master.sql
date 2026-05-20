CREATE TABLE IF NOT EXISTS analysis_master_projects (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(256) NOT NULL,
  source_type VARCHAR(32) NOT NULL DEFAULT 'link',
  source_url TEXT,
  video_key TEXT,
  video_url TEXT,
  video_duration INTEGER,
  file_size INTEGER,
  status VARCHAR(32) DEFAULT 'draft',
  result JSONB,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE analysis_master_projects DISABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS analysis_master_projects_user_idx
  ON analysis_master_projects(user_id, updated_at);

CREATE INDEX IF NOT EXISTS analysis_master_projects_status_idx
  ON analysis_master_projects(status);

INSERT INTO system_credit_prices (id, action_type, credits_required, description, is_active)
VALUES ('price_analysis_master', 'video_analysis_master', 10, '分析大师视频拆解', true)
ON CONFLICT (action_type) DO NOTHING;
