# AGENTS.md

## 项目概览

基于 Next.js 16 的 AI 图片/视频生成平台，包含短片管理（带货）、视频复制、广告模板、SaaS 首页等功能。支持 AI 自动生成和手动输入脚本两种模式。视频复制功能已合并到短片功能中，共用编辑页面，仅入口不同。
### 技术栈

- **框架**: Next.js 16 (App Router)
- **核心**: React 19
- **语言**: TypeScript 5
- **UI 组件**: shadcn/ui (基于 Radix UI)
- **样式**: Tailwind CSS 4
- **图表**: Recharts
- **数据库**: PostgreSQL (Supabase)
- **存储**: S3 兼容对象存储
- **HTTP 客户端**: undici (Node.js 原生 fetch)

## 构建和测试命令
### 开发环境
```bash
pnpm dev  # 启动开发服务器（端口 5000）
```

### 构建和部署
```bash
pnpm build   # 构建生产版本
pnpm start   # 启动生产环境
```

### 代码检查
```bash
pnpm lint      # ESLint 代码检查
pnpm ts-check  # TypeScript 类型检查
```

## 项目结构

```
.
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/               # API 路由
│   │   │   ├── tasks/        # 任务相关 API
│   │   │   ├── generate/     # 图片生成 API
│   │   │   ├── video/        # 视频生成 API
│   │   │   ├── shortfilm/    # 短片管理 API（含复制相关）
│   │   │   │   ├── projects/          # 项目 CRUD
│   │   │   │   ├── remake-upload/     # 复制视频上传
│   │   │   │   ├── remake-link/       # 复制链接解析
│   │   │   │   ├── remake-parse/      # 复制AI解析
│   │   │   │   └── remake-chunk-*/    # 分片上传
│   │   │   └── ...
│   │   ├── shortfilm/        # 短片编辑页面（原+复制共用）
│   │   ├── video-remake/     # 视频复制入口页面（列表+新建）
│   │   ├── queue/            # 任务队列页面
│   │   └── ...
│   ├── components/           # React 组件
│   │   └── ui/              # shadcn/ui 组件
│   └── lib/                  # 工具库
│       ├── fetch-agent.ts   # HTTP Agent 配置
│       ├── shortfilm.ts     # 短片管理工具（含复制数据模型）
│       ├── prompt-variables.ts # 提示词模板（含复制提示词）
│       └── ...
├── storage/              # 数据库相关
│   └── database/        # 数据库 schema 和工具
├── supabase/migrations/      # 数据库迁移文件
└── public/                   # 静态资源
```

## 代码风格指南

### TypeScript
- 使用 TypeScript 5 严格模式
- 所有函数参数必须标注类型
- 所有组件/函数使用前必须 import
- 避免使用隐式 any

### React/Next.js
- 使用 React 19 新特性
- 组件使用 `use client` 指令时配合 useEffect + useState 确保客户端渲染
- 避免非法 HTML 嵌套（如 `<p>` 嵌套 `<div>`）
- 使用 shadcn/ui 组件风格

### 样式
- 使用 Tailwind CSS 4
- 优先使用 Tailwind 类名而非内联样式
- 保持样式一致性
### API 响应格式
所有 API 必须使用统一的响应格式：
```typescript
// 成功响应
return NextResponse.json({
  success: true,
  data: { ... }
});

// 错误响应
return NextResponse.json({
  success: false,
  error: '错误信息'
}, { status: 400 });
```

### 错误处理模式
使用统一的错误处理工具函数：
```typescript
import { logApiError, errorResponse } from '@/lib/logger';

// 在 try/catch 中使用
try {
  // 业务逻辑
} catch (error) {
  return errorResponse('API名称', '操作名称', error, userId);
}
```

## 测试说明

### 代码静态检查（必做）
```bash
pnpm lint
pnpm ts-check
```

