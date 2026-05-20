import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, unauthorizedResponse } from '@/lib/auth-middleware';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { logApiError } from '@/lib/logger';
import {
  buildAnalysisMasterExportRows,
  createAnalysisMasterWorkbook,
  type AnalysisMasterExportProject,
} from '@/lib/analysis-master-excel';
import { mapAnalysisMasterProject } from '@/lib/analysis-master-projects';

function toExportProject(row: Record<string, unknown>): AnalysisMasterExportProject {
  const mapped = mapAnalysisMasterProject(row);
  return {
    id: String(mapped.id || ''),
    name: String(mapped.name || ''),
    sourceType: String(mapped.sourceType || ''),
    sourceUrl: typeof mapped.sourceUrl === 'string' ? mapped.sourceUrl : '',
    status: String(mapped.status || ''),
    error: typeof mapped.error === 'string' ? mapped.error : null,
    importMetadata: (mapped.importMetadata || {}) as Record<string, string>,
    result: mapped.result as AnalysisMasterExportProject['result'],
    createdAt: String(mapped.createdAt || ''),
    updatedAt: String(mapped.updatedAt || ''),
  };
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.success) {
      return unauthorizedResponse(auth.error, auth.status);
    }

    const body = await request.json().catch(() => ({}));
    const projectIds = Array.isArray(body.projectIds)
      ? body.projectIds.map((id: unknown) => String(id)).filter(Boolean)
      : [];

    const client = getSupabaseClient();
    let query = client
      .from('analysis_master_projects')
      .select('*')
      .eq('user_id', auth.userId)
      .order('updated_at', { ascending: false });

    if (projectIds.length > 0) {
      query = query.in('id', projectIds).eq('status', 'completed');
    } else {
      query = query.eq('status', 'completed');
    }

    const { data, error } = await query;
    if (error) {
      logApiError('analysis-master/export', 'select', error, { projectIds }, auth.userId);
      return NextResponse.json({ error: '获取导出数据失败' }, { status: 500 });
    }

    const rows = buildAnalysisMasterExportRows((data || []).map(toExportProject));
    if (rows.length === 0) {
      return NextResponse.json({ error: '没有可导出的分析结果' }, { status: 400 });
    }

    const workbook = createAnalysisMasterWorkbook(rows);
    const filename = `analysis-master-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.xlsx`;
    return new NextResponse(new Uint8Array(workbook), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    logApiError('analysis-master/export', 'POST', error);
    return NextResponse.json({ error: '导出失败' }, { status: 500 });
  }
}
