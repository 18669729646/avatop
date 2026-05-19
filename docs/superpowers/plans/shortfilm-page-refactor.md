# ShortFilmNewContent 拆分实施计划

## Step 1: 提取 useModelConfig Hook
**Files**: 
- 新建: `src/hooks/use-model-config.ts`
- 修改: `src/app/shortfilm/new/page.tsx`

**What**: 
提取 6 个模型配置状态（selectedTextModelId/Config, selectedImageModelId/Config, selectedVideoModelId/Config）及其初始化逻辑到独立 Hook。

**Verify**: `pnpm ts-check` + `pnpm next build` 通过

---

## Step 2: 提取 useRemakeMode Hook
**Files**:
- 新建: `src/hooks/use-remake-mode.ts`
- 修改: `src/app/shortfilm/new/page.tsx`

**What**:
提取复刻模式相关状态（remakeMode, remakeVideoKey/Url/Duration, remakeUploading 等）和操作函数（handleRemakeFileSelect, handleRemakeUpload, handleRemakeLinkSubmit, handleRemakeParse）到独立 Hook。

**Verify**: `pnpm ts-check` + `pnpm next build` 通过

---

## Step 3: 提取 useScriptGeneration Hook
**Files**:
- 新建: `src/hooks/use-script-generation.ts`
- 修改: `src/app/shortfilm/new/page.tsx`

**What**:
提取脚本生成相关状态（isGeneratingScript, showScriptConfirm, scriptRequestBody, scriptTaskId 等）和 executeGenerateScript 函数及脚本轮询 useEffect。

**Verify**: `pnpm ts-check` + `pnpm next build` 通过

---

## Step 4: 提取 useTaskPolling Hook
**Files**:
- 新建: `src/hooks/use-task-polling.ts`
- 修改: `src/app/shortfilm/new/page.tsx`

**What**:
提取任务轮询相关状态（pollingTrigger, imageTaskMappingRef, videoTaskMappingRef 等）和图片/视频轮询 useEffect，以及 executeImageGeneration/executeVideoGeneration 函数。

**Verify**: `pnpm ts-check` + `pnpm next build` 通过

---

## Step 5: 提取 useShortFilmProject Hook
**Files**:
- 新建: `src/hooks/use-shortfilm-project.ts`
- 修改: `src/app/shortfilm/new/page.tsx`

**What**:
提取项目初始化/保存相关状态和函数（project, updateProject, saveProjectSync, 自动保存 useEffect, 初始化 useEffect 等）。这是最复杂的一步。

**Verify**: `pnpm ts-check` + `pnpm next build` 通过

---

## Step 6: 提取 StepIndicator 组件
**Files**:
- 新建: `src/components/shortfilm/step-indicator.tsx`
- 修改: `src/app/shortfilm/new/page.tsx`

**What**:
提取步骤指示器渲染逻辑（getStepStatus, handleStepClick, updateMaxCompletedStep, renderStepIndicator）。

**Verify**: `pnpm ts-check` + `pnpm next build` 通过

---

## Step 7: 提取 Step1-5 子组件
**Files**:
- 新建: `src/components/shortfilm/step1-script-generation.tsx`
- 新建: `src/components/shortfilm/step2-script-confirm.tsx`
- 新建: `src/components/shortfilm/step3-image-generation.tsx`
- 新建: `src/components/shortfilm/step4-video-generation.tsx`
- 新建: `src/components/shortfilm/step5-preview.tsx`
- 修改: `src/app/shortfilm/new/page.tsx`

**What**:
逐步提取每个步骤的 JSX 渲染逻辑为独立组件。每个组件接收必要的 props。

**Verify**: `pnpm ts-check` + `pnpm next build` 通过

---

## Step 8: 提取确认对话框组件
**Files**:
- 新建: `src/components/shortfilm/script-confirm-dialog.tsx`
- 新建: `src/components/shortfilm/image-confirm-dialog.tsx`
- 新建: `src/components/shortfilm/video-confirm-dialog.tsx`
- 修改: `src/app/shortfilm/new/page.tsx`

**What**:
提取三个确认对话框为独立组件。

**Verify**: `pnpm ts-check` + `pnpm next build` 通过

---

## Step 9: 最终验证
**What**:
- 运行 `pnpm ts-check`
- 运行 `pnpm lint`
- 运行 `pnpm next build`
- 启动开发服务器验证页面可访问
- 确认 ESLint errors 显著减少
