# Analysis Master Local Helper + Excel Batch MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把分析大师的“单条链接导入”和“Excel 批量导入”收敛到同一条本机助手执行链路里，复用现有项目表、现有上传接口和现有分析入队逻辑，同时实现失败落库、重试复用原项目 ID。

**Architecture:** 现有 `analysis_master_projects` 继续作为唯一项目表。单条导入和批量导入都先创建占位项目，状态为 `downloading`，再由 Windows 本机 helper 调用现有 `upload/init -> upload/upload -> upload/complete` 链路完成上传和落库。Excel 批量导入不再由服务器端批处理下载，而是复用现有 Excel 解析器返回行数据，由前端队列按并发 3、失败重试 1 次的规则逐条驱动同一个本机助手执行器。不要引入 `client-download/*` 新接口族，不要新增自动更新、开机自启或强制日志上传。

**Tech Stack:** Next.js App Router, TypeScript, Supabase/PostgreSQL, existing `task_queue`, existing `analysis-master-excel.ts`, existing Windows helper (`tools/analysis-download-helper/helper.py`), existing `upload/*` routes.

---

## File Map

- `src/lib/analysis-master-projects.ts`
  - Adds placeholder project creation and status update helpers for local-helper imports.
- `src/app/api/analysis-master/projects/route.ts`
  - Supports creating a `downloading` placeholder project without server-side video download.
- `src/app/api/analysis-master/projects/[id]/route.ts`
  - Adds project status/error updates so helper failures can persist to the same project ID.
- `src/app/api/analysis-master/upload/init/route.ts`
  - Accepts an optional `projectId` and reuses the placeholder project instead of creating a new one.
- `src/app/api/analysis-master/upload/complete/route.ts`
  - Keeps the current upload completion flow, but must finish the placeholder project instead of assuming a fresh one.
- `src/app/api/analysis-master/batch-import/route.ts`
  - Stops enqueuing the server batch processor for the MVP path; returns parsed Excel rows and a `batchId` to the client.
- `src/lib/analysis-master-local-helper.ts`
  - Extends the helper request payload to carry project/batch context for better error handling and retries.
- `src/lib/analysis-master-local-import.ts` *(new)*
  - Shared client-side executor for single-link and batch imports.
- `src/lib/analysis-master-import-queue.ts` *(new)*
  - Concurrency-3 batch runner with one retry per row.
- `src/app/analysis-master/page.tsx`
  - Switches both link import and Excel batch import to the shared local-helper executor.
- `tests/analysis-master-local-helper.test.ts`
  - Update expectations for the new helper request shape.
- `tests/analysis-master-upload-project.test.ts`
  - Add coverage for placeholder project reuse and status updates.
- `tests/analysis-master-import-queue.test.ts` *(new)*
  - Verifies concurrency and retry behavior for batch imports.
- `tests/analysis-master-local-import.test.ts` *(new)*
  - Verifies the shared local-helper executor creates/reuses the right project and marks failures correctly.

---

### Task 1: Add placeholder project lifecycle to the existing project and upload routes

**Files:**
- Modify `src/lib/analysis-master-projects.ts`
- Modify `src/app/api/analysis-master/projects/route.ts`
- Modify `src/app/api/analysis-master/projects/[id]/route.ts`
- Modify `src/app/api/analysis-master/upload/init/route.ts`
- Modify `src/app/api/analysis-master/upload/complete/route.ts`
- Modify `tests/analysis-master-upload-project.test.ts`

- [ ] **Step 1: Write the failing tests**

Add tests that prove the server can:

1. create a placeholder project with status `downloading`
2. update that same project to `download_failed` with an error message
3. reuse a caller-provided `projectId` in `upload/init` instead of creating a second project

Minimal test targets:

```ts
test('analysis master placeholder project is created and updated in place', async () => {
  const created = await createPlaceholderProject({
    userId: 'user-1',
    sourceUrl: 'https://www.tiktok.com/@maker/video/123',
    name: 'Batch row 1',
    importMetadata: { batchId: 'batch-1', rowIndex: '0' },
  });

  assert.equal(created.status, 'downloading');
  assert.equal(created.importMetadata?.batchId, 'batch-1');

  const updated = await updateAnalysisMasterProjectStatus({
    projectId: created.id,
    userId: 'user-1',
    status: 'download_failed',
    error: '视频解析失败，请检查当前网络环境后重试。',
  });

  assert.equal(updated.status, 'download_failed');
  assert.equal(updated.error, '视频解析失败，请检查当前网络环境后重试。');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
pnpm exec tsx --test tests/analysis-master-upload-project.test.ts
```

