-- System logs table
CREATE TABLE IF NOT EXISTS system_logs (
  id VARCHAR(64) PRIMARY KEY,
  level VARCHAR(16) NOT NULL DEFAULT 'info',
  category VARCHAR(64) NOT NULL,
  message TEXT NOT NULL,
  detail JSONB,
  user_id VARCHAR(64),
  request_id VARCHAR(64),
  stack_trace TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_logs_level ON system_logs(level);
CREATE INDEX IF NOT EXISTS idx_system_logs_category ON system_logs(category);
CREATE INDEX IF NOT EXISTS idx_system_logs_user_id ON system_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON system_logs(created_at DESC);
