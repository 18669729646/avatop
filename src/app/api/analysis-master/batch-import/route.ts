import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, unauthorizedResponse } from '@/lib/auth-middleware';
import { logApiError } from '@/lib/logger';
import {
  ANALYSIS_MASTER_IMPORT_LIMIT,
  extractAnalysisMasterImports,
} from '@/lib/analysis-master-excel';
import { createAnalysisMasterBatchImportId } from '@/lib/analysis-master-batch';

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.success) {
      return unauthorizedResponse(auth.error, auth.status);
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

    const batchId = createAnalysisMasterBatchImportId();
    return NextResponse.json({
      success: true,
      data: {
        batchId,
        sourceFileName: file.name,
        total: imports.length,
        limit: ANALYSIS_MASTER_IMPORT_LIMIT,
        imports,
      },
    });
  } catch (error) {
    logApiError('analysis-master/batch-import', 'POST', error);
    return NextResponse.json({ error: '批量导入失败' }, { status: 500 });
  }
}
