ALTER TABLE video_remake_projects ADD COLUMN IF NOT EXISTS platform VARCHAR(32);
ALTER TABLE video_remake_projects ADD COLUMN IF NOT EXISTS file_name TEXT;
