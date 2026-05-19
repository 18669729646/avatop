-- 视频复刻 2.0 升级：新增关键帧表 + 分镜定制字段 + 项目音频字段

-- 关键帧表
CREATE TABLE IF NOT EXISTS video_remake_keyframes (
  id VARCHAR(64) PRIMARY KEY,
  project_id VARCHAR(64) REFERENCES video_remake_projects(id) ON DELETE CASCADE,
  frame_index INTEGER NOT NULL,
  timestamp_ms INTEGER NOT NULL,
  image_key TEXT,
  image_url TEXT,
  ssim_score FLOAT,
  is_key_scene BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_keyframes_project ON video_remake_keyframes(project_id);

-- 替换素材表
CREATE TABLE IF NOT EXISTS video_remake_assets (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  project_id VARCHAR(64) REFERENCES video_remake_projects(id) ON DELETE CASCADE,
  asset_type VARCHAR(32) NOT NULL,
  file_key TEXT NOT NULL,
  file_url TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assets_project ON video_remake_assets(project_id);
CREATE INDEX IF NOT EXISTS idx_assets_user ON video_remake_assets(user_id);

-- 分镜表增加定制字段
ALTER TABLE video_remake_scenes ADD COLUMN IF NOT EXISTS customizations JSONB DEFAULT '{}';
ALTER TABLE video_remake_scenes ADD COLUMN IF NOT EXISTS shot_type VARCHAR(32);
ALTER TABLE video_remake_scenes ADD COLUMN IF NOT EXISTS camera_movement VARCHAR(32);
ALTER TABLE video_remake_scenes ADD COLUMN IF NOT EXISTS camera_speed VARCHAR(16);
ALTER TABLE video_remake_scenes ADD COLUMN IF NOT EXISTS composition JSONB DEFAULT '{}';
ALTER TABLE video_remake_scenes ADD COLUMN IF NOT EXISTS character_info JSONB DEFAULT '{}';

-- 项目表增加字段
ALTER TABLE video_remake_projects ADD COLUMN IF NOT EXISTS keyframes_extracted BOOLEAN DEFAULT false;
ALTER TABLE video_remake_projects ADD COLUMN IF NOT EXISTS voice_preset_id VARCHAR(32) DEFAULT 'warm_female';
