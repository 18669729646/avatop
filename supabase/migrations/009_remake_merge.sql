-- 009: 视频复刻合并到短片功能 - schema变更

-- 1. 添加复刻专用字段
ALTER TABLE shortfilm_projects ADD COLUMN IF NOT EXISTS source_type VARCHAR(16) DEFAULT 'original';
ALTER TABLE shortfilm_projects ADD COLUMN IF NOT EXISTS source_video_key TEXT;
ALTER TABLE shortfilm_projects ADD COLUMN IF NOT EXISTS source_video_url TEXT;
ALTER TABLE shortfilm_projects ADD COLUMN IF NOT EXISTS video_duration INTEGER;

-- 2. 重命名旧列（兼容早期schema）
ALTER TABLE shortfilm_projects RENAME COLUMN scenes TO script_segments;
ALTER TABLE shortfilm_projects RENAME COLUMN generated_images TO image_tasks;
ALTER TABLE shortfilm_projects RENAME COLUMN generated_videos TO video_tasks;

-- 3. 补充缺失的产品和脚本字段
ALTER TABLE shortfilm_projects ADD COLUMN IF NOT EXISTS product_id VARCHAR(64);
ALTER TABLE shortfilm_projects ADD COLUMN IF NOT EXISTS product_name VARCHAR(256);
ALTER TABLE shortfilm_projects ADD COLUMN IF NOT EXISTS product_images JSONB DEFAULT '[]'::jsonb;
ALTER TABLE shortfilm_projects ADD COLUMN IF NOT EXISTS product_description TEXT DEFAULT '';
ALTER TABLE shortfilm_projects ADD COLUMN IF NOT EXISTS script_prompt TEXT DEFAULT '';
ALTER TABLE shortfilm_projects ADD COLUMN IF NOT EXISTS total_duration INTEGER DEFAULT 0;
ALTER TABLE shortfilm_projects ADD COLUMN IF NOT EXISTS selected_characters JSONB DEFAULT '[]'::jsonb;
