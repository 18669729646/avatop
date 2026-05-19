INSERT INTO system_credit_prices (id, action_type, credits_required, description, is_active)
VALUES
  ('price_seedance2_480p', 'video_seedance2_480p', 80, 'Seedance 2.0 480p 每秒视频生成', true),
  ('price_seedance2_720p', 'video_seedance2_720p', 120, 'Seedance 2.0 720p 每秒视频生成', true),
  ('price_seedance2_1080p', 'video_seedance2_1080p', 150, 'Seedance 2.0 1080p 每秒视频生成', true),
  ('price_seedance2_fast_480p', 'video_seedance2_fast_480p', 60, 'Seedance 2.0 Fast 480p 每秒视频生成', true),
  ('price_seedance2_fast_720p', 'video_seedance2_fast_720p', 100, 'Seedance 2.0 Fast 720p 每秒视频生成', true)
ON CONFLICT (action_type) DO NOTHING;
