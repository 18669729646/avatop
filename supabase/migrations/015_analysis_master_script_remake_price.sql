INSERT INTO system_credit_prices (action_type, credits_required, description, is_active, created_at, updated_at)
SELECT 'analysis_master_script_remake', 10, '分析大师脚本复刻', true, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM system_credit_prices WHERE action_type = 'analysis_master_script_remake');

INSERT INTO system_prompt_config (id, system_prompt, description, created_at, updated_at)
SELECT 'analysis_master_script_remake', '', '分析大师脚本复刻提示词配置', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM system_prompt_config WHERE id = 'analysis_master_script_remake');