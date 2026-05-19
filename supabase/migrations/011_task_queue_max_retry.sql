-- 将 task_queue 的 max_retry 默认值从 3 改为 5
ALTER TABLE task_queue ALTER COLUMN max_retry SET DEFAULT 5;