### API 接口测试
使用 `test_run` 工具执行接口冒烟测试：
```bash
# 测试任务创建
curl -s -X POST -H 'Content-Type: application/json' -d '{...}' http://localhost:5000/api/tasks

# 测试图片生成
curl -s -X POST -H 'Content-Type: application/json' -d '{...}' http://localhost:5000/api/generate

# 测试视频生成
curl -s -X POST -H 'Content-Type: application/json' -d '{...}' http://localhost:5000/api/video
```

### 服务存活探测
```bash
curl -I http://localhost:5000
```

### 日志检查
```bash
# 检查最新错误
tail -n 50 /app/work/logs/bypass/app.log | grep -iE "error|exception|warn"

# 检查最新日志
tail -n 50 /app/work/logs/bypass/app.log
```

## 安全注意事项

### 敏感信息处理
- API Key 脱敏存储：前端显示 `sk-****xxxx`，后端使用真实 Key
- 任务创建时不存储 apiKey
- 查询时根据用户角色过滤敏感字段
- 使用内部认证 header 传递用户信息
### 环境变量
- 所有配置通过环境变量获取，禁止硬编码
- JWT_SECRET 必须设置强密钥
- 数据库连接字符串使用环境变量

### 网络请求
- 使用 undici Agent 配置超时
- 长时间运行的请求使用 `longRunningAgent`
- 正确处理连接超时和请求超时
## 常见问题

### 图片生成失败（连接超时）
**问题**: `ConnectTimeoutError: Connect Timeout Error (attempted address: grsaiapi.com:443, timeout: 10000ms)`

**解决方案**: 在 `src/lib/fetch-agent.ts` 中添加 `connectTimeout` 配置：
```typescript
export const longRunningAgent = new Agent({
  connectTimeout: 10 * 60 * 1000,    // 10 分钟连接超时
  headersTimeout: 10 * 60 * 1000,    // 10 分钟
  bodyTimeout: 10 * 60 * 1000,       // 10 分钟
  keepAliveTimeout: 60 * 1000,
  keepAliveMaxTimeout: 10 * 60 * 1000,
});
```

### 脚本生成一直显示"生成中"
**问题**: SSE 事件在开发模式下可能无法正确传递到前端

**解决方案**: 添加脚本任务轮询机制作为 SSE 备用方案

### 任务执行时 API Key 为空
**问题**: 前端提示"请先在系统设置中配置 API Key"

**解决方案**:
1. 检查 `/api/system-config` API 是否正确从 `config.defaults` 读取默认 ID
2. 检查前端检查逻辑是否使用 `apiKeyMasked` 作为备选判断
### middleware 弃用警告
**问题**: Next.js 16 提示 "The 'middleware' file convention is deprecated"

**解决方案**: 将 `src/middleware.ts` 重命名为 `src/proxy.ts`，并将导出函数名从 `middleware` 改为 `proxy`

### /@vite/client 404 错误
**问题**: 开发工具请求 `/@vite/client` 返回 404

**解决方案**: 创建 `src/proxy.ts` 拦截请求：
```typescript
export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === '/@vite/client') {
    return new NextResponse(null, { status: 204 });
  }
  return NextResponse.next();
}
```

## 数据库迁移
创建新迁移文件：
```bash
# 格式: migrations/{序号}_{描述}.sql
# 示例: migrations/005_add_script_generation_mode.sql
```

执行迁移：
```sql
-- 迁移文件内容
ALTER TABLE shortfilm_projects ADD COLUMN script_generation_mode TEXT DEFAULT 'ai';
```

## 集成服务使用

### S3 对象存储
使用 `src/lib/s3-client.ts` 中的 `s3Storage` 实例：
```typescript
import { s3Storage } from '@/lib/s3-client';

// 上传文件
const key = await s3Storage.uploadFile({
  fileContent: buffer,
  fileName: 'path/to/file.jpg',
  contentType: 'image/jpeg',
});

// 生成签名 URL
const url = await s3Storage.generatePresignedUrl({
  key,
  expireTime: URL_EXPIRE_TIME,
});
```

### Supabase 数据库
使用 `src/lib/database.ts` 中的 `getSupabaseClient`：
```typescript
import { getSupabaseClient } from '@/lib/database';

const supabase = getSupabaseClient();
const { data, error } = await supabase
  .from('table_name')
  .select('*')
  .eq('id', id);
```

