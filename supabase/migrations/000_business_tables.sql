-- 业务基础表（供后续迁移添加 user_id 等字段）

CREATE TABLE IF NOT EXISTS task_queue (
  id VARCHAR(64) PRIMARY KEY,
  type VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL,
  params JSONB NOT NULL,
  result JSONB,
  results JSONB,
  error TEXT,
  project_id VARCHAR(64),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  heartbeat_at TIMESTAMPTZ,
  retry_count INTEGER DEFAULT 0 NOT NULL,
  max_retry INTEGER DEFAULT 5 NOT NULL
);

CREATE TABLE IF NOT EXISTS image_history (
  id VARCHAR(64) PRIMARY KEY,
  url TEXT NOT NULL,
  key TEXT,
  prompt TEXT NOT NULL,
  aspect_ratio VARCHAR(10),
  resolution VARCHAR(10),
  file_size INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS video_history (
  id VARCHAR(64) PRIMARY KEY,
  url TEXT,
  key TEXT,
  prompt TEXT NOT NULL,
  aspect_ratio VARCHAR(10),
  duration INTEGER,
  file_size INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS character_library (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(128) NOT NULL,
  url TEXT NOT NULL,
  key TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS products (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(128) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS shortfilm_projects (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64),
  name VARCHAR(256) NOT NULL,
  status VARCHAR(32) DEFAULT 'draft',
  current_step INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  scenes JSONB DEFAULT '[]'::jsonb,
  generated_images JSONB DEFAULT '[]'::jsonb,
  generated_videos JSONB DEFAULT '[]'::jsonb,
  merged_videos JSONB DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS shortfilm_templates (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64),
  name VARCHAR(128) NOT NULL,
  description TEXT,
  category VARCHAR(32) DEFAULT 'custom',
  duration INTEGER DEFAULT 0,
  prompt_template TEXT,
  tags JSONB DEFAULT '[]'::jsonb,
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS prompt_templates (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64),
  name VARCHAR(128) NOT NULL,
  description TEXT,
  category VARCHAR(32) DEFAULT 'custom',
  type VARCHAR(16) DEFAULT 'image',
  prompt TEXT NOT NULL,
  default_params JSONB,
  variables JSONB,
  tags JSONB DEFAULT '[]'::jsonb,
  is_system BOOLEAN DEFAULT false,
  is_hot BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS user_preferences (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64),
  favorite_templates JSONB DEFAULT '[]'::jsonb,
  recent_templates JSONB DEFAULT '[]'::jsonb,
  template_usage_stats JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS system_prompt_config (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64),
  system_prompt TEXT,
  default_prompt TEXT,
  variables_used JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
