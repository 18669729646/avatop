-- 配置表

CREATE TABLE IF NOT EXISTS system_config (
  id VARCHAR(64) PRIMARY KEY,
  config_type VARCHAR(32) NOT NULL,
  name VARCHAR(128) NOT NULL,
  is_default BOOLEAN DEFAULT false,
  extra_config JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS system_config_type_idx ON system_config(config_type);
CREATE INDEX IF NOT EXISTS system_config_is_default_idx ON system_config(is_default);

CREATE TABLE IF NOT EXISTS queue_config (
  id VARCHAR(64) PRIMARY KEY,
  max_concurrent INTEGER DEFAULT 3 NOT NULL,
  retry_delay INTEGER DEFAULT 5000 NOT NULL,
  max_retry INTEGER DEFAULT 5 NOT NULL,
  task_timeout INTEGER DEFAULT 120000 NOT NULL,
  auto_start BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
