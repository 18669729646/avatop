-- 视频复刻项目表
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

CREATE INDEX IF NOT EXISTS video_remake_projects_user_idx ON video_remake_projects(user_id);
CREATE INDEX IF NOT EXISTS video_remake_projects_status_idx ON video_remake_projects(status);
CREATE INDEX IF NOT EXISTS video_remake_projects_parse_status_idx ON video_remake_projects(parse_status);
CREATE INDEX IF NOT EXISTS video_remake_projects_created_at_idx ON video_remake_projects(created_at);

-- 视频复刻分镜表
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

CREATE INDEX IF NOT EXISTS video_remake_scenes_user_idx ON video_remake_scenes(user_id);
CREATE INDEX IF NOT EXISTS video_remake_scenes_project_idx ON video_remake_scenes(project_id, scene_index);
CREATE INDEX IF NOT EXISTS video_remake_scenes_status_idx ON video_remake_scenes(status);
CREATE INDEX IF NOT EXISTS video_remake_scenes_video_status_idx ON video_remake_scenes(video_status);

-- 视频复刻输出表
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

CREATE INDEX IF NOT EXISTS video_remake_outputs_user_idx ON video_remake_outputs(user_id);
CREATE INDEX IF NOT EXISTS video_remake_outputs_project_idx ON video_remake_outputs(project_id, created_at);
CREATE INDEX IF NOT EXISTS video_remake_outputs_created_at_idx ON video_remake_outputs(created_at);
