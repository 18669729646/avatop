-- 扩展 task_queue.type 字段长度，支持 analysis_batch_import 类型（22字符 > 原 varchar(20)）
ALTER TABLE task_queue ALTER COLUMN type TYPE varchar(50);