## 日志记录

### 日志目录
- `/app/work/logs/bypass/app.log` - 主流程日志
- `/app/work/logs/bypass/dev.log` - 调试日志
- `/app/work/logs/bypass/console.log` - 浏览器控制台日志

### 日志记录方式
```typescript
import { logTaskError } from '@/lib/task-logging';

// 记录任务错误
logTaskError(taskId, '操作名称', error, {
  userId: task.user_id,
  type: task.type,
  // 其他上下文信息
}, task.user_id);
```

### 日志分类
项目使用统一的日志系统，支持分类记录：
```typescript
import { logError, logInfo, logWarn, logApiError, logTaskError, logAuthError, logStorageError } from '@/lib/logger';

// 通用错误
logError('api', '操作描述', error, { detail: '额外信息' }, userId);

// 便捷方法
logApiError('API名称', '操作', error, { detail: '额外信息' }, userId);
logTaskError('taskId', '操作', error, { detail: '额外信息' }, userId);
logAuthError('操作', error, { detail: '额外信息' }, userId);
logStorageError('操作', error, { detail: '额外信息' }, userId);
```

### 错误分类
- **模型错误** (isModelError): API 限流、参数错误、模型不可用等 → 记录为 INFO
- **系统错误**: 代码异常、数据库错误等 → 记录为 ERROR

## 视频复制功能

### 功能概述
爆款短视频 AI 复制功能，支持输入短视频链接或上传视频，AI 自动解析视频环境、脚本、镜头语言、口播文本，生成高还原度视频素材。
**V3架构**：视频复制已合并到短片功能中，共用编辑页面（`/shortfilm/new`），步骤2-5完全复用短片流程。仅步骤1根据入口不同显示不同UI。
### 入口与流程
- **原创入口**：`/shortfilm/new` → 步骤1选择产品+生成脚本
- **复制入口**：`/video-remake/new` → 创建项目 → 跳转 `/shortfilm/new?id={id}` → 步骤1上传/解析视频
- **复制列表**：`/video-remake` → 查询 `sourceType='remake'` 的短片项目
### 数据模型
复制项目使用 `shortfilm_projects` 表，通过 `source_type` 字段区分：
- `source_type='original'`：原创短片（默认）
- `source_type='remake'`：视频复制
复制专用字段：
- `source_video_key`：原始视频 S3 key
- `source_video_url`：原始视频预签名URL（7天有效期）
- `video_duration`：视频时长（秒）

### 数据库表
- `shortfilm_projects` - 短片项目表（原创+复制共用）
- `video_remake_projects` - 历史复制项目表（已弃用，保留历史数据）
- `video_remake_scenes` - 历史分镜表（已弃用，保留历史数据）
### API 接口
复制相关 API 在短片命名空间下：
- `POST /api/shortfilm/remake-upload` - 上传视频（小文件）
- `POST /api/shortfilm/remake-link` - 链接解析（yt-dlp，支持 TikTok/YouTube/抖音/B站等）
- `POST /api/shortfilm/remake-parse/[id]` - AI深度解析（Gemini多模态模型）
- `POST /api/shortfilm/remake-chunk-init` - 分片上传初始化
- `POST /api/shortfilm/remake-chunk-upload` - 分片上传
- `POST /api/shortfilm/remake-chunk-complete` - 分片上传完成

共用短片 API：
- `GET/POST /api/shortfilm/projects` - 项目列表/创建（支持 `sourceType=remake` 过滤）
- `GET/PUT/DELETE /api/shortfilm/projects/[id]` - 单个项目管理
- `POST /api/shortfilm/generate-image` - 图片生成
- `POST /api/shortfilm/generate-script` - 脚本生成

