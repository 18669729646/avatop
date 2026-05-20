# Analysis Master Batch Queue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Excel batch import into a backend task-queue workflow that creates analysis projects, enqueues analysis jobs automatically, and keeps failures isolated per row.

**Architecture:** Excel upload will create a batch import task instead of performing downloads synchronously in the request. A new queue task type will process rows in controlled batches: create project, enqueue the existing analysis task, and record row-level success/failure without aborting the whole import. The existing analysis endpoint and `task_queue` processor remain the core analysis path, so the new workflow only adds orchestration around it.

**Tech Stack:** Next.js App Router, TypeScript, Supabase/PostgreSQL, existing `task_queue`, existing `analysis-master` project helpers, existing SSE/task event system.

---

### Task 1: Add batch import queue schema and types

**Files:**
- Modify: `src/lib/queue.ts`
- Modify: `src/lib/task-events.ts`
- Modify: `src/app/api/tasks/process/route.ts`
- Modify: `src/app/api/tasks/route.ts`
- Modify: `src/app/queue/page.tsx`
- Modify: `src/app/api/tasks/batch/route.ts` if task stats need explicit type awareness

- [ ] **Step 1: Define the new queue task type and payload shape**

```ts
export type TaskType = 'image' | 'video' | 'script' | 'analysis' | 'analysis_batch_import';

export interface AnalysisBatchImportTaskParams {
  batchId: string;
  sourceFileName: string;
  totalRows: number;
  userId: string;
}
```

- [ ] **Step 2: Extend task event typing and queue labels**

```ts
export interface TaskEventData {
  type: 'image' | 'video' | 'script' | 'analysis' | 'analysis_batch_import';
}

function getTaskTypeName(type: QueueTask['type']): string {
  if (type === 'analysis_batch_import') return '分析大师批量导入';
}
```

- [ ] **Step 3: Teach the task processor to recognize the new type**

```ts
if (task.type === 'analysis_batch_import') {
  await executeAnalysisBatchImportTask(task, supabase);
}
```

- [ ] **Step 4: Verify existing task queue pages still compile and render**

Run: `pnpm ts-check`
Expected: TypeScript passes after queue type expansion.

### Task 2: Add batch import orchestration storage

**Files:**
- Add: `supabase/migrations/016_analysis_master_batch_import.sql`
- Modify: `src/storage/database/shared/schema.ts`
- Add: `src/lib/analysis-master-batch.ts`

- [ ] **Step 1: Create a batch table**

```sql
CREATE TABLE IF NOT EXISTS analysis_master_batch_imports (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_file_name TEXT NOT NULL,
  total_rows INTEGER NOT NULL DEFAULT 0,
  created_rows INTEGER NOT NULL DEFAULT 0,
  failed_rows INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

- [ ] **Step 2: Add a helper for batch IDs and status updates**

```ts
export function createAnalysisBatchImportId(): string {
  return `am-batch-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
```

- [ ] **Step 3: Add a helper that records row-level success/failure**

```ts
export async function recordBatchImportProgress(batchId: string, patch: {
  status?: string;
  createdRows?: number;
  failedRows?: number;
  error?: string | null;
}): Promise<void>;
```

- [ ] **Step 4: Verify schema matches new helper types**

Run: `pnpm ts-check`
Expected: Schema and helper references compile.

### Task 3: Rework Excel batch import route into queue producer

**Files:**
- Modify: `src/app/api/analysis-master/batch-import/route.ts`
- Modify: `src/lib/analysis-master-excel.ts`
- Modify: `src/lib/analysis-master-projects.ts`

- [ ] **Step 1: Change batch import route to create a batch record and enqueue one batch task**

```ts
const batchId = createAnalysisBatchImportId();
await client.from('analysis_master_batch_imports').insert({
  id: batchId,
  user_id: auth.userId,
  source_file_name: file.name,
  total_rows: imports.length,
  status: 'pending',
});
await client.from('task_queue').insert({
  id: `analysis-batch-${batchId}`,
  user_id: auth.userId,
  type: 'analysis_batch_import',
  status: 'pending',
  params: { batchId, sourceFileName: file.name, totalRows: imports.length, userId: auth.userId, imports },
  max_retry: 1,
});
```

- [ ] **Step 2: Move row processing out of the HTTP request path**

```ts
return NextResponse.json({
  success: true,
  data: { batchId, total: imports.length, status: 'queued' },
});
```

- [ ] **Step 3: Keep Excel parsing behavior compatible with current import rules**

```ts
// keep row metadata preservation and URL dedupe behavior
```

- [ ] **Step 4: Verify the route returns quickly under large files**

Run: `pnpm exec tsx tests/analysis-master-excel.test.ts`
Expected: Excel helper tests still pass, route no longer blocks on downloads.

### Task 4: Implement batch task execution and chaining to analysis

**Files:**
- Modify: `src/app/api/tasks/process/route.ts`
- Add: `src/lib/analysis-master-batch.ts`
- Modify: `src/app/api/analysis-master/analyze/[id]/route.ts` if a shared enqueue helper is needed

- [ ] **Step 1: Add a batch executor that processes imported rows in controlled chunks**

```ts
async function executeAnalysisBatchImportTask(task: QueueTask, supabase: SupabaseClient): Promise<void> {
  const params = task.params as AnalysisBatchImportTaskParams & { imports: AnalysisMasterImportItem[] };
  for (const [index, item] of params.imports.entries()) {
    try {
      const project = await createAnalysisProjectFromLink({
        userId: task.user_id,
        sourceUrl: item.sourceUrl,
        name: resolveProjectName(item.metadata, index),
        importMetadata: item.metadata,
      });
      await enqueueAnalysisTaskForProject(project.id, task.user_id, supabase);
      await recordBatchImportProgress(params.batchId, { createdRows: 1 });
    } catch (error) {
      await recordBatchImportProgress(params.batchId, { failedRows: 1, error: String(error) });
    }
  }
}
```

- [ ] **Step 2: Reuse the existing analysis enqueue logic instead of duplicating credits or lock rules**

```ts
await enqueueAnalysisTaskForProject(projectId, userId, supabase);
```

- [ ] **Step 3: Mark the batch task as success even if some rows fail, because failures are row-scoped**

```ts
await supabase.from('task_queue').update({
  status: 'success',
  result: { batchId, createdCount, failedCount },
});
```

- [ ] **Step 4: Verify the batch task can fan out into normal analysis tasks**

Run: `pnpm next build`
Expected: build succeeds and task processor recognizes the new task type.

### Task 5: Update UI surfaces for visibility

**Files:**
- Modify: `src/app/analysis-master/page.tsx`
- Modify: `src/app/queue/page.tsx`

- [ ] **Step 1: Show batch import queued state and batch summary in analysis-master**

```ts
setBatchSummary({ batchId, total, queued: true });
```

- [ ] **Step 2: Display batch import task name in queue page**

```ts
if (type === 'analysis_batch_import') return '分析大师批量导入';
```

- [ ] **Step 3: Keep the existing analysis-master card style and mobile layout**

```tsx
<Card className="shadow-sm">...</Card>
```

- [ ] **Step 4: Verify the UI still renders**

Run: `pnpm lint`
Expected: no new errors, existing repo warnings may remain.