Expected: fail because placeholder creation / status update / projectId reuse are not wired yet.

- [ ] **Step 3: Implement the minimal server-side lifecycle**

Implement the smallest change set that makes the tests pass:

1. add a helper in `src/lib/analysis-master-projects.ts` for placeholder creation
2. extend `POST /api/analysis-master/projects` so a body like this creates the placeholder row instead of doing a server download:

```json
{
  "sourceUrl": "https://www.tiktok.com/@maker/video/123",
  "name": "Batch row 1",
  "importMode": "local-helper",
  "importMetadata": {
    "batchId": "batch-1",
    "rowIndex": "0"
  }
}
```

3. add `PUT /api/analysis-master/projects/[id]` for status/error updates
4. make `upload/init` accept an optional `projectId` and store it in the upload session
5. keep `upload/complete` compatible with both fresh uploads and placeholder-project uploads

Do not add a new table or a new route family.

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
pnpm exec tsx --test tests/analysis-master-upload-project.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/analysis-master-projects.ts src/app/api/analysis-master/projects/route.ts src/app/api/analysis-master/projects/[id]/route.ts src/app/api/analysis-master/upload/init/route.ts src/app/api/analysis-master/upload/complete/route.ts tests/analysis-master-upload-project.test.ts
git commit -m "feat: add placeholder analysis master project flow"
```

---

### Task 2: Extract a shared local-helper executor and switch single-link import to it

**Files:**
- Modify `src/lib/analysis-master-local-helper.ts`
- Create `src/lib/analysis-master-local-import.ts`
- Modify `src/app/analysis-master/page.tsx`
- Modify `tests/analysis-master-local-import.test.ts`

- [ ] **Step 1: Write the failing test**

Add a test that checks the shared executor:

1. creates a placeholder project
2. passes the returned `projectId` into the helper request
3. marks the project as `download_failed` on helper/network failure

Example shape:

```ts
test('local helper executor reuses the placeholder project id', async () => {
  const result = await runAnalysisMasterLocalImport({
    sourceUrl: 'https://www.tiktok.com/@maker/video/123',
    projectName: 'Link row',
    batchContext: null,
  });

  assert.equal(result.project.status, 'draft');
  assert.equal(result.helperRequest.projectId, result.project.id);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
pnpm exec tsx --test tests/analysis-master-local-import.test.ts
```

Expected: fail because the shared executor does not exist yet.

- [ ] **Step 3: Implement the shared executor**

Create `src/lib/analysis-master-local-import.ts` with a single reusable path that:

1. creates the placeholder project through `POST /api/analysis-master/projects`
2. calls the local helper at `http://127.0.0.1:17321/v1/download`
3. passes `projectId`, `batchId`, `rowIndex`, and `sourceUrl` in the helper request body
4. on failure, calls the new project `PUT` route to persist `download_failed`
5. on success, refreshes the projects list and lets existing analysis enqueue logic continue unchanged

Then update `src/app/analysis-master/page.tsx` so the single-link flow uses that executor instead of owning the full flow inline.

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
pnpm exec tsx --test tests/analysis-master-local-import.test.ts tests/analysis-master-local-helper.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/analysis-master-local-helper.ts src/lib/analysis-master-local-import.ts src/app/analysis-master/page.tsx tests/analysis-master-local-import.test.ts tests/analysis-master-local-helper.test.ts
git commit -m "feat: route analysis master link import through local helper"
```

---

### Task 3: Convert Excel batch import into a client-side queue that reuses the same executor

**Files:**
- Modify `src/app/api/analysis-master/batch-import/route.ts`
- Create `src/lib/analysis-master-import-queue.ts`
- Modify `src/app/analysis-master/page.tsx`
- Modify `tests/analysis-master-import-queue.test.ts`
- Modify `tests/analysis-master-excel.test.ts`

- [ ] **Step 1: Write the failing test**

Add a queue test that proves:

1. rows run with concurrency 3
2. a failed row retries once
3. the queue returns per-row results without aborting the whole batch

Example shape:

```ts
test('analysis master import queue retries one failed row and continues', async () => {
  const calls: string[] = [];
  const results = await runAnalysisMasterImportQueue([
    { sourceUrl: 'https://www.tiktok.com/@a/video/1', metadata: {} },
    { sourceUrl: 'https://www.tiktok.com/@b/video/2', metadata: {} },
    { sourceUrl: 'https://www.tiktok.com/@c/video/3', metadata: {} },
  ], {
    concurrency: 3,
    retries: 1,
    executeRow: async (row) => {
      calls.push(row.sourceUrl);
      return { success: true, projectId: `p-${row.sourceUrl}` };
    },
  });

  assert.equal(results.length, 3);
  assert.equal(calls.length, 3);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
pnpm exec tsx --test tests/analysis-master-import-queue.test.ts
```

Expected: fail because the queue helper does not exist yet.

- [ ] **Step 3: Rework the batch import route into a parser endpoint**

Update `src/app/api/analysis-master/batch-import/route.ts` so it:

1. keeps the existing Excel parsing behavior from `analysis-master-excel.ts`
2. returns parsed rows, `batchId`, `total`, and `limit`
3. does not enqueue `analysis_batch_import` for the MVP path

The client will own the actual batch execution, so the route should be small and deterministic.

Then implement `src/lib/analysis-master-import-queue.ts` to:

1. accept the parsed Excel rows
2. run up to 3 local-helper imports in parallel
3. retry each failed row once
4. preserve per-row failure reasons

Finally, update the batch panel in `src/app/analysis-master/page.tsx` so it:

1. uploads the Excel file to the parser route
2. shows the returned batch summary
3. runs the returned rows through the shared local-helper executor
4. keeps per-row state in the UI and localStorage

Do not build a separate batch job system.

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
pnpm exec tsx --test tests/analysis-master-import-queue.test.ts tests/analysis-master-excel.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/analysis-master/batch-import/route.ts src/lib/analysis-master-import-queue.ts src/app/analysis-master/page.tsx tests/analysis-master-import-queue.test.ts tests/analysis-master-excel.test.ts
git commit -m "feat: run analysis master excel batch through local helper"
```

---

### Task 4: Verify the full MVP path and clean up compatibility edges

**Files:**
- Modify `src/app/analysis-master/page.tsx`
- Modify `src/app/api/analysis-master/projects/[id]/route.ts`
- Modify `src/lib/analysis-master-queue.ts` only if a compatibility label or type needs to stay in sync
- Modify `tests/analysis-master-main-architecture.test.ts`
- Modify `tests/task-visibility.test.ts` only if needed for status/type labels

- [ ] **Step 1: Write the end-to-end regression test**

Add one regression test that proves:

1. single-link import can create a placeholder project
2. a failed helper call marks it `download_failed`
3. Excel batch still reuses the same executor path

If the full browser flow is too heavy for a unit test, keep the test at the route/helper level and make the assertion about project state transitions explicit.

- [ ] **Step 2: Run the regression test and the project checks**

Run:

```bash
pnpm exec tsx --test tests/analysis-master-main-architecture.test.ts tests/analysis-master-local-import.test.ts tests/analysis-master-import-queue.test.ts tests/analysis-master-upload-project.test.ts
pnpm ts-check
pnpm lint
```

Expected: all pass.

- [ ] **Step 3: Verify the build if the touched page bundle is stable**

Run:

```bash
pnpm next build
```

Expected: build succeeds without new errors from the analysis-master page or helper flow.

- [ ] **Step 4: Commit**

```bash
git add src/app/analysis-master/page.tsx src/app/api/analysis-master/projects/[id]/route.ts src/lib/analysis-master-queue.ts tests/analysis-master-main-architecture.test.ts tests/task-visibility.test.ts
git commit -m "fix: unify analysis master local import flows"
```

---

## Verification

Before marking this MVP complete:

- `pnpm exec tsx --test tests/analysis-master-upload-project.test.ts tests/analysis-master-local-helper.test.ts tests/analysis-master-local-import.test.ts tests/analysis-master-import-queue.test.ts`
- `pnpm ts-check`
- `pnpm lint`
- `pnpm next build`

Manual check:

- single-link import creates a project record before the helper downloads
- failed download persists as `download_failed`
- retry reuses the same project ID
- Excel batch uses the same helper executor and does not fall back to the server-side batch downloader

## Risks

- Adding placeholder project status updates touches project lifecycle and must not break delete/retry behavior.
- Batch import shifting to the client will increase front-end complexity; keep the queue logic isolated in one helper module.
- The existing server-side batch processor becomes non-primary and should not be removed until the new batch path is proven.
- Helper failures must continue to hide internal URLs, tokens, and storage details from the user-facing error strings.