### 提示词模板
复制解析提示词从数据库 `system_prompt_config` 表读取（id=`video_remake`），支持管理员后台配置。如无自定义配置，使用 `prompt-variables.ts` 中的默认模板。
### 注意事项
- `sourceVideoUrl` 是预签名URL，7天后过期，加载项目时需刷新
- 解析结果映射为 `ScriptSegment[]` 格式，包含 `imagePrompt`, `videoPrompt`, `speechText`, `audioPrompt` 等字段
- 视频生成使用 Veo 3.1 收尾帧技术，每段8秒
## 积分系统

### 扣除积分
```typescript
import { consumeCredits } from '@/lib/credits';

const result = await consumeCredits(userId, 'image_generate', taskId, 'image');
if (!result.success) {
  console.error('扣除积分失败:', result.error);
}
```

### 检查积分
```typescript
import { checkUserCredits } from '@/lib/credits';

const check = await checkUserCredits(userId, 5);
if (!check.hasEnough) {
  return NextResponse.json(
    { error: `积分不足，当前积分${check.balance}，需要${check.required} 积分` },
    { status: 402 }
  );
}
```

## 存储配额

### 检查存储配额
```typescript
import { checkStorageQuota } from '@/lib/storage-quota';

const storageCheck = await checkStorageQuota(userId);
if (!storageCheck.allowed) {
  return NextResponse.json(
    { error: storageCheck.error },
    { status: 507 }
  );
}
```

## 任务队列

### 创建任务
```typescript
import { createImageTask } from '@/lib/tasks';

const taskId = await createImageTask(supabase, {
  user_id: userId,
  params: {
    prompt: '提示词',
    aspectRatio: '9:16',
    resolution: '2K',
    baseUrl: 'https://api.example.com',
    model: 'nano-banana-2',
  },
  project_id: projectId,
});
```

### 处理任务
任务会自动由 `/api/tasks/process` 处理，无需手动调用。
### 任务状态机
```
pending → running → completed
                   ↘ failed → retrying → running
```

### 任务特性
- **心跳机制**: 30秒更新一次，防止任务丢失
- **乐观锁**: 防止并发处理同一任务
- **重试机制**: 失败任务自动重试
- **SSE推送**: 实时推送任务进度
## 开发规范
### 端口使用
- Web 服务必须运行在 **5000** 端口
- 禁止使用 9000 端口（系统保留）

### 包管理器
- 仅允许使用 **pnpm**
- 禁止使用 npm 或 yarn

### 环境变量
- 使用 `process.env.DEPLOY_RUN_PORT` 获取服务端口
- 使用 `process.env.COZE_PROJECT_DOMAIN_DEFAULT` 获取对外域名
- 禁止硬编码域名或端口

### 文件存储
- 生成文件优先存储到对象存储
- 临时文件使用 `/tmp` 目录（生产环境）

## 调试流程

### 1. 查看错误日志
```bash
tail -n 50 /app/work/logs/bypass/app.log
```

### 2. 定位错误
- 前端问题：优先查看 console.log
- 后端问题：优先查看 app.log
- API 问题：检查 dev.log

### 3. 修复代码
- 根据错误信息定位问题
- 修复后重启服务或依赖热更新
### 4. 验证修复
- 执行代码静态检查
- 测试相关功能
- 检查日志确认无新错误
## 知识沉淀

### 核心模块说明

| 模块 | 路径 | 说明 |
|------|------|------|
| 用户认证 | `src/lib/auth.ts` | JWT 签发/验证、密码哈希 |
| 认证中间件 | `src/lib/auth-middleware.ts` | API 鉴权、权限检查 |
| 积分系统 | `src/lib/credits.ts` | 积分扣除、充值、查询 |
| 任务处理 | `src/app/api/tasks/process/route.ts` | 核心异步任务处理器 |
| SSE 推送 | `src/lib/task-events.ts` | 实时任务进度推送 |
| 文件存储 | `src/lib/s3-client.ts` | S3 单例客户端 |
| AI 配置 | `src/lib/server-config.ts` | AI API 配置管理 |
| 日志系统 | `src/lib/logger.ts` | 统一日志记录 |
| 短片数据模型 | `src/lib/shortfilm.ts` | ShortFilmProject + ScriptSegment 接口定义 |
| 复制解析 | `src/app/api/shortfilm/remake-parse/[id]/route.ts` | Gemini多模态视频解析 |
| 视频下载适配 | `src/lib/video-downloader.ts` | ssstik 优先、yt-dlp 降级的视频下载层 |
| 分析大师 | `src/lib/analysis-master.ts` | 视频分镜拆解结果标准化与 Gemini 分析 |
| 提示词模板 | `src/lib/prompt-variables.ts` | AI提示词模板（含复制提示词）|

