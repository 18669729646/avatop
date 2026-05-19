# 视频复刻V3合并执行方案（Superpowers版）

## 目标
将视频复刻功能合并到短片功能中，共用编辑页面，步骤1根据入口不同显示不同UI。

## 核心原则
- 视频复刻与短片的唯一区别：脚本来源不同（从视频反推 vs 从产品信息生成）
- 步骤2-5完全复用，零改动
- 删除所有旧的 video_remake 代码

## 当前状态
- ✅ ScriptSegment 接口已扩展（startTime, endTime, shotType, cameraMovement, speechText, audioPrompt, backgroundMusic）
- ✅ ShortFilmProject 接口已扩展（sourceType, sourceVideoKey, sourceVideoUrl, videoDuration）
- ❌ 数据库迁移文件未创建
- ❌ createNewProject 函数未更新
- ❌ API路由未处理新字段
- ❌ 短片编辑页未支持复刻模式
- ❌ 视频复刻页面未跳转

---

## Step 1: 完成数据模型扩展

### 1.1 创建数据库迁移文件
**Files**: `supabase/migrations/009_remake_merge.sql`
**What**: ALTER TABLE shortfilm_projects ADD COLUMN source_type/source_video_key/source_video_url/video_duration
**Verify**: SQL可执行

### 1.2 更新 createNewProject 函数
**Files**: `src/lib/shortfilm.ts`
**What**: 添加 sourceType 参数支持
**Verify**: ts-check 通过

### 1.3 更新 API 路由处理新字段
**Files**: 
- `src/app/api/shortfilm/projects/route.ts` (GET/POST)
- `src/app/api/shortfilm/projects/[id]/route.ts` (GET/PUT)
**What**: 
- GET: 返回 sourceType, sourceVideoKey, sourceVideoUrl, videoDuration
- POST: 插入 source_type, source_video_key, source_video_url, video_duration
- PUT: 更新 source_type, source_video_key, source_video_url, video_duration
**Verify**: API可正确读写新字段

---

## Step 2: 创建复刻API（短片命名空间下）

### 2.1 创建视频上传API
**Files**: `src/app/api/shortfilm/remake-upload/route.ts`
**What**: 从 video-remake/upload/route.ts 迁移，修改为更新 shortfilm_projects 表
**Verify**: 上传视频后 shortfilm_projects 表的 source_video_key 更新

### 2.2 创建链接解析API
**Files**: `src/app/api/shortfilm/remake-link/route.ts`
**What**: 从 video-remake/link/route.ts 迁移，修改为更新 shortfilm_projects 表
**Verify**: 链接解析后 shortfilm_projects 表更新

### 2.3 创建视频解析API
**Files**: `src/app/api/shortfilm/remake-parse/route.ts`
**What**: 从 video-remake/parse/[id]/route.ts 迁移，核心修改：
1. 从 shortfilm_projects 表读取项目
2. 解析结果映射为 ScriptSegment[] 格式
3. 更新 shortfilm_projects 的 script_segments 字段
4. 不再写入 video_remake_scenes 表
**Verify**: 解析后 script_segments 包含完整的 ScriptSegment 数据

### 2.4 创建分片上传API
**Files**: 
- `src/app/api/shortfilm/remake-chunk-init/route.ts`
- `src/app/api/shortfilm/remake-chunk-upload/route.ts`
- `src/app/api/shortfilm/remake-chunk-complete/route.ts`
**What**: 从 video-remake/chunk-* 迁移，修改为更新 shortfilm_projects 表
**Verify**: 大文件分片上传后项目状态正确更新

---

## Step 3: 修改短片编辑页步骤1，支持复刻模式

### 3.1 添加复刻模式状态
**Files**: `src/app/shortfilm/new/page.tsx`
**What**: 
1. 从 URL 参数读取 mode=remake
2. 添加复刻模式相关状态：sourceVideoKey, sourceVideoUrl, videoDuration, isParsing, parseProgress
3. 根据 mode 初始化 project.sourceType
**Verify**: 访问 /shortfilm/new?mode=remake 时 sourceType 为 'remake'

### 3.2 添加复刻模式步骤1 UI
**Files**: `src/app/shortfilm/new/page.tsx`
**What**: 
在步骤1中，当 sourceType === 'remake' 时显示：
1. 视频上传区域（支持拖拽上传和分片上传）
2. 视频链接输入区域
3. 已上传视频预览
4. "AI深度解析"按钮
5. 解析进度指示器
6. 解析完成后自动填充 scriptSegments 并跳转步骤2
**Verify**: 复刻模式步骤1可正常上传视频、解析、生成脚本

### 3.3 处理已有项目的复刻模式加载
**Files**: `src/app/shortfilm/new/page.tsx`
**What**: 
当从 URL 参数 id=xxx 加载已有项目且 sourceType === 'remake' 时：
1. 恢复 sourceVideoKey, sourceVideoUrl, videoDuration
2. 显示已上传的视频信息
3. 如果已有 scriptSegments，允许重新解析
**Verify**: 从视频复刻入口进入已有项目时正确恢复状态

---

## Step 4: 修改视频复刻入口页

### 4.1 修改视频复刻列表页
**Files**: `src/app/video-remake/page.tsx`
**What**: 
1. 改为查询 sourceType='remake' 的 shortfilm_projects
2. 点击项目跳转到 /shortfilm/new?id={id}
3. 新建按钮跳转到 /video-remake/new
**Verify**: 列表页显示复刻项目，点击跳转到短片编辑页

### 4.2 修改视频复刻新建页
**Files**: `src/app/video-remake/new/page.tsx`
**What**: 
1. 创建项目时设置 sourceType='remake'
2. 上传/链接解析后跳转到 /shortfilm/new?id={id}
3. 使用新的短片API（remake-upload, remake-link, remake-chunk-*）
**Verify**: 新建复刻项目后跳转到短片编辑页

---

## Step 5: 删除旧的视频复刻代码

### 5.1 删除旧API
**Files**: 删除 `src/app/api/video-remake/` 整个目录
**What**: 确认新流程完全可用后删除
**Verify**: 旧API返回404

### 5.2 删除旧页面
**Files**: 删除 `src/app/video-remake/[id]/` 目录
**What**: 删除详情页及tabs子目录
**Verify**: 旧详情页返回404

### 5.3 保留数据库表
**What**: 保留 video_remake_projects 和 video_remake_scenes 表，避免影响历史数据
**Verify**: 历史数据可查

---

## Step 6: 验证和清理

### 6.1 类型检查
**What**: 运行 `pnpm ts-check`，修复所有类型错误
**Verify**: 0 error

### 6.2 代码检查
**What**: 运行 `pnpm lint`，修复所有 lint 错误
**Verify**: 0 error

### 6.3 功能测试
**What**: 
1. 测试原创短片流程不受影响
2. 测试视频复刻流程：上传视频 → 解析 → 编辑脚本 → 生成图片 → 生成视频 → 合成
3. 测试链接解析流程
**Verify**: 两个入口流程正常

### 6.4 清理
**What**: 清理未使用的import和变量
**Verify**: 无未使用引用
