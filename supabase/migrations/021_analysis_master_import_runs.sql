CREATE TABLE IF NOT EXISTS analysis_master_import_runs (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mode VARCHAR(16) NOT NULL DEFAULT 'single',
  source_file_name TEXT,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  total_items INTEGER NOT NULL DEFAULT 0,
  completed_items INTEGER NOT NULL DEFAULT 0,
  failed_items INTEGER NOT NULL DEFAULT 0,
  runner_token TEXT NOT NULL,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS analysis_master_import_items (
  id VARCHAR(64) PRIMARY KEY,
  run_id VARCHAR(64) NOT NULL REFERENCES analysis_master_import_runs(id) ON DELETE CASCADE,
  user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id VARCHAR(64) NOT NULL REFERENCES analysis_master_projects(id) ON DELETE CASCADE,
  source_url TEXT NOT NULL,
  row_index INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  error TEXT,
  worker_id VARCHAR(128),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE analysis_master_import_runs DISABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_master_import_items DISABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS analysis_master_import_runs_user_idx
  ON analysis_master_import_runs(user_id, updated_at);

CREATE INDEX IF NOT EXISTS analysis_master_import_runs_status_idx
  ON analysis_master_import_runs(status);

CREATE INDEX IF NOT EXISTS analysis_master_import_items_run_idx
  ON analysis_master_import_items(run_id, row_index);

CREATE INDEX IF NOT EXISTS analysis_master_import_items_status_idx
  ON analysis_master_import_items(run_id, status);