### 常用工具函数索引

| 场景 | 函数 | 文件 |
|------|------|------|
| 鉴权 | `authenticateRequest()` | `auth-middleware.ts` |
| 积分扣除 | `consumeCredits()` | `credits.ts` |
| 积分检查 | `checkUserCredits()` | `credits.ts` |
| HTTP 请求 | `fetchWithTimeout()` | `fetch-agent.ts` |
| 文件上传 | `s3Storage.uploadFile()` | `s3-client.ts` |
| 预签名URL | `s3Storage.generatePresignedUrl()` | `s3-client.ts` |
| SSE 推送 | `broadcastTaskUpdate()` | `task-events.ts` |
| 错误记录 | `logTaskError()` | `logger.ts` |
| 视频下载 | `downloadVideoFromUrl()` | `video-downloader.ts` |

### AI API 配置结构
```typescript
interface ApiConfig {
  baseUrl: string;      // API 基础地址
  apiKey: string;       // API Key
  model?: string;       // 模型名称
}

// 获取配置
import { getServerDefaultImageApi, getServerDefaultVideoApi } from '@/lib/server-config';

const imageApi = await getServerDefaultImageApi();
const videoApi = await getServerDefaultVideoApi();
```

### 数据库表关系
```
users (用户)
  ├── user_credits (积分)
  ├── user_settings (设置)
  ├── task_queue (任务)
  ├── shortfilm_projects (短片项目，含复制项目 source_type='remake')
  │   └── script_segments (JSONB: 脚本分段)
  ├── analysis_master_projects (分析大师项目)
  ├── video_remake_projects (历史复制项目，已弃用)
  └── usage_records (积分使用记录)
```

### 视频下载与分析大师
- 短片复制链接导入通过 `src/lib/video-downloader.ts` 下载视频，默认 `VIDEO_DOWNLOAD_PROVIDER=auto`。
- `auto` 策略会对 TikTok/抖音类链接优先尝试 ssstik，再降级到 `yt-dlp`；非 TikTok 平台仍依赖 `yt-dlp`。
- ssstik 是网页型非官方下载方案，批量下载存在反爬、限流、页面结构变化、第三方日志记录和服务不可用风险；生产环境必须限制并发并保留降级方案。
- 分析大师页面为 `/analysis-master`，API 为 `/api/analysis-master/projects` 和 `/api/analysis-master/analyze/[id]`。
- 分析大师项目存储在 `analysis_master_projects` 表，迁移文件为 `supabase/migrations/012_analysis_master.sql`。
- 分析大师分析执行通过 `task_queue.type='analysis'` 后台处理，`/api/analysis-master/analyze/[id]` 只负责抢锁和入队，前端轮询项目状态。
- 分析大师会调用文本模型的 Gemini 多模态能力，涉及上传、AI 调用、积分扣除和对象存储；修改时必须检查错误处理、超时、用户数据隔离、扣费幂等性和任务重试状态。
## 联系和支持
如有问题，请检查：
1. 本 AGENTS.md 文档
2. 代码注释
3. 日志文件
4. 项目 README.md

## 2026-05-19 分析大师集成说明

