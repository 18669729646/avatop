import { SupabaseClient } from '@supabase/supabase-js';
import { broadcastTaskUpdate } from '@/lib/task-events';
import { logInfo, logTaskError } from '@/lib/logger';
import { createAnalysisProjectFromLink } from '@/lib/analysis-master-projects';
import { enqueueAnalysisTaskForProject, triggerBackgroundProcessing } from '@/lib/analysis-master-queue';
import type { AnalysisBatchImportTaskParams, AnalysisBatchImportTaskResult } from '@/lib/queue';

interface AnalysisBatchQueueTask {
  id: string;
  user_id?: string;
  started_at?: string;
  params: unknown;
}

interface AnalysisBatchProcessorDeps {
  createAnalysisProjectFromLink?: typeof createAnalysisProjectFromLink;
  enqueueAnalysisTaskForProject?: typeof enqueueAnalysisTaskForProject;
  triggerBackgroundProcessing?: typeof triggerBackgroundProcessing;
  broadcastTaskUpdate?: typeof broadcastTaskUpdate;
  logInfo?: typeof logInfo;
}

function resolveBatchProjectName(metadata: Record<string, string>, index: number): string {
  const base =
    metadata['项目名称']
    || metadata['视频名称']
    || metadata['标题']
    || metadata['名称']
    || metadata['内容']
    || `批量导入项目 ${index + 1}`;
  return `[批量] ${base}`;
}

