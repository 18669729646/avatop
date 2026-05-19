-- ============================================
-- 系统配置 (system_config)
-- ============================================

-- 默认配置
INSERT INTO system_config (id, config_type, name, is_default, extra_config) VALUES
('config_defaults', 'defaults', 'defaults', false, '{"defaultImageApiId": "grsai-gptimage", "defaultTextApiId": "yunwu-text-default", "defaultVideoApiId": "yunwu-video-veo31"}');

-- 图片 API 配置
INSERT INTO system_config (id, config_type, name, is_default, extra_config) VALUES
('config_imageApis', 'imageApis', 'imageApis', false, '[{"id": "grsai-nanobanana-2", "name": "NanoBanana 2", "type": "image", "model": "nano-banana-2", "baseUrl": "https://grsaiapi.com", "apiKey": "sk-9f5795b568a24cc38379cdab88d61d43", "apiKeyMasked": "sk-9****1d43", "defaultAspectRatio": "9:16", "defaultResolution": "2K", "isDefault": false}, {"id": "yunwu-image-gemini-31-flash", "name": "Gemini 3.1 Flash Image", "type": "image", "model": "gemini-3.1-flash-image-preview", "baseUrl": "https://yunwu.ai/v1beta", "apiKey": "sk-ORtwEeODIzuETE3gSXwaSJs1qeP0c2WFLcIqUGCPqfjeQ6U1", "apiKeyMasked": "sk-O****Q6U1", "defaultAspectRatio": "9:16", "defaultResolution": "2K", "isDefault": false}, {"id": "grsai-gptimage", "name": "GrsAI GPTImage", "type": "image", "model": "gpt-image-2", "baseUrl": "https://grsaiapi.com", "apiKey": "sk-9f5795b568a24cc38379cdab88d61d43", "apiKeyMasked": "sk-9****1d43", "defaultAspectRatio": "9:16", "defaultResolution": "2K", "isDefault": true}]');

-- 文本 API 配置
INSERT INTO system_config (id, config_type, name, is_default, extra_config) VALUES
('config_textApis', 'textApis', 'textApis', false, '[{"id": "yunwu-text-default", "name": "云雾 Gemini 3.1 Pro", "type": "text", "model": "gemini-3.1-pro-preview", "baseUrl": "https://yunwu.ai/v1beta", "apiKey": "sk-ORtwEeODIzuETE3gSXwaSJs1qeP0c2WFLcIqUGCPqfjeQ6U1", "apiKeyMasked": "sk-O****Q6U1", "isDefault": true}, {"id": "yunwu-claude-sonnet-default", "name": "云雾 Claude Sonnet 4.6", "type": "text", "model": "claude-sonnet-4-6", "baseUrl": "https://yunwu.ai/v1beta", "apiKey": "sk-ORtwEeODIzuETE3gSXwaSJs1qeP0c2WFLcIqUGCPqfjeQ6U1", "apiKeyMasked": "sk-O****Q6U1", "isDefault": false}, {"id": "yunwu-gpt-54-mini", "name": "云雾 GPT-5.4-mini", "type": "text", "model": "gpt-5.4-mini", "baseUrl": "https://yunwu.ai/v1beta", "apiKey": "sk-ORtwEeODIzuETE3gSXwaSJs1qeP0c2WFLcIqUGCPqfjeQ6U1", "apiKeyMasked": "sk-O****Q6U1", "isDefault": false}]');

-- 视频 API 配置
INSERT INTO system_config (id, config_type, name, is_default, extra_config) VALUES
('config_videoApis', 'videoApis', 'videoApis', false, '[{"id": "yunwu-video-veo31", "name": "首尾帧", "type": "video", "model": "veo_3_1-fast", "baseUrl": "https://yunwu.ai", "apiKey": "sk-ORtwEeODIzuETE3gSXwaSJs1qeP0c2WFLcIqUGCPqfjeQ6U1", "apiKeyMasked": "sk-O****Q6U1", "defaultAspectRatio": "9:16", "isDefault": true}, {"id": "yunwu-video-veo31-fast-components", "name": "参考图（最多3张）", "type": "video", "model": "veo3.1-fast-components", "baseUrl": "https://yunwu.ai", "apiKey": "sk-ORtwEeODIzuETE3gSXwaSJs1qeP0c2WFLcIqUGCPqfjeQ6U1", "apiKeyMasked": "sk-O****Q6U1", "defaultAspectRatio": "9:16", "isDefault": false}]');

-- ============================================
-- 系统设置 (system_settings)
-- ============================================

INSERT INTO system_settings (key, value, description) VALUES
('jwt_expires_days', '7', 'JWT 过期天数'),
('jwt_secret', '', 'JWT 密钥（启动时自动生成）'),
('new_user_bonus_credits', '5', '新用户注册赠送积分'),
('user_storage_quota_mb', '1000', '用户存储空间配额（MB）'),
('customer_service_wechat', '', '客服微信号'),
('customer_service_phone', '', '客服电话'),
('customer_service_description', '', '客服联系说明'),
('customer_service_qrcode', 'customer-service/qrcode_1773913226998_5929558e.png', '客服微信二维码Key');

-- ============================================
-- 任务队列配置 (queue_config)
-- ============================================

INSERT INTO queue_config (id, max_concurrent, retry_delay, max_retry, task_timeout, auto_start) VALUES
('default', 3, 5000, 3, 600000, true);