- `/analysis-master` 使用现有 SaaS 的 `AppLayout`、shadcn/ui、Tailwind 卡片/按钮体系，新增页面改动需继续保持移动端适配。
- 分析大师项目数据存储在 `analysis_master_projects`，迁移文件为 `supabase/migrations/012_analysis_master.sql`。
- 分析任务统一进入 `task_queue`，任务类型为 `analysis`，由 `/api/tasks/process` 后台处理；业务接口 `/api/analysis-master/analyze/[id]` 只负责鉴权、积分预检、项目抢锁和入队。
- 分析大师 AI 调用走 `getServerDefaultTextApi()`，复用系统后台"文本模型"配置；不要在功能代码中硬编码模型、API Key 或 Base URL。
- 分析大师提示词走 `system_prompt_config.id='analysis_master'`，管理员可在提示词设置页配置；默认模板和变量定义维护在 `src/lib/prompt-variables.ts`。
- 分析大师涉及上传、对象存储、数据库、任务队列、积分扣除和 Gemini 多模态调用；修改时必须验证错误处理、用户数据隔离、存储配额、任务失败状态和积分幂等风险。
- 分析大师上传/链接导入必须在 S3 上传成功但数据库写入失败时清理已上传对象，避免对象存储泄漏。
- 分析大师积分预检必须读取 `system_credit_prices.action_type='video_analysis_master'`，不得硬编码积分价格。
- 视频下载 URL 校验必须同时检查协议、localhost/元数据域名、IP 字面量和 DNS 解析后的私网/保留地址；ssstik 与 yt-dlp 降级路径都必须走同一校验。
## 2026-05-19 接口安全补充

- `/api/tasks/process` 是任务执行入口，必须要求有效 `Authorization: Bearer <token>`，不得仅凭 `x-internal-auth` 触发；非管理员只能处理/查看自己的任务，管理员才可处理全局队列。
- 分析大师上传、链接导入和后台分析执行统一限制视频大小为 100MB；修改大小限制时必须同步更新项目创建接口、任务执行接口和前端提示。
- 分析大师接口不得向前端返回数据库、S3 或 AI SDK 的原始错误信息；详细错误只写入服务端日志，前端返回稳定的业务错误文案。

## 2026-05-19 Seedance 积分扣费规则

- Seedance 视频任务创建接口只做余额预检和入队，不在入队后异步扣费。
- Seedance 视频任务成功后，由 `src/app/api/tasks/process/route.ts` 读取任务参数中的 `action_type` 和 `credits_required`，调用 `consumeFixedCredits()` 按实际任务金额扣一次。
- 非 Seedance 视频任务继续使用 `consumeCredits(userId, 'video_generate', taskId, 'video')` 按系统积分价格扣费。
- 所有扣费必须以 `task.id` 作为 `resource_id` 写入 `usage_records`，依赖唯一任务资源记录避免重复扣费。

## 2026-05-19 Seedance 后台单价配置

- Seedance 每秒单价必须从 `system_credit_prices` 读取，不允许在业务代码中硬编码价格表。
- 默认价格由 `supabase/migrations/013_seedance_credit_prices.sql` 初始化，后台积分设置页通过 `video_seedance2_*` action type 维护每秒积分。
- Seedance 创建任务时使用后台单价乘以视频时长得到 `credits_required`，任务成功后继续按该固定金额扣费。

## 2026-05-19 分析大师积分扣费规则

- 分析大师默认每条 50 积分，但业务接口不得写死为固定价格，必须从 `system_credit_prices.action_type='video_analysis_master'` 读取。
- `/api/analysis-master/analyze/[id]` 创建任务时读取后台价格做余额预检，并将当时价格写入任务参数 `creditsRequired`。
- `task_queue.type='analysis'` 执行时优先按任务参数中的 `creditsRequired` 调用 `consumeFixedCredits()` 扣费，保证管理员后续改价不影响已入队任务。
- 如果历史任务缺少 `creditsRequired`，执行时才回退到 `consumeCredits()` 读取当前后台价格。
- 默认 50 积分由 `supabase/migrations/014_analysis_master_credit_price.sql` 初始化/修正，管理员可在后台积分配置页继续调整。
- 分析大师任务失败不得扣积分；扣费必须发生在 AI 分析成功之后、项目和任务标记成功之前。
- 后台价格允许配置为 0；任务参数 `creditsRequired=0` 表示免费分析，不得回退为读取当前价格。