export async function executeAnalysisBatchImportTask(
  task: AnalysisBatchQueueTask,
  supabase: SupabaseClient,
  deps: AnalysisBatchProcessorDeps = {}
): Promise<void> {
  const createProject = deps.createAnalysisProjectFromLink || createAnalysisProjectFromLink;
  const enqueueAnalysisTask = deps.enqueueAnalysisTaskForProject || enqueueAnalysisTaskForProject;
  const triggerProcessing = deps.triggerBackgroundProcessing || triggerBackgroundProcessing;
  const emitTaskUpdate = deps.broadcastTaskUpdate || broadcastTaskUpdate;
  const emitLogInfo = deps.logInfo || logInfo;
  const params = task.params as AnalysisBatchImportTaskParams;

  if (!task.user_id) {
    console.error(`[BatchImport] 任务 ${task.id} 缺少用户ID`);
    throw new Error('批量导入任务缺少用户ID');
  }

  if (!Array.isArray(params.imports) || params.imports.length === 0) {
    console.error(`[BatchImport] 任务 ${task.id} 缺少导入数据`);
    throw new Error('批量导入任务缺少导入数据');
  }

  console.log(`[BatchImport] 任务开始，batchId=${params.batchId}, totalRows=${params.totalRows}, userId=${task.user_id}`);

  const startedAt = task.started_at || new Date().toISOString();
  let createdRows = 0;
  let failedRows = 0;
  const failedItems: Array<{ sourceUrl: string; error: string }> = [];

  const updateTaskQueueRow = async (
    updates: Record<string, unknown>,
    operation: string
  ): Promise<boolean> => {
    const maxRetries = 3;
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const { error } = await supabase
        .from('task_queue')
        .update(updates)
        .eq('id', task.id);

      if (!error) {
        return true;
      }

      lastError = error;
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 200 * attempt));
      }
    }

    logTaskError(task.id, operation, lastError, {
      batchId: params.batchId,
      totalRows: params.totalRows,
      createdRows,
      failedRows,
    }, task.user_id);

    return false;
  };

  const persistProgress = async (): Promise<void> => {
    const partialResult: AnalysisBatchImportTaskResult = {
      batchId: params.batchId,
      sourceFileName: params.sourceFileName,
      totalRows: params.totalRows,
      createdRows,
      failedRows,
      failedItems: failedItems.slice(0, 20),
    };

    const updated = await updateTaskQueueRow({
      status: 'running',
      result: partialResult,
      error: null,
      started_at: startedAt,
    }, 'batch import progress writeback');

    if (!updated) {
      return;
    }

    emitTaskUpdate({
      taskId: task.id,
      type: 'analysis_batch_import',
      status: 'progress',
      progress: Math.min(99, Math.round(((createdRows + failedRows) / params.totalRows) * 100)),
      result: partialResult,
    });
  };

  const BATCH_SIZE = 3; // 每批并行处理数量
  const BATCH_INTERVAL_MS = 2000; // 批次间隔（毫秒）
  const BATCH_DOWNLOAD_TIMEOUT_MS = 60 * 1000; // 批量导入中每个视频下载最多 60 秒

  // 分批处理，每批并行执行
  for (let batchStart = 0; batchStart < params.totalRows; batchStart += BATCH_SIZE) {
    const batchEnd = Math.min(batchStart + BATCH_SIZE, params.totalRows);
    const batchItems = params.imports.slice(batchStart, batchEnd);
    const batchNumber = Math.floor(batchStart / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(params.totalRows / BATCH_SIZE);

    console.log(`[BatchImport] 开始批次 ${batchNumber}/${totalBatches}，包含第 ${batchStart + 1}-${batchEnd} 条（共 ${params.totalRows} 条）`);

    // 本批次内并行处理所有视频
    const batchPromises = batchItems.map(async (item, batchIndex) => {
      const index = batchStart + batchIndex;
      let projectId: string | null = null;

      console.log(`[BatchImport] 批次 ${batchNumber} 第 ${batchIndex + 1}/${batchItems.length} 条：url=${item.sourceUrl}`);

      try {
        const createProjectPromise = createProject({
          userId: task.user_id!,
          sourceUrl: item.sourceUrl,
          name: resolveBatchProjectName(item.metadata, index),
          importMetadata: item.metadata,
          downloadTimeoutMs: BATCH_DOWNLOAD_TIMEOUT_MS,
        });

        const project = await Promise.race([
          createProjectPromise,
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`视频下载超时（${BATCH_DOWNLOAD_TIMEOUT_MS / 1000}秒）`)), BATCH_DOWNLOAD_TIMEOUT_MS + 5_000)
          ),
        ]);
        projectId = String(project.id);
        console.log(`[BatchImport] 批次 ${batchNumber} 第 ${batchIndex + 1} 条项目创建成功，projectId=${projectId}，开始入队分析任务`);

        await enqueueAnalysisTask({
          projectId,
          userId: task.user_id!,
          triggerProcessing: false,
        });
        console.log(`[BatchImport] 批次 ${batchNumber} 第 ${batchIndex + 1} 条分析任务入队成功`);

        console.log(`[BatchImport] 批次 ${batchNumber} 第 ${batchIndex + 1} 条处理完成`);
        return { index, projectId, success: true };
      } catch (error) {
        const message = error instanceof Error ? error.message : '批量导入失败';
        console.error(`[BatchImport] 批次 ${batchNumber} 第 ${batchIndex + 1} 条处理失败：${message}`);

        if (projectId) {
          await supabase
            .from('analysis_master_projects')
            .update({
              status: 'failed',
              error: message,
              updated_at: new Date().toISOString(),
            })
            .eq('id', projectId)
            .eq('user_id', task.user_id!);
        }

        return { index, projectId, success: false, error: message };
      }
    });

    // 等待本批次全部完成
    const batchResults = await Promise.all(batchPromises);

    // 统计本批次结果
    for (const r of batchResults) {
      if (r.success) {
        createdRows += 1;
      } else {
        failedRows += 1;
        failedItems.push({
          sourceUrl: params.imports[r.index].sourceUrl,
          error: r.error || '未知错误',
        });
      }
    }

    console.log(`[BatchImport] 批次 ${batchNumber} 完成，createdRows=${createdRows}，failedRows=${failedRows}`);

    // 更新进度
    await persistProgress();

    // 如果不是最后一批，等待间隔后继续下一批
    if (batchEnd < params.totalRows) {
      console.log(`[BatchImport] 等待 ${BATCH_INTERVAL_MS / 1000} 秒后开始下一批次...`);
      await new Promise(resolve => setTimeout(resolve, BATCH_INTERVAL_MS));
    }
  }

  const result = {
    batchId: params.batchId,
    sourceFileName: params.sourceFileName,
    totalRows: params.totalRows,
    createdRows,
    failedRows,
    failedItems: failedItems.slice(0, 20),
  };

  const finalWriteSucceeded = await updateTaskQueueRow({
    status: 'success',
    result,
    error: null,
    started_at: startedAt,
    completed_at: new Date().toISOString(),
  }, 'batch import final writeback');

  emitTaskUpdate({
    taskId: task.id,
    type: 'analysis_batch_import',
    status: 'success',
    progress: 100,
    result,
  });

  await triggerProcessing(null, task.user_id, null, params.totalRows);

  if (!finalWriteSucceeded) {
    logTaskError(task.id, 'batch import final status sync', new Error('task_queue final update failed after retries'), {
      batchId: params.batchId,
      totalRows: params.totalRows,
      createdRows,
      failedRows,
    }, task.user_id);
  }

  console.log(`[BatchImport] 任务完成，batchId=${params.batchId}, createdRows=${createdRows}, failedRows=${failedRows}`);

  emitLogInfo('task', '批量导入完成', {
    taskId: task.id,
    batchId: params.batchId,
    totalRows: params.totalRows,
    createdRows,
    failedRows,
  }, task.user_id);
}
