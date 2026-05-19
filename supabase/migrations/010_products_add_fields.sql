-- 添加产品表缺失的字段
ALTER TABLE products ADD COLUMN IF NOT EXISTS user_id VARCHAR(64);
ALTER TABLE products ADD COLUMN IF NOT EXISTS selling_points JSONB DEFAULT '[]'::jsonb;
ALTER TABLE products ADD COLUMN IF NOT EXISTS target_audience TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS usage_scenarios TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS brand_info TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS price_range TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS keywords JSONB DEFAULT '[]'::jsonb;
ALTER TABLE products ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'::jsonb;

-- 创建索引
CREATE INDEX IF NOT EXISTS products_user_idx ON products(user_id);
