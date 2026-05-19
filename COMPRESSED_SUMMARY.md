# 压缩摘要

## 用户需求与目标
- 原始目标: 修复 React "Maximum update depth exceeded" 运行时错误，完善短片管理功能
- 当前目标: 新增"手动输入脚本"功能（AI自动生成/手动输入双模式），优化交互体验；修复图片生成连接超时问题

## 项目概览
- 概述: 基于 Next.js 16 的 AI 图片/视频生成平台，包含短片管理（带货）、广告模板、SaaS 首页等功能。已扩展支持手动输入脚本模式。
- 技术栈:
  - Next.js 16 (App Router)
  - React 19
  - TypeScript 5
  - shadcn/ui (基于 Radix UI)
  - Tailwind CSS 4
  - Recharts (图表库)

## 关键决策
- SWR 缓存隔离：在 SWR 缓存 key 中包含用户 ID，确保不同用户的数据完全隔离
- localStorage 存储 user_info：在登录/注册时存储用户信息到 localStorage，确保 getCurrentUserId() 能正确获取用户 ID
- 用户切换时清除缓存：在 login、register、logout 时调用 invalidateAllCache() 清除所有缓存
- 删除操作清理 S3 文件：删除任务、图库、短片项目时同步删除 S3 服务器上的文件
- 非阻塞日志记录：使用 Promise 异步记录日志，确保日志记录失败不影响主流程
- 使用 Recharts 实现日志可视化：利用项目已集成的 Recharts 库实现图表展示
- 新手引导设计：采用精美模态框展示三步流程，登录后自动弹出，支持"不再显示"
- 日志分类统计：模型问题导致的任务失败记录为信息日志，而非错误日志
- 脚本生成方式选择：支持 AI 自动生成和手动输入两种模式，默认 AI 模式
- 段落数量计算统一：手动模式与 AI 模式均采用 `Math.floor(时长 / 8) + 1` 计算段落数量
- **连接超时优化**: 在 undici Agent 中添加 `connectTimeout` 配置，longRunningAgent 设置为 10 分钟，解决 API 连接超时问题

## 核心文件修改
- 文件操作:
  - edit: src/storage/database/shared/schema.ts
  - edit: src/lib/shortfilm.ts
  - edit: src/app/shortfilm/new/page.tsx
  - create: migrations/005_add_script_generation_mode.sql
  - edit: src/lib/fetch-agent.ts
- 关键修改:
  - 数据库新增 `script_generation_mode` 字段（默认 'ai'）
  - 前端新增脚本生成方式选择 UI（AI/手动切换）
  - 实现手动模式逻辑：视频时长必选，自动生成空段落（8秒/段）
  - 优化点击体验：整个卡片可点击，增强视觉反馈
  - 修正段落数量计算：手动模式与 AI 模式保持一致（`Math.floor(duration / 8) + 1`）
  - **修复连接超时**: 在 `longRunningAgent` 和 `defaultAgent` 中添加 `connectTimeout` 配置（longRunningAgent: 10分钟, defaultAgent: 30秒）

## 问题或错误及解决方案
- 问题: 手动模式段落数量计算逻辑与 AI 模式不一致
  - 解决方案: 统一计算公式为 `Math.floor(时长 / 8) + 1`，确保两种模式对应关系一致
- 问题: 脚本生成方式选择区域点击响应小
  - 解决方案: 采用方案一，整个卡片可点击，增强选中状态视觉反馈（边框加粗、背景色变化）
- 问题: 图片生成任务显示失败（连接超时）
  - 原因: undici fetch Agent 未配置 `connectTimeout`，使用默认 10 秒超时导致连接失败
  - 解决方案: 在 `longRunningAgent` 中添加 `connectTimeout` 配置（10分钟）

## TODO
- 排查图片生成任务显示失败问题（GRSAI 后台显示成功但任务状态为 failed）
- **调试任务重试报错**: 已添加详细错误日志，等待用户再次触发问题以便定位根因
