-- 添加脚本生成方式字段到短片项目表
-- 支持AI自动生成和手动输入两种模式

ALTER TABLE shortfilm_projects ADD COLUMN IF NOT EXISTS script_generation_mode VARCHAR(16) DEFAULT 'ai';

-- 添加注释
COMMENT ON COLUMN shortfilm_projects.script_generation_mode IS '脚本生成方式：ai（AI自动生成）或 manual（手动输入）';
