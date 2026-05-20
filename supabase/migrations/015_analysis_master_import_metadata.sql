ALTER TABLE analysis_master_projects
  ADD COLUMN IF NOT EXISTS import_metadata JSONB DEFAULT '{}'::jsonb;
