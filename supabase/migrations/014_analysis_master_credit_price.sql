INSERT INTO system_credit_prices (id, action_type, credits_required, description, is_active)
VALUES ('price_analysis_master', 'video_analysis_master', 50, '分析大师视频拆解（每条，可后台配置）', true)
ON CONFLICT (action_type)
DO UPDATE SET
  credits_required = 50,
  description = EXCLUDED.description,
  is_active = true,
  updated_at = NOW();
