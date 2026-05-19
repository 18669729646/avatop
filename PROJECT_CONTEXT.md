# PROJECT_CONTEXT.md

## 1. 项目简介

这是一个基于 Next.js 16 的全栈 AI 内容创作平台，面向跨境电商和短视频营销场景，支持图片生成、视频生成、短片脚本管理、广告模板管理、视频复刻、角色/产品图库、任务队列、积分系统和管理后台等能力。

项目采用 App Router 架构，前后端一体化部署，核心业务围绕“用户登录后发起 AI 生成任务，任务进入队列处理，结果写入数据库和对象存储，并在前端展示历史和结果”展开。

---

## 2. 技术栈

### 前端
- Next.js 16
- React 19
- TypeScript 5
- Tailwind CSS 4
- shadcn/ui
- Radix UI
- Lucide React
- SWR
- React Hook Form
- Zod

### 后端
- Next.js Route Handlers
- Node.js
- PostgreSQL
- Supabase
- Drizzle ORM
- bcrypt
- jsonwebtoken
- undici
- ffmpeg / fluent-ffmpeg

### 存储与基础设施
- Supabase 本地/云数据库
- S3 兼容对象存储
- Docker / Supabase CLI（本地开发）
- pnpm 包管理器

---

## 3. 目录结构说明

### 根目录
- `package.json`：依赖与脚本
- `pnpm-lock.yaml`：锁文件
- `next.config.ts`：Next.js 配置
- `tsconfig.json`：TypeScript 配置
- `eslint.config.mjs`：ESLint 配置
- `.env.example`：环境变量示例
- `AGENTS.md`：项目开发规则与业务说明
- `README.md`：项目说明
- `migrations/`：数据库迁移 SQL
- `scripts/`：启动、迁移、初始化脚本
- `supabase/`：本地 Supabase 配置

### `src/app/`
Next.js 页面与 API 路由目录。

- `src/app/page.tsx`：图片生成首页
- `src/app/layout.tsx`：根布局
- `src/app/api/**/route.ts`：后端 API
- `src/app/admin/**`：管理后台页面
- `src/app/shortfilm/**`：短片业务页面
- `src/app/video-remake/**`：视频复刻页面
- `src/app/video/**`：视频生成页面
- `src/app/library/**`：图库管理
- `src/app/queue/**`：任务队列
- `src/app/login/**`、`register/**`：认证页面

### `src/components/`
UI 和业务组件。

- `src/components/ui/`：shadcn/ui 基础组件
- `src/components/app-layout.tsx`：应用主布局
- `src/components/*dialog.tsx`：弹窗类业务组件
- `src/components/*selector.tsx`：选择器类组件
- `src/components/video-*`：视频相关组件

### `src/lib/`
通用业务逻辑和工具。

- `auth.ts`：认证、JWT、用户创建
- `auth-context.tsx`：前端认证上下文
- `db-pool.ts`：PostgreSQL 连接池
- `system-config.ts`：系统配置
- `server-config.ts`：服务端配置读取
- `queue.ts`：任务队列
- `credits.ts`：积分系统
- `history.ts`：历史记录
- `shortfilm.ts`：短片业务逻辑
- `video-merger.ts`：视频拼接
- `storage-*`：存储相关工具

### `src/storage/database/`
数据库 schema 与 Supabase 访问逻辑。

- `shared/schema.ts`：Drizzle schema
- `supabase-client.ts`：Supabase 客户端

---

## 4. 前端入口

### 根入口
- `/`：图片生成页面，对应 `src/app/page.tsx`

### 主要功能入口
- `/landing`：SaaS 落地页
- `/video`：视频生成
- `/shortfilm`：短片项目管理
- `/shortfilm/new`：新建短片
- `/shortfilm/templates`：广告模板管理
- `/video-remake`：视频复刻
- `/library`：图库管理
- `/queue`：任务队列
- `/credits`：积分中心
- `/payment`：支付页面
- `/admin`：后台首页
- `/login`：登录
- `/register`：注册

### 全局布局
- `src/app/layout.tsx`
- `src/components/app-layout.tsx`

其中 `app-layout` 负责：
- 左侧导航
- 页面权限跳转
- 队列状态展示
- 用户菜单
- 认证入口

---

## 5. 后端入口

后端主要由 Next.js API Routes 提供。

### 认证相关
- `/api/auth/login`
- `/api/auth/register`
- `/api/auth/me`
- `/api/auth/send-code`
- `/api/auth/change-password`

### 图片生成相关
- `/api/generate`
- `/api/generate/preview`
- `/api/images/history`
- `/api/upload-image`

### 视频生成相关
- `/api/video/create`
- `/api/video/status`
- `/api/video/models`
- `/api/video/batch-status`
- `/api/video/preview`
- `/api/video/concat`
- `/api/video/ffmpeg-trim`

### 任务队列相关
- `/api/tasks`
- `/api/tasks/[id]`
- `/api/tasks/[id]/status`
- `/api/tasks/batch`
- `/api/tasks/process`
- `/api/tasks/events`

### 短片相关
- `/api/shortfilm/projects`
- `/api/shortfilm/projects/[id]`
- `/api/shortfilm/templates`
- `/api/shortfilm/generate-template`
- `/api/shortfilm/generate-script`
- `/api/shortfilm/generate-image`
- `/api/shortfilm/script-tasks`

### 视频复刻相关
- `/api/video-remake/projects`
- `/api/video-remake/projects/[id]`
- `/api/video-remake/upload`
- `/api/video-remake/link`
- `/api/video-remake/parse/[id]`
- `/api/video-remake/generate-images/[id]`
- `/api/video-remake/generate-videos/[id]`
- `/api/video-remake/merge/[id]`
- `/api/video-remake/outputs`

