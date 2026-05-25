import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, unauthorizedResponse } from '@/lib/auth-middleware';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { logApiError, logInfo } from '@/lib/logger';
import { extractAnalysisMasterImports, ANALYSIS_MASTER_IMPORT_LIMIT, type AnalysisMasterImportItem } from '@/lib/analysis-master-excel';
import {
  buildAnalysisMasterImportRunCreate,
  buildAnalysisMasterImportRunToken,
  cleanupAnalysisMasterImportRunArtifacts,
  type AnalysisMasterImportMode,
} from '@/lib/analysis-master-import-runs';

async function readImports(request: NextRequest): Promise<{
  mode: AnalysisMasterImportMode;
  sourceFileName?: string;
  imports: AnalysisMasterImportItem[];
}> {
  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      throw new Error('Please upload an Excel file');
    }
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.xls')) {
      throw new Error('Only .xlsx or .xls files are supported');
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    return {
      mode: 'batch',
      sourceFileName: file.name,
      imports: extractAnalysisMasterImports(buffer),
    };
  }

  const body = await request.json();
  if (Array.isArray(body.imports)) {
    return {
      mode: body.mode === 'single' ? 'single' : 'batch',
      sourceFileName: typeof body.sourceFileName === 'string' ? body.sourceFileName : undefined,
      imports: body.imports.map((item: Record<string, unknown>) => ({
        sourceUrl: String(item.sourceUrl || ''),
        metadata: item.metadata && typeof item.metadata === 'object' ? item.metadata as Record<string, string> : {},
      })),
    };
  }

  return {
    mode: 'single',
    imports: [{
      sourceUrl: String(body.sourceUrl || body.url || ''),
      metadata: body.importMetadata && typeof body.importMetadata === 'object' ? body.importMetadata as Record<string, string> : {},
    }],
  };
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.success) {
      return unauthorizedResponse(auth.error, auth.status);
    }

    const { mode, sourceFileName, imports } = await readImports(request);
    const validImports = imports.filter(item => item.sourceUrl.trim()).slice(0, ANALYSIS_MASTER_IMPORT_LIMIT);
    if (validImports.length === 0) {
      return NextResponse.json({ error: mode === 'batch' ? 'No TikTok/Douyin links found in the Excel file' : 'Please provide a video URL' }, { status: 400 });
    }

    const built = buildAnalysisMasterImportRunCreate({
      userId: auth.userId,
      mode,
      sourceFileName,
      imports: validImports,
    });

    const client = getSupabaseClient();
    const createdProjectIds = built.projects.map(project => String(project.id));

    const { error: runError } = await client.from('analysis_master_import_runs').insert(built.run);
    if (runError) {
      logApiError('analysis-master/import-runs', 'insert run', runError, { runId: built.run.id }, auth.userId);
      return NextResponse.json({ error: 'Failed to create the import run' }, { status: 500 });
    }

    const { error: projectError } = await client.from('analysis_master_projects').insert(built.projects);
    if (projectError) {
      logApiError('analysis-master/import-runs', 'insert projects', projectError, { runId: built.run.id }, auth.userId);
      const cleanupResult = await cleanupAnalysisMasterImportRunArtifacts(client, {
        runId: String(built.run.id),
        projectIds: createdProjectIds,
      });
      if (cleanupResult.runError || cleanupResult.projectError) {
        logApiError(
          'analysis-master/import-runs',
          'cleanup after project insert failure',
          cleanupResult.runError || cleanupResult.projectError,
          { runId: built.run.id, projectIds: createdProjectIds },
          auth.userId,
        );
      }
      return NextResponse.json({ error: 'Failed to create import projects' }, { status: 500 });
    }

    const { error: itemError } = await client.from('analysis_master_import_items').insert(built.items);
    if (itemError) {
      logApiError('analysis-master/import-runs', 'insert items', itemError, { runId: built.run.id }, auth.userId);
      const cleanupResult = await cleanupAnalysisMasterImportRunArtifacts(client, {
        runId: String(built.run.id),
        projectIds: createdProjectIds,
      });
      if (cleanupResult.runError || cleanupResult.projectError) {
        logApiError(
          'analysis-master/import-runs',
          'cleanup after item insert failure',
          cleanupResult.runError || cleanupResult.projectError,
          { runId: built.run.id, projectIds: createdProjectIds },
          auth.userId,
        );
      }
      return NextResponse.json({ error: 'Failed to create import items' }, { status: 500 });
    }

    logInfo('api', 'Analysis Master import orchestration created', {
      runId: built.run.id,
      mode,
      total: validImports.length,
    }, auth.userId);

    return NextResponse.json({
      success: true,
      data: {
        runId: built.run.id,
        runnerToken: buildAnalysisMasterImportRunToken(String(built.run.id), String(built.run.runner_token)),
        mode,
        total: validImports.length,
        limit: ANALYSIS_MASTER_IMPORT_LIMIT,
        items: built.items.map((item, index) => ({
          id: item.id,
          projectId: item.project_id,
          sourceUrl: item.source_url,
          rowIndex: item.row_index,
          metadata: validImports[index].metadata,
        })),
      },
    });
  } catch (error) {
    logApiError('analysis-master/import-runs', 'POST', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to create the import run' }, { status: 500 });
  }
}
