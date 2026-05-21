import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, unauthorizedResponse } from '@/lib/auth-middleware';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { logApiError, logInfo } from '@/lib/logger';
import {
  ANALYSIS_MASTER_IMPORT_LIMIT,
  extractAnalysisMasterImports,
} from '@/lib/analysis-master-excel';
import {
  createAnalysisBatchImportId,
  createAnalysisBatchTaskId,
  triggerBackgroundProcessing,
  getRunningBatchImportTask,
} from '@/lib/analysis-master-queue';

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.success) {
      return unauthorizedResponse(auth.error, auth.status);
    }

    // 禁止并发：检测是否有正在执行的批量导入任务
    const client = getSupabaseClient();
    const runningTask = await getRunningBatchImportTask(client, auth.userId);
    if (runningTask) {
      return NextResponse.json(
        { error: `已有批量导入任务在执行中（创建于 ${new Date(runningTask.created_at).toLocaleString('zh-CN')}），请等待完成后重试` },
        { status: 409 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return NextResponse.json({ error: '请上传 Excel 文件' }, { status: 400 });
    }

    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.xls')) {
      return NextResponse.json({ error: '只支持 .xlsx 或 .xls 文件' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const imports = extractAnalysisMasterImports(buffer);
    if (imports.length === 0) {
      return NextResponse.json({ error: 'Excel 中没有找到 TikTok/抖音链接' }, { status: 400 });
    }

    const batchId = createAnalysisBatchImportId();
    const taskId = createAnalysisBatchTaskId(batchId);
    const { error } = await client
      .from('task_queue')
      .insert({
        id: taskId,
        user_id: auth.userId,
        type: 'analysis_batch_import',
        status: 'pending',
        params: {
          batchId,
          sourceFileName: file.name,
          totalRows: imports.length,
          imports,
        },
        retry_count: 0,
        max_retry: 1,
      });

    if (error) {
      logApiError('analysis-master/batch-import', 'insert task', error, { batchId }, auth.userId);
      return NextResponse.json({ error: '批量导入任务创建失败' }, { status: 500 });
    }

    await triggerBackgroundProcessing(taskId, auth.userId, request.headers.get('authorization'));

    logInfo('api', '分析大师批量导入任务已入队', { batchId, taskId, totalRows: imports.length }, auth.userId);
    return NextResponse.json({
      success: true,
      data: {
        batchId,
        taskId,
        total: imports.length,
        limit: ANALYSIS_MASTER_IMPORT_LIMIT,
        status: 'queued',
      },
    });
  } catch (error) {
    logApiError('analysis-master/batch-import', 'POST', error);
    return NextResponse.json({ error: '批量导入失败' }, { status: 500 });
  }
}
