-- 创建成品案例表
CREATE TABLE IF NOT EXISTS showcase_cases (
  id VARCHAR(36) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  type VARCHAR(20) NOT NULL DEFAULT 'shortfilm',
  category VARCHAR(50),
  
  -- 媒体资源
  thumbnail_url VARCHAR(500),
  media_url VARCHAR(500) NOT NULL,
  media_type VARCHAR(20) NOT NULL DEFAULT 'video',
  
  -- 元数据
  prompt TEXT,
  model VARCHAR(100),
  duration INTEGER,
  
  -- 展示配置
  is_featured BOOLEAN DEFAULT false,
  display_order INTEGER DEFAULT 0,
  
  -- 审计字段
  created_by VARCHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(20) DEFAULT 'published'
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_showcase_cases_type ON showcase_cases(type);
CREATE INDEX IF NOT EXISTS idx_showcase_cases_category ON showcase_cases(category);
CREATE INDEX IF NOT EXISTS idx_showcase_cases_featured ON showcase_cases(is_featured);
CREATE INDEX IF NOT EXISTS idx_showcase_cases_status ON showcase_cases(status);
CREATE INDEX IF NOT EXISTS idx_showcase_cases_display_order ON showcase_cases(display_order);

-- 注释
COMMENT ON TABLE showcase_cases IS '成品案例展示表';
COMMENT ON COLUMN showcase_cases.type IS '案例类型: image/video/shortfilm';
COMMENT ON COLUMN showcase_cases.media_type IS '媒体类型: image/video';
COMMENT ON COLUMN showcase_cases.is_featured IS '是否精选';
COMMENT ON COLUMN showcase_cases.display_order IS '显示顺序，数字越小越靠前';
COMMENT ON COLUMN showcase_cases.status IS '状态: published/archived';
