UPDATE task_queue SET status = 'pending', retry_count = 0, error = NULL, heartbeat_at = NULL WHERE id LIKE 'dbd2dca9-d763-4677-9d55-8e27410d7180-img-%';
UPDATE video_remake_scenes SET status = 'pending', generated_image_key = NULL, generated_image_url = NULL WHERE project_id = 'dbd2dca9-d763-4677-9d55-8e27410d7180';
UPDATE video_remake_projects SET status = 'parsed', updated_at = now() WHERE id = 'dbd2dca9-d763-4677-9d55-8e27410d7180';