### 管理后台相关
- `/api/admin/users`
- `/api/admin/stats`
- `/api/admin/logs`
- `/api/admin/system-logs`
- `/api/admin/model-settings`
- `/api/admin/prompt-settings`
- `/api/admin/storage-config`
- `/api/admin/credit-packages`
- `/api/admin/credit-prices`
- `/api/admin/customer-service`

---

## 6. 数据库 / 存储 / 队列说明

### 数据库
项目使用 PostgreSQL / Supabase 作为主数据库。

主要表包括：
- `users`
- `user_credits`
- `credit_packages`
- `credit_orders`
- `system_credit_prices`
- `usage_records`
- `auth_logs`
- `user_settings`
- `system_settings`
- `system_logs`
- `task_queue`
- `image_history`
- `video_history`
- `character_library`
- `products`
- `shortfilm_projects`
- `shortfilm_templates`
- `prompt_templates`
- `showcase_cases`

数据库 schema 定义在：
- `src/storage/database/shared/schema.ts`

迁移文件在：
- `migrations/`

### 存储
项目使用 S3 兼容对象存储保存：
- 参考图
- 生成结果
- 视频文件
- 上传素材

相关工具主要在：
- `src/lib/s3-client.ts`
- `src/app/api/storage/**`
- `src/app/api/upload**`

### 队列
项目的生成任务通过任务队列驱动，核心表为：
- `task_queue`

任务会被创建后进入队列，后续通过：
- `/api/tasks/process`
- `/api/tasks/events`

进行处理和状态同步。

---

## 7. 主要业务流程

### 图片生成流程
1. 用户进入 `/`
2. 输入提示词
3. 选择宽高比和分辨率
4. 上传参考图或从图库选择素材
5. 点击“加入队列生成”
6. 任务写入 `task_queue`
7. 后端处理任务并生成结果
8. 结果写入历史记录与对象存储
9. 前端通过队列事件或轮询刷新状态

### 视频生成流程
1. 用户进入视频生成页面
2. 配置视频模型与参数
3. 发起生成任务
4. 任务进入队列
5. 后端调用对应 AI 模型
6. 结果写入视频历史和存储

### 短片管理流程
1. 创建短片项目
2. 选择 AI 自动生成或手动输入脚本
3. 生成模板、分镜、图片、视频素材
4. 预览并导出结果

### 视频复刻流程
1. 输入视频链接或上传视频
2. 解析视频内容
3. 提取脚本、镜头、口播等信息
4. 生成对应图片和视频素材
5. 预览、拼接、导出

### 认证流程
1. 用户注册 / 登录
2. 服务端生成 JWT
3. 前端保存 token
4. 后续请求通过 `authFetch` 携带 token
5. 管理员权限通过后端鉴权中间件控制

### 积分流程
1. 用户登录后查看积分
2. 发起图片/视频/存储等操作
3. 系统扣减积分
4. 写入使用记录和交易记录

---

## 8. 本地启动命令

### 安装依赖
```bash
pnpm install
```

### 开发启动
```bash
pnpm dev
```

如在当前环境不能直接运行 bash，也可以直接执行：
```bash
pnpm next dev --webpack --port 5000
```

### 生产构建
```bash
pnpm build
```

### 生产启动
```bash
pnpm start
```

### 代码检查
```bash
pnpm lint
pnpm ts-check
```

---

## 9. 开发注意事项

1. 这是一个全栈项目，前端和后端都在 `src/app` 内。
2. 优先使用 `pnpm`，不要使用 npm 或 yarn。
3. 项目运行端口默认是 `5000`。
4. 数据库必须先配置并执行迁移，否则很多接口会报错。
5. `.env.local` 必须存在，且至少包含：
   - `JWT_SECRET`
   - `PGDATABASE_URL`
   - `COZE_SUPABASE_URL`
   - `COZE_SUPABASE_ANON_KEY`
6. 图片/视频生成依赖外部 AI API 配置，未配置时只能跑界面，不能真正生成。
7. 上传、历史记录、图库等功能依赖对象存储和数据库。
8. 管理后台接口需要管理员权限。
9. 开发过程中应优先使用项目已有的 UI 组件和工具函数。
10. 修改数据库结构时要同步更新 schema 和迁移文件。

---

## 10. Cursor 后续开发时需要遵守的规则

1. **先读文件再改文件**  
   在做任何修改前，必须先读取相关文件，理解上下文。

2. **优先复用现有代码**
   不要重复造轮子，优先使用 `src/components/ui/` 和 `src/lib/` 中已有能力。

3. **不要擅自修改业务流程**
   生成、队列、积分、认证、存储是强耦合链路，改动前要先理解调用链。

4. **保持 TypeScript 严格风格**
   不要新增隐式 `any`，函数参数必须显式标注类型。

5. **遵守 App Router 规范**
   - 页面放在 `src/app/**/page.tsx`
   - API 放在 `src/app/api/**/route.ts`

6. **数据库改动必须同步迁移**
   修改表结构时，同时更新：
   - `src/storage/database/shared/schema.ts`
   - `migrations/`

7. **环境变量不要硬编码**
   所有密钥、地址、端口必须来自环境变量。

8. **前端优先考虑客户端/服务端边界**
   需要浏览器能力的组件必须标记 `use client`。

9. **不要破坏管理员/鉴权逻辑**
   后台接口和敏感数据访问必须继续受权限保护。

10. **保持本地开发端口一致**
    默认使用 `5000`，不要随意改成其他端口。

11. **日志和错误处理要保守**
    记录错误时不要影响主流程。

12. **如果新增功能，优先补充文档性上下文**
    例如在 `PROJECT_CONTEXT.md` 中保持项目说明同步更新。
