UPDATE task_queue SET status = 'pending', retry_count = 0, error = NULL WHERE id LIKE 'dbd2dca9-d763-4677-9d55-8e27410d7180-img-%' AND status IN ('running', 'retrying');
