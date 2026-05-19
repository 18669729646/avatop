'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Video,
  Film,
  FolderOpen,
  Bookmark,
  ListOrdered,
  AlertTriangle,
  CheckCircle,
  Info,
  Lightbulb,
  ArrowRight,
  Clock,
  Zap,
  Target,
  Coins,
  HelpCircle,
  FileText,
  Image as ImageIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// 目录结构
const tocItems = [
  { id: 'overview', title: '一、平台简介', icon: Info },
  { id: 'getting-started', title: '二、快速上手', icon: Zap },
  { id: 'shortfilm', title: '三、短片创作', icon: Film },
  { id: 'hook', title: '四、强力钩子', icon: Target },
  { id: 'library', title: '五、图库管理', icon: FolderOpen },
  { id: 'template', title: '六、模板管理', icon: Bookmark },
  { id: 'queue', title: '七、任务队列', icon: ListOrdered },
  { id: 'credits', title: '八、积分充值', icon: Coins },
  { id: 'faq', title: '九、常见问题', icon: HelpCircle },
];

export function GuideContent() {
  const [activeSection, setActiveSection] = useState('overview');
  const [expandedSections, setExpandedSections] = useState<string[]>(['overview']);

  const toggleSection = (id: string) => {
    setExpandedSections(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
      {/* 顶部导航 */}
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Avatap 影拓" className="h-16 w-auto" />
            <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              使用指南
            </span>
          </div>
          <Button variant="outline" onClick={() => window.close()}>
            关闭
          </Button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto flex h-[calc(100vh-4rem)]">
        {/* 左侧目录 */}
        <aside className="w-64 shrink-0 hidden lg:block">
          <ScrollArea className="h-full py-6 px-4">
            <nav className="space-y-2">
              {tocItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveSection(item.id);
                      document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-sm transition-colors',
                      activeSection === item.id
                        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium'
                        : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {item.title}
                  </button>
                );
              })}
            </nav>
          </ScrollArea>
        </aside>

        {/* 主内容区 */}
        <main className="flex-1 min-w-0">
          <ScrollArea className="h-full">
            <div className="py-8 px-4 lg:px-8">
              <div className="max-w-4xl mx-auto space-y-12">

            {/* 一、平台简介 */}
            <section id="overview" className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-8">
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-3">
                <Info className="w-8 h-8 text-blue-500" />
                一、平台简介
              </h1>

              <div className="prose prose-slate dark:prose-invert max-w-none">
                <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200">1.1 关于 Avatap</h2>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                  Avatap 影拓是一款专为跨境电商从业者打造的 AI 视频创作专家平台。
                  通过先进的人工智能技术，帮助您快速生成高质量的产品推广视频，大幅提升内容创作效率和转化率。
                </p>

                <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 rounded-xl p-6 mt-6 border border-blue-200 dark:border-blue-800">
                  <h3 className="text-lg font-semibold text-blue-700 dark:text-blue-400 mb-4 flex items-center gap-2">
                    <Zap className="w-5 h-5" />
                    核心优势
                  </h3>
                  <ul className="space-y-3 text-slate-600 dark:text-slate-400">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-slate-800 dark:text-slate-200">60秒长视频</strong>
                        <p className="text-sm">突破传统短视频限制，完整展示产品卖点和使用场景</p>
                      </div>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-slate-800 dark:text-slate-200">AI 自动脚本</strong>
                        <p className="text-sm">智能分析产品信息，自动生成专业分镜脚本和口播台词</p>
                      </div>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-slate-800 dark:text-slate-200">强力钩子</strong>
                        <p className="text-sm">10种高转化钩子模板，黄金3秒抓住用户注意力</p>
                      </div>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-slate-800 dark:text-slate-200">简单易用</strong>
                        <p className="text-sm">无需专业技能，三步即可生成专业视频</p>
                      </div>
                    </li>
                  </ul>
                </div>

                <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mt-8">1.2 适用场景</h2>
                <div className="grid md:grid-cols-2 gap-4 mt-4">
                  {[
                    { icon: Video, title: 'TikTok/抖音', desc: '短视频平台产品推广' },
                    { icon: Video, title: 'Instagram', desc: 'IG Reels 视频内容' },
                    { icon: Video, title: '电商广告', desc: '产品展示广告' },
                    { icon: Video, title: '社交媒体', desc: 'Facebook、YouTube Shorts' },
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-4 border border-slate-200 dark:border-slate-700 rounded-lg">
                      <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center shrink-0">
                        <item.icon className="w-5 h-5 text-blue-500" />
                      </div>
                      <div>
                        <h4 className="font-medium text-slate-800 dark:text-slate-200">{item.title}</h4>
                        <p className="text-sm text-slate-600 dark:text-slate-400">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* 二、快速上手 */}
            <section id="getting-started" className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-8">
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-3">
                <Zap className="w-8 h-8 text-green-500" />
                二、快速上手
              </h1>

              <div className="prose prose-slate dark:prose-invert max-w-none">
                <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200">2.1 注册登录</h2>
                <div className="space-y-4 mt-4">
                  <div className="flex gap-4">
                    <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                      <span className="text-blue-600 dark:text-blue-400 font-bold">1</span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-800 dark:text-slate-200">访问首页</h3>
                      <p className="text-slate-600 dark:text-slate-400 mt-1">
                        打开浏览器，访问 Avatap 影拓平台首页。
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                      <span className="text-blue-600 dark:text-blue-400 font-bold">2</span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-800 dark:text-slate-200">点击注册</h3>
                      <p className="text-slate-600 dark:text-slate-400 mt-1">
                        点击页面右上角的「注册」按钮。
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                      <span className="text-blue-600 dark:text-blue-400 font-bold">3</span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-800 dark:text-slate-200">填写信息</h3>
                      <p className="text-slate-600 dark:text-slate-400 mt-1">
                        输入手机号和密码（密码需8位以上，支持数字、字母、符号），点击「注册」完成账户创建。
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                      <span className="text-blue-600 dark:text-blue-400 font-bold">4</span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-800 dark:text-slate-200">登录系统</h3>
                      <p className="text-slate-600 dark:text-slate-400 mt-1">
                        使用手机号和密码登录，进入创作界面。
                      </p>
                    </div>
                  </div>
                </div>

                <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mt-8">2.2 充值积分</h2>
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-5 mt-4">
                  <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-medium mb-3">
                    <Coins className="w-5 h-5" />
                    重要提示
                  </div>
                  <p className="text-slate-600 dark:text-slate-400 text-sm">
                    视频生成需要消耗积分。首次使用前，请先充值积分以获得足够的使用额度。
                    1元=10积分，充值任意金额。
                  </p>
                </div>
                <div className="space-y-4 mt-4">
                  <div className="flex gap-4">
                    <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                      <span className="text-amber-600 dark:text-amber-400 font-bold">1</span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-800 dark:text-slate-200">进入积分中心</h3>
                      <p className="text-slate-600 dark:text-slate-400 mt-1">
                        点击导航栏右上角的头像，选择「积分中心」。
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                      <span className="text-amber-600 dark:text-amber-400 font-bold">2</span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-800 dark:text-slate-200">联系客服充值</h3>
                      <p className="text-slate-600 dark:text-slate-400 mt-1">
                        扫描客服二维码，添加客服微信，转账充值。
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                      <span className="text-amber-600 dark:text-amber-400 font-bold">3</span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-800 dark:text-slate-200">等待到账</h3>
                      <p className="text-slate-600 dark:text-slate-400 mt-1">
                        工作时间 9:00-22:00，通常5分钟内到账，请备注手机号或用户ID。
                      </p>
                    </div>
                  </div>
                </div>

                <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mt-8">2.3 三步生成视频</h2>
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 rounded-xl p-6 mt-4 border border-green-200 dark:border-green-800">
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    {[
                      { step: 1, title: '上传产品信息', desc: '描述产品' },
                      { step: 2, title: 'AI 自动生成', desc: '脚本+图片+视频' },
                      { step: 3, title: '导出使用', desc: '下载视频' },
                    ].map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <div className="flex flex-col items-center">
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 text-white flex items-center justify-center text-lg font-bold shadow-lg">
                            {item.step}
                          </div>
                          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 mt-2">{item.title}</span>
                          <span className="text-xs text-slate-500 dark:text-slate-400">{item.desc}</span>
                        </div>
                        {idx < 2 && <ArrowRight className="w-6 h-6 text-green-400" />}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            {/* 三、短片创作 */}
            <section id="shortfilm" className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-8">
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-3">
                <Film className="w-8 h-8 text-purple-500" />
                三、短片创作
              </h1>

              <div className="prose prose-slate dark:prose-invert max-w-none">
                <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200">3.1 功能简介</h2>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                  短片创作是平台的核心功能，提供从脚本生成到成片导出的完整工作流。
                  您只需提供产品信息和创意要求，AI 会自动生成脚本、创建图片、生成视频，
                  最终合成完整的短片。
                </p>

                <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mt-8">3.2 创作步骤</h2>

                <div className="space-y-6 mt-4">
                  <div className="border-2 border-purple-200 dark:border-purple-800 rounded-xl p-6 bg-purple-50/50 dark:bg-purple-950/20">
                    <h3 className="font-semibold text-lg text-purple-700 dark:text-purple-400 flex items-center gap-2 mb-4">
                      <span className="w-8 h-8 rounded-full bg-purple-500 text-white flex items-center justify-center text-sm font-bold">1</span>
                      创建项目
                    </h3>
                    <ul className="space-y-3 text-slate-600 dark:text-slate-400 ml-10">
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-5 h-5 text-purple-500 shrink-0 mt-0.5" />
                        <div>
                          <strong>输入产品名称</strong>
                          <p className="text-sm">填写产品的基本名称，例如：智能手表、运动耳机</p>
                        </div>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-5 h-5 text-purple-500 shrink-0 mt-0.5" />
                        <div>
                          <strong>选择产品类别</strong>
                          <p className="text-sm">选择产品所属类别，帮助 AI 更好理解产品类型</p>
                        </div>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-5 h-5 text-purple-500 shrink-0 mt-0.5" />
                        <div>
                          <strong>上传产品图片</strong>
                          <p className="text-sm">上传 2-5 张不同角度的产品图片，AI 会学习产品外观，确保生成的图片和视频中产品保持一致</p>
                        </div>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-5 h-5 text-purple-500 shrink-0 mt-0.5" />
                        <div>
                          <strong>描述产品卖点</strong>
                          <p className="text-sm">详细描述产品的核心卖点、功能特点、使用场景等，越详细越好</p>
                        </div>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-5 h-5 text-purple-500 shrink-0 mt-0.5" />
                        <div>
                          <strong>填写创意要求</strong>
                          <p className="text-sm">描述视频风格、场景、叙事方式等，例如：「TikTok 风格，年轻人在健身房使用产品，快节奏剪辑」</p>
                        </div>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-5 h-5 text-purple-500 shrink-0 mt-0.5" />
                        <div>
                          <strong>选择视频时长</strong>
                          <p className="text-sm">支持 8秒/16秒/24秒 三种时长，AI 会根据时长自动规划段落数量</p>
                        </div>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-5 h-5 text-purple-500 shrink-0 mt-0.5" />
                        <div>
                          <strong>选择钩子类型</strong>
                          <p className="text-sm">从10种高转化钩子中选择一种，抓住用户注意力（详见第四章）</p>
                        </div>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-5 h-5 text-purple-500 shrink-0 mt-0.5" />
                        <div>
                          <strong>选择达人角色（可选）</strong>
                          <p className="text-sm">从图库中选择达人角色，视频中人物形象保持一致</p>
                        </div>
                      </li>
                    </ul>
                  </div>

                  <div className="border-2 border-blue-200 dark:border-blue-800 rounded-xl p-6 bg-blue-50/50 dark:bg-blue-950/20">
                    <h3 className="font-semibold text-lg text-blue-700 dark:text-blue-400 flex items-center gap-2 mb-4">
                      <span className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center text-sm font-bold">2</span>
                      确认脚本
                    </h3>
                    <p className="text-slate-600 dark:text-slate-400 ml-10">
                      AI 会根据您提供的信息自动生成完整脚本，包括：
                    </p>
                    <ul className="space-y-2 text-slate-600 dark:text-slate-400 ml-10 mt-3">
                      <li>• <strong>分镜段落</strong>：每个段落的画面描述和口播台词</li>
                      <li>• <strong>图片提示词</strong>：每个段落要生成的图片描述</li>
                      <li>• <strong>视频提示词</strong>：段落之间的过渡动画描述</li>
                    </ul>
                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 ml-10 mt-4">
                      <p className="text-sm text-amber-700 dark:text-amber-400">
                        💡 <strong>提示</strong>：您可以查看并编辑每个段落的提示词，确保符合您的预期。
                      </p>
                    </div>
                  </div>

                  <div className="border-2 border-green-200 dark:border-green-800 rounded-xl p-6 bg-green-50/50 dark:bg-green-950/20">
                    <h3 className="font-semibold text-lg text-green-700 dark:text-green-400 flex items-center gap-2 mb-4">
                      <span className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center text-sm font-bold">3</span>
                      生成图片
                    </h3>
                    <p className="text-slate-600 dark:text-slate-400 ml-10">
                      为每个段落生成对应的图片：
                    </p>
                    <ul className="space-y-2 text-slate-600 dark:text-slate-400 ml-10 mt-3">
                      <li>• 第一张图片会自动作为后续图片的参考图，保持风格一致</li>
                      <li>• 可以为每个段落选择不同的参考图</li>
                      <li>• 支持重新生成、选择不同结果</li>
                      <li>• 所有段落图片生成完成后，进入视频生成阶段</li>
                    </ul>
                  </div>

                  <div className="border-2 border-pink-200 dark:border-pink-800 rounded-xl p-6 bg-pink-50/50 dark:bg-pink-950/20">
                    <h3 className="font-semibold text-lg text-pink-700 dark:text-pink-400 flex items-center gap-2 mb-4">
                      <span className="w-8 h-8 rounded-full bg-pink-500 text-white flex items-center justify-center text-sm font-bold">4</span>
                      生成视频
                    </h3>
                    <p className="text-slate-600 dark:text-slate-400 ml-10">
                      将相邻的两张图片生成过渡视频：
                    </p>
                    <ul className="space-y-2 text-slate-600 dark:text-slate-400 ml-10 mt-3">
                      <li>• 视频 1：从图片 1 过渡到图片 2</li>
                      <li>• 视频 2：从图片 2 过渡到图片 3</li>
                      <li>• 以此类推，生成所有过渡动画</li>
                    </ul>
                  </div>

                  <div className="border-2 border-orange-200 dark:border-orange-800 rounded-xl p-6 bg-orange-50/50 dark:bg-orange-950/20">
                    <h3 className="font-semibold text-lg text-orange-700 dark:text-orange-400 flex items-center gap-2 mb-4">
                      <span className="w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center text-sm font-bold">5</span>
                      预览与导出
                    </h3>
                    <p className="text-slate-600 dark:text-slate-400 ml-10">
                      查看所有视频片段，合成完整短片：
                    </p>
                    <ul className="space-y-2 text-slate-600 dark:text-slate-400 ml-10 mt-3">
                      <li>• 预览单个视频片段</li>
                      <li>• 重新生成不满意的片段</li>
                      <li>• 合成所有片段为一个完整短片</li>
                      <li>• 下载合成后的视频</li>
                    </ul>
                  </div>
                </div>
              </div>
            </section>

            {/* 四、强力钩子 */}
            <section id="hook" className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-8">
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-3">
                <Target className="w-8 h-8 text-pink-500" />
                四、强力钩子
              </h1>

              <div className="prose prose-slate dark:prose-invert max-w-none">
                <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200">4.1 什么是钩子</h2>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                  钩子（Hook）是视频开头 3 秒的核心内容，决定了用户是否会继续观看。
                  平台提供 10 种高转化钩子模板，帮助您快速抓住用户注意力。
                </p>

                <div className="bg-gradient-to-r from-pink-50 to-rose-50 dark:from-pink-950/20 dark:to-rose-950/20 rounded-xl p-6 mt-4 border border-pink-200 dark:border-pink-800">
                  <h3 className="text-lg font-semibold text-pink-700 dark:text-pink-400 mb-4 flex items-center gap-2">
                    <Target className="w-5 h-5" />
                    为什么钩子很重要？
                  </h3>
                  <ul className="space-y-2 text-slate-600 dark:text-slate-400">
                    <li>• <strong>黄金3秒</strong>：用户决定是否继续观看通常在前3秒</li>
                    <li>• <strong>提升留存</strong>：好的钩子能显著提升视频完播率</li>
                    <li>• <strong>增加转化</strong>：吸引的用户更有可能产生购买行为</li>
                  </ul>
                </div>

                <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mt-8">4.2 钩子类型</h2>
                <div className="grid md:grid-cols-2 gap-4 mt-4">
                  {[
                    {
                      type: '痛点暴击',
                      desc: '直接点出用户痛点，引发共鸣',
                      example: '还在为加班没时间锻炼烦恼吗？',
                      color: 'red'
                    },
                    {
                      type: '颠覆认知',
                      desc: '挑战用户既有观念，激发好奇心',
                      example: '你以为运动一定要去健身房？',
                      color: 'orange'
                    },
                    {
                      type: '悬念提问',
                      desc: '抛出问题，吸引用户寻找答案',
                      example: '你知道这款产品能帮你节省多少时间吗？',
                      color: 'yellow'
                    },
                    {
                      type: '数字冲击',
                      desc: '用具体数字强化效果',
                      example: '90%的人都不知道的健康秘密',
                      color: 'green'
                    },
                    {
                      type: '对比反差',
                      desc: '通过对比突出产品优势',
                      example: '传统方法需要1小时，这款产品只需要3分钟',
                      color: 'blue'
                    },
                    {
                      type: '场景带入',
                      desc: '让用户身临其境，产生代入感',
                      example: '想象一下，你正在享受阳光下的户外运动...',
                      color: 'indigo'
                    },
                    {
                      type: '权威背书',
                      desc: '用权威数据或名人增强可信度',
                      example: '这是XX明星同款的健身神器',
                      color: 'purple'
                    },
                    {
                      type: '利益前置',
                      desc: '直接告诉用户能得到什么好处',
                      example: '用这款产品，让你每天多睡半小时',
                      color: 'pink'
                    },
                    {
                      type: '情感共鸣',
                      desc: '触动用户情感，建立连接',
                      example: '你有多久没有好好照顾自己了？',
                      color: 'rose'
                    },
                    {
                      type: '紧迫感',
                      desc: '制造紧迫感，促使行动',
                      example: '限时优惠，错过再等一年',
                      color: 'amber'
                    },
                  ].map((item, idx) => (
                    <div key={idx} className={`border-l-4 border-${item.color}-500 bg-slate-50 dark:bg-slate-700/50 rounded-r-lg p-4`}>
                      <h4 className="font-semibold text-slate-800 dark:text-slate-200">{item.type}</h4>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{item.desc}</p>
                      <div className="mt-2 p-2 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700">
                        <p className="text-xs text-slate-500 dark:text-slate-400">示例</p>
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{item.example}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-5 mt-8">
                  <h3 className="font-semibold text-blue-700 dark:text-blue-400 flex items-center gap-2 mb-3">
                    <Lightbulb className="w-5 h-5" />
                    选择建议
                  </h3>
                  <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                    <li>• <strong>痛点类钩子</strong>：适合需要强调用户痛点的产品</li>
                    <li>• <strong>利益类钩子</strong>：适合强调产品优势的产品</li>
                    <li>• <strong>情感类钩子</strong>：适合情感化营销的产品</li>
                    <li>• 可以根据产品特点尝试不同钩子，测试效果</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* 五、图库管理 */}
            <section id="library" className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-8">
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-3">
                <FolderOpen className="w-8 h-8 text-cyan-500" />
                五、图库管理
              </h1>

              <div className="prose prose-slate dark:prose-invert max-w-none">
                <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200">5.1 功能简介</h2>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                  图库管理用于存储和管理达人角色、产品图片等素材。通过图库，您可以在短片创作时
                  快速调用这些素材，确保生成内容的一致性。
                </p>

                <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mt-8">5.2 角色库</h2>
                <div className="bg-cyan-50 dark:bg-cyan-900/20 rounded-xl p-5 mt-4 border border-cyan-200 dark:border-cyan-800">
                  <h3 className="font-semibold text-cyan-700 dark:text-cyan-400 mb-3">用途</h3>
                  <p className="text-slate-600 dark:text-slate-400 text-sm mb-3">
                    存储达人、模特的人物图片，在短片创作时选择角色，确保视频中人物形象一致。
                  </p>
                  <h3 className="font-semibold text-cyan-700 dark:text-cyan-400 mb-3">操作步骤</h3>
                  <ol className="list-decimal list-inside text-sm text-slate-600 dark:text-slate-400 space-y-1">
                    <li>进入图库管理，选择「角色库」选项卡</li>
                    <li>点击「上传图片」按钮</li>
                    <li>选择角色正面照片上传（支持 JPG、PNG、WebP，最大10MB）</li>
                    <li>填写角色名称和描述</li>
                    <li>保存后可在短片创作时选择使用</li>
                  </ol>
                </div>

                <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mt-8">5.3 产品库</h2>
                <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-5 mt-4 border border-purple-200 dark:border-purple-800">
                  <h3 className="font-semibold text-purple-700 dark:text-purple-400 mb-3">用途</h3>
                  <p className="text-slate-600 dark:text-slate-400 text-sm mb-3">
                    存储产品的多角度照片，在短片创作时关联产品，确保生成的图片和视频中产品外观一致。
                  </p>
                  <h3 className="font-semibold text-purple-700 dark:text-purple-400 mb-3">操作步骤</h3>
                  <ol className="list-decimal list-inside text-sm text-slate-600 dark:text-slate-400 space-y-1">
                    <li>进入图库管理，选择「产品库」选项卡</li>
                    <li>点击「上传图片」按钮</li>
                    <li>选择产品多角度照片上传（建议2-5张不同角度）</li>
                    <li>填写产品名称、类别和描述</li>
                    <li>保存后可在短片创作时选择使用</li>
                  </ol>
                </div>

                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-5 mt-6">
                  <h3 className="font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-2 mb-2">
                    <Lightbulb className="w-5 h-5" />
                    提示
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    上传高质量、光线充足的图片，能获得更好的生成效果。角色图片建议使用正面照片，
                    产品图片建议展示多个角度和细节。
                  </p>
                </div>
              </div>
            </section>

            {/* 六、模板管理 */}
            <section id="template" className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-8">
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-3">
                <Bookmark className="w-8 h-8 text-orange-500" />
                六、模板管理
              </h1>

              <div className="prose prose-slate dark:prose-invert max-w-none">
                <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200">6.1 功能简介</h2>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                  模板管理用于创建和管理脚本模板。通过模板，您可以保存常用的创意框架和提示词，
                  在创建新项目时快速复用，大幅提升创作效率。
                </p>

                <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mt-8">6.2 创建模板</h2>
                <div className="space-y-4 mt-4">
                  <div className="flex gap-4">
                    <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center shrink-0">
                      <span className="text-orange-600 dark:text-orange-400 font-bold">1</span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-800 dark:text-slate-200">进入广告模板</h3>
                      <p className="text-slate-600 dark:text-slate-400 mt-1">
                        点击左侧导航栏的「广告模板」，进入模板管理页面。
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center shrink-0">
                      <span className="text-orange-600 dark:text-orange-400 font-bold">2</span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-800 dark:text-slate-200">点击新建模板</h3>
                      <p className="text-slate-600 dark:text-slate-400 mt-1">
                        点击页面右上角的「新建模板」按钮。
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center shrink-0">
                      <span className="text-orange-600 dark:text-orange-400 font-bold">3</span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-800 dark:text-slate-200">填写模板信息</h3>
                      <p className="text-slate-600 dark:text-slate-400 mt-1">
                        填写模板名称、描述，并设置提示词内容。提示词支持变量，如 <code className="bg-slate-200 dark:bg-slate-700 px-2 py-1 rounded text-sm">{`{{productName}}`}</code>、<code className="bg-slate-200 dark:bg-slate-700 px-2 py-1 rounded text-sm">{`{{features}}`}</code> 等。
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center shrink-0">
                      <span className="text-orange-600 dark:text-orange-400 font-bold">4</span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-800 dark:text-slate-200">保存模板</h3>
                      <p className="text-slate-600 dark:text-slate-400 mt-1">
                        点击「保存」按钮，模板创建完成。
                      </p>
                    </div>
                  </div>
                </div>

                <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mt-8">6.3 使用模板</h2>
                <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-5 mt-4 border border-green-200 dark:border-green-800">
                  <p className="text-slate-600 dark:text-slate-400 text-sm">
                    在短片创作页面，选择「从模板创建」，然后从模板列表中选择一个模板，
                    系统会自动填充提示词内容，您只需稍作修改即可开始创作。
                  </p>
                </div>

                <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mt-8">6.4 常用模板示例</h2>
                <div className="grid md:grid-cols-2 gap-4 mt-4">
                  <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                    <h4 className="font-medium text-slate-800 dark:text-slate-200 mb-2">产品展示模板</h4>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      适合展示产品外观、功能和卖点，适合大多数产品推广场景。
                    </p>
                  </div>
                  <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                    <h4 className="font-medium text-slate-800 dark:text-slate-200 mb-2">使用场景模板</h4>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      展示产品在实际使用中的场景，帮助用户理解产品价值。
                    </p>
                  </div>
                  <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                    <h4 className="font-medium text-slate-800 dark:text-slate-200 mb-2">促销活动模板</h4>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      节日促销、限时优惠等活动的模板，强调紧迫感和优惠信息。
                    </p>
                  </div>
                  <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                    <h4 className="font-medium text-slate-800 dark:text-slate-200 mb-2">品牌故事模板</h4>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      讲述品牌理念、产品背景，增强用户对品牌的认同感。
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* 七、任务队列 */}
            <section id="queue" className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-8">
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-3">
                <ListOrdered className="w-8 h-8 text-amber-500" />
                七、任务队列
              </h1>

              <div className="prose prose-slate dark:prose-invert max-w-none">
                <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200">7.1 功能简介</h2>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                  任务队列展示所有图片和视频生成任务的状态。您可以查看任务进度、重试失败的任务、
                  清理已完成的任务等。
                </p>

                <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mt-8">7.2 任务状态</h2>
                <div className="grid md:grid-cols-2 gap-4 mt-4">
                  <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-700">
                    <Clock className="w-5 h-5 text-slate-400" />
                    <div>
                      <span className="font-medium text-slate-800 dark:text-slate-200">等待中</span>
                      <p className="text-sm text-slate-600 dark:text-slate-400">任务已创建，排队等待处理</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    <div>
                      <span className="font-medium text-blue-700 dark:text-blue-400">处理中</span>
                      <p className="text-sm text-slate-600 dark:text-slate-400">AI 正在生成内容</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <div>
                      <span className="font-medium text-green-700 dark:text-green-400">已完成</span>
                      <p className="text-sm text-slate-600 dark:text-slate-400">内容生成成功</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                    <AlertTriangle className="w-5 h-5 text-red-500" />
                    <div>
                      <span className="font-medium text-red-700 dark:text-red-400">失败</span>
                      <p className="text-sm text-slate-600 dark:text-slate-400">生成失败，可重试</p>
                    </div>
                  </div>
                </div>

                <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mt-8">7.3 常用操作</h2>
                <div className="space-y-3 mt-4">
                  <div className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                    <CheckCircle className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-slate-800 dark:text-slate-200">重试失败任务</h4>
                      <p className="text-sm text-slate-600 dark:text-slate-400">点击任务右侧的重试按钮，重新生成失败的内容</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                    <CheckCircle className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-slate-800 dark:text-slate-200">批量重试</h4>
                      <p className="text-sm text-slate-600 dark:text-slate-400">点击「重试所有失败任务」一键重试所有失败的任务</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                    <CheckCircle className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-slate-800 dark:text-slate-200">清理已完成</h4>
                      <p className="text-sm text-slate-600 dark:text-slate-400">清理已完成的任务记录，保持队列整洁</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                    <CheckCircle className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-slate-800 dark:text-slate-200">清空队列</h4>
                      <p className="text-sm text-slate-600 dark:text-slate-400">清空所有任务记录（不会中断正在进行的任务）</p>
                    </div>
                  </div>
                </div>

                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-5 mt-6">
                  <h3 className="font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-5 h-5" />
                    注意
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    生成失败的积分会自动退还。如果连续失败，请联系客服检查。
                  </p>
                </div>
              </div>
            </section>

            {/* 八、积分充值 */}
            <section id="credits" className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-8">
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-3">
                <Coins className="w-8 h-8 text-amber-500" />
                八、积分充值
              </h1>

              <div className="prose prose-slate dark:prose-invert max-w-none">
                <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200">8.1 积分说明</h2>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                  平台使用积分作为计费单位，各种功能会消耗相应的积分。
                  充值积分后，可用于生成图片、视频和短片。
                </p>

                <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 rounded-xl p-6 mt-4 border border-amber-200 dark:border-amber-800">
                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-amber-600 dark:text-amber-400">1元</div>
                      <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">= 10积分</div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-orange-600 dark:text-orange-400">任意金额</div>
                      <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">无最低充值限制</div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-rose-600 dark:text-rose-400">永久有效</div>
                      <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">积分永不过期</div>
                    </div>
                  </div>
                </div>

                <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mt-8">8.2 充值步骤</h2>
                <div className="space-y-4 mt-4">
                  <div className="flex gap-4">
                    <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                      <span className="text-amber-600 dark:text-amber-400 font-bold">1</span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-800 dark:text-slate-200">进入积分中心</h3>
                      <p className="text-slate-600 dark:text-slate-400 mt-1">
                        点击导航栏右上角的头像，选择「积分中心」。
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                      <span className="text-amber-600 dark:text-amber-400 font-bold">2</span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-800 dark:text-slate-200">查看客服信息</h3>
                      <p className="text-slate-600 dark:text-slate-400 mt-1">
                        页面顶部显示客服二维码、微信号和工作时间。
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                      <span className="text-amber-600 dark:text-amber-400 font-bold">3</span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-800 dark:text-slate-200">扫码联系客服</h3>
                      <p className="text-slate-600 dark:text-slate-400 mt-1">
                        使用微信扫描客服二维码，添加客服微信。
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                      <span className="text-amber-600 dark:text-amber-400 font-bold">4</span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-800 dark:text-slate-200">转账充值</h3>
                      <p className="text-slate-600 dark:text-slate-400 mt-1">
                        通过微信或支付宝转账，备注您的手机号或用户ID。
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                      <span className="text-amber-600 dark:text-amber-400 font-bold">5</span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-800 dark:text-slate-200">等待到账</h3>
                      <p className="text-slate-600 dark:text-slate-400 mt-1">
                        工作时间 9:00-22:00，通常5分钟内到账。
                      </p>
                    </div>
                  </div>
                </div>

                <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mt-8">8.3 积分使用说明</h2>
                <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-5 mt-4 border border-slate-200 dark:border-slate-700">
                  <p className="text-slate-600 dark:text-slate-400 text-sm mb-3">
                    各功能消耗的积分数量可在积分中心「价格说明」标签页查看。
                  </p>
                  <p className="text-slate-600 dark:text-slate-400 text-sm mb-3">
                    使用记录和充值记录可在「使用记录」和「充值记录」标签页查看。
                  </p>
                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 mt-3">
                    <p className="text-sm text-green-700 dark:text-green-400">
                      ✅ 生成失败的积分会自动退还
                    </p>
                  </div>
                </div>

                <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mt-8">8.4 注意事项</h2>
                <div className="space-y-3 mt-4">
                  <div className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                    <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      请务必备注手机号或用户ID，否则无法准确充值。
                    </p>
                  </div>
                  <div className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                    <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      非工作时间充值可能延迟到次日处理。
                    </p>
                  </div>
                  <div className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                    <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      积分充值后请刷新页面或重新登录查看最新余额。
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* 九、常见问题 */}
            <section id="faq" className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-8">
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-3">
                <HelpCircle className="w-8 h-8 text-blue-500" />
                九、常见问题
              </h1>

              <div className="prose prose-slate dark:prose-invert max-w-none">
                <div className="space-y-4">
                  {[
                    {
                      q: '视频生成需要多长时间？',
                      a: '图片生成通常需要 10-30 秒，视频生成通常需要 1-5 分钟。具体时间取决于任务复杂度和服务器负载。'
                    },
                    {
                      q: '生成失败的积分会退还吗？',
                      a: '会的。如果生成失败，系统会自动退还消耗的积分到您的账户。您可以在积分中心的「充值记录」中查看退款记录。'
                    },
                    {
                      q: '可以同时创建多个任务吗？',
                      a: '可以。您可以同时创建多个任务，它们会排队处理。建议在任务队列页面查看任务进度。'
                    },
                    {
                      q: '生成的视频可以商用吗？',
                      a: '可以。您拥有生成内容的完整使用权，可用于商业用途。但请确保内容不侵犯他人权益。'
                    },
                    {
                      q: '如何提高生成质量？',
                      a: '建议上传高质量的产品图片，详细描述产品卖点和创意要求。使用角色库和模板也能提升生成效果和一致性。'
                    },
                    {
                      q: '积分可以退款吗？',
                      a: '积分充值后不支持退款，但永久有效，不会过期。'
                    },
                    {
                      q: '支持哪些视频格式？',
                      a: '目前支持 MP4 格式导出，兼容主流视频播放器和社交平台。'
                    },
                    {
                      q: '忘记密码怎么办？',
                      a: '请在登录弹窗中选择「更改密码」标签页，输入手机号和新密码即可修改。'
                    },
                    {
                      q: '联系不上客服怎么办？',
                      a: '客服工作时间是 9:00-22:00。如果长时间未到账，请保留转账凭证，在工作时间内联系客服处理。'
                    },
                    {
                      q: '可以自定义视频尺寸吗？',
                      a: '目前支持竖版（9:16）和横版（16:9）两种尺寸，适用于不同平台。'
                    },
                  ].map((item, idx) => (
                    <div key={idx} className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                      <div className="p-4 bg-slate-50 dark:bg-slate-700/50">
                        <h3 className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                          <HelpCircle className="w-5 h-5 text-blue-500" />
                          {item.q}
                        </h3>
                      </div>
                      <div className="p-4">
                        <p className="text-slate-600 dark:text-slate-400">{item.a}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6 mt-8">
                  <h3 className="text-lg font-semibold text-blue-700 dark:text-blue-400 flex items-center gap-2 mb-3">
                    <Info className="w-5 h-5" />
                    还有疑问？
                  </h3>
                  <p className="text-slate-600 dark:text-slate-400 mb-3">
                    如果以上FAQ没有解答您的问题，请联系我们的客服获取帮助。
                  </p>
                  <Button
                    variant="outline"
                    className="mt-2"
                    onClick={() => window.location.href = '/landing'}
                  >
                    返回首页联系客服
                  </Button>
                </div>
              </div>
            </section>

            {/* 底部 */}
            <div className="text-center py-8 text-slate-500 dark:text-slate-400">
              <p>© 2024 Avatap 影拓. All rights reserved.</p>
              <p className="text-sm mt-1">祝您创作愉快！</p>
            </div>
          </div>
            </div>
          </ScrollArea>
        </main>
      </div>
    </div>
  );
}
