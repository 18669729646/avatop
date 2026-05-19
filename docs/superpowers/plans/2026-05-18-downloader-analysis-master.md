# Avatop Downloader And Analysis Master Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the shortfilm link downloader with an ssstik-first provider and add a SaaS Analysis Master module that migrates the local video analysis workflow.

**Architecture:** Introduce focused service modules under `src/lib` for downloader and analysis parsing, then expose them through Next.js API routes. Keep existing shortfilm remake APIs stable while adding a separate `/analysis-master` feature surface that reuses auth, S3, system config, credits, and task queue patterns.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase/PostgreSQL, S3-compatible storage, Gemini-compatible APIs, existing task queue and credits modules.

---

## File Structure

- Create `src/lib/video-downloader.ts`: provider abstraction, ssstik HTML/request parsing, optional yt-dlp fallback wrapper.
- Modify `src/app/api/shortfilm/remake-link/route.ts`: replace direct yt-dlp calls with the downloader abstraction.
- Create `src/lib/analysis-master.ts`: normalize Gemini analysis output into reusable scene rows.
- Create `src/app/api/analysis-master/projects/route.ts`: list/create analysis projects from upload or link metadata.
- Create `src/app/api/analysis-master/analyze/[id]/route.ts`: run Gemini video analysis on stored S3 video.
- Create `src/app/analysis-master/page.tsx`: simple SaaS UI for link input, upload note, history, analysis results.
- Modify `src/components/app-layout.tsx`: add sidebar entry.
- Modify `src/storage/database/shared/schema.ts`: add Drizzle shape for analysis projects if backed by DB.
- Create `supabase/migrations/012_analysis_master.sql`: DB table, indexes, and default credit price.
- Modify `AGENTS.md`: document downloader provider and Analysis Master module.

## Tasks

### Task 1: Add ssstik-first downloader service

- [ ] Create `src/lib/video-downloader.ts` with `downloadVideoFromUrl(url, options)` returning `{ buffer, contentType, fileName, title, duration }`.
- [ ] Implement ssstik request attempts against known form endpoints and parse MP4 links from returned HTML.
- [ ] Implement yt-dlp fallback through `child_process` only when provider is `auto` or `yt-dlp`.
- [ ] Unit-check by TypeScript compile; runtime ssstik remains best-effort because endpoint is unofficial.

### Task 2: Wire downloader into shortfilm remake link API

- [ ] Modify `src/app/api/shortfilm/remake-link/route.ts` to call `downloadVideoFromUrl`.
- [ ] Preserve auth, storage quota check, S3 upload, project update response shape.
- [ ] Return clear 502 errors when provider fails.

### Task 3: Add Analysis Master data model and APIs

- [ ] Add `analysis_master_projects` migration with user isolation, source metadata, status, result JSON, errors, timestamps.
- [ ] Add Drizzle schema export for the new table.
- [ ] Add project list/create API under `/api/analysis-master/projects`.
- [ ] Add analyze API under `/api/analysis-master/analyze/[id]` using Gemini File API style already present in remake parse.

### Task 4: Add Analysis Master UI

- [ ] Add `/analysis-master` page with link input, create button, project list, analyze button, result viewer.
- [ ] Add sidebar navigation item in `AppLayout`.
- [ ] Keep mobile layout responsive using existing card/grid patterns.

### Task 5: Validate and document

- [ ] Run `pnpm ts-check` or targeted TypeScript compile if dependencies are available.
- [ ] Run lint if feasible without unrelated failures.
- [ ] Update `projects/AGENTS.md` with provider risks, new routes, and test commands.
