# ShortFilmNewContent 巨型组件拆分规格

## 问题

`src/app/shortfilm/new/page.tsx` 有 4531 行，包含：
- 41 个 useState + 13 个 useRef = 54 个状态变量
- 14 个 useEffect（初始化 useEffect 独占 580 行）
- 5 个 useCallback + 8 个普通函数
- JSX 渲染 1776 行（步骤1-5）

导致：
1. React Compiler 无法正确优化（50 个 ESLint error）
2. 任何修改都可能引入回归 bug
3. 代码可读性和可维护性极差

## 目标

将巨型组件拆分为**自定义 Hooks + 子组件**，每个模块不超过 300 行，解决 React Compiler 兼容性问题。

## 拆分策略

### 原则
1. **渐进式拆分**：每次只拆一个模块，拆完验证再继续
2. **状态就近**：每个 Hook 只管理自己关心的状态
3. **接口最小化**：子组件只接收必要的 props
4. **不改变功能**：纯重构，不增不减功能

### 拆分方案

#### 自定义 Hooks（5个）

| Hook | 职责 | 管理的状态 | 来源行号 |
|------|------|-----------|----------|
| `useShortFilmProject` | 项目初始化/保存/自动保存 | project, currentStep, maxCompletedStep, isProjectInitializedRef 等 | L100-103, L180-192, L1217-1800, L2044-2165 |
| `useModelConfig` | AI模型配置管理 | selectedTextModelId/Config, selectedImageModelId/Config, selectedVideoModelId/Config | L195-200 |
| `useRemakeMode` | 复刻模式状态和操作 | remakeMode, remakeVideoKey/Url/Duration, remakeUploading 等 | L115-124, L617-810 |
| `useTaskPolling` | 图片/视频任务轮询 | pollingTrigger, imageTaskMappingRef, videoTaskMappingRef, pollingTaskIdsRef | L137-144, L178-179, L181-182, L139, L1812-2043 |
| `useScriptGeneration` | 脚本生成流程 | isGeneratingScript, showScriptConfirm, scriptRequestBody, scriptTaskId 等 | L112, L273-277, L815-851, L2206-2289 |

#### 子组件（6个）

| 组件 | 职责 | 来源行号 |
|------|------|----------|
| `StepIndicator` | 步骤指示器 | L2298-2390 |
| `Step1ScriptGeneration` | 步骤1：脚本生成（含复刻模式） | L2429-3077 |
| `Step2ScriptConfirm` | 步骤2：确认脚本 | L3080-3311 |
| `Step3ImageGeneration` | 步骤3：图片生成 | L3314-3782 |
| `Step4VideoGeneration` | 步骤4：视频生成 | L3785-4047 |
| `Step5Preview` | 步骤5：预览成果 | L4050-4205 |

#### 对话框组件（3个）

| 组件 | 来源行号 |
|------|----------|
| `ScriptConfirmDialog` | L4212-4248 |
| `ImageConfirmDialog` | L4251-4302 |
| `VideoConfirmDialog` | L4305-4371 |

### 文件结构

```
src/
├── app/shortfilm/new/
│   └── page.tsx                    # 主页面（精简后 ~200 行）
├── hooks/
│   ├── use-shortfilm-project.ts    # 项目初始化/保存
│   ├── use-model-config.ts         # AI模型配置
│   ├── use-remake-mode.ts          # 复刻模式
│   ├── use-task-polling.ts         # 任务轮询
│   └── use-script-generation.ts    # 脚本生成
├── components/shortfilm/
│   ├── step-indicator.tsx          # 步骤指示器
│   ├── step1-script-generation.tsx # 步骤1
│   ├── step2-script-confirm.tsx    # 步骤2
│   ├── step3-image-generation.tsx  # 步骤3
│   ├── step4-video-generation.tsx  # 步骤4
│   ├── step5-preview.tsx           # 步骤5
│   ├── script-confirm-dialog.tsx   # 脚本确认对话框
│   ├── image-confirm-dialog.tsx    # 图片确认对话框
│   └── video-confirm-dialog.tsx    # 视频确认对话框
```

### 实施顺序（由内到外，风险从低到高）

1. **useModelConfig** — 最独立，无依赖，0 风险
2. **useRemakeMode** — 较独立，仅依赖 API 调用
3. **useScriptGeneration** — 依赖 useModelConfig
4. **useTaskPolling** — 依赖 imageTaskMappingRef 等
5. **useShortFilmProject** — 最复杂，依赖最多
6. **StepIndicator** — 纯 UI 子组件
7. **Step1-5 子组件** — 逐步提取 JSX
8. **确认对话框组件** — 最后提取

### 风险控制

- 每拆一个模块，立即运行 `pnpm ts-check` + `pnpm next build`
- 保持所有 props 类型严格，不用 any
- 不改变任何业务逻辑，只做结构重组
- 每步完成后 git 可回滚
