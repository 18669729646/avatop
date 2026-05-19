'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Play, ChevronRight, Loader2, Sparkles, Video, Target, Zap, Clock, Globe, BookOpen, MessageCircle, FolderOpen } from 'lucide-react';
import { ShowcaseCase } from '@/types/showcase';
import { AuthDialog } from '@/components/auth-dialog';
import { CustomerServiceDialog } from '@/components/customer-service-dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/lib/auth-context';

export default function LandingPage() {
  const router = useRouter();
  const { isAuthenticated, user } = useAuth();
  const [cases, setCases] = useState<ShowcaseCase[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null);
  const videoRefs = useRef<{ [key: string]: HTMLVideoElement | null }>({});
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [authTab, setAuthTab] = useState<'login' | 'register' | 'change-password'>('login');
  const [customerServiceDialogOpen, setCustomerServiceDialogOpen] = useState(false);

  useEffect(() => {
    loadCases();
  }, []);

  // 组件卸载时清理视频引用
  useEffect(() => {
    return () => {
      Object.values(videoRefs.current).forEach(video => {
        if (video) {
          video.pause();
          video.src = '';
        }
      });
    };
  }, []);

  const loadCases = async () => {
    console.log('[Landing] Loading cases...');
    try {
      const response = await fetch('/api/showcase-cases?type=shortfilm&limit=10');
      const data = await response.json();
      console.log('[Landing] Cases loaded:', data);
      if (data.success) {
        setCases(data.data);
      }
    } catch (error) {
      console.error('加载案例失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleVideo = (id: string) => {
    const video = videoRefs.current[id];
    if (!video) return;

    if (playingVideoId === id) {
      // 暂停当前视频
      video.pause();
      setPlayingVideoId(null);
    } else {
      // 停止其他正在播放的视频
      Object.entries(videoRefs.current).forEach(([key, v]) => {
        if (key !== id && v && !v.paused) {
          v.pause();
        }
      });
      // 播放当前视频
      video.play().catch(() => {});
      setPlayingVideoId(id);
    }
  };

  // 处理登录/注册按钮点击
  const handleAuthClick = (tab: 'login' | 'register') => {
    if (isAuthenticated) {
      // 已登录，直接跳转到功能首页
      router.push('/');
    } else {
      // 未登录，打开认证弹窗
      setAuthTab(tab);
      setAuthDialogOpen(true);
    }
  };

  // 获取用户头像首字母
  const getInitials = (name: string) => {
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900">
      {/* 顶部导航栏 */}
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <img src="/logo.png" alt="Avatap 影拓" className="h-20 w-auto" />
          {isAuthenticated && user ? (
            // 已登录：显示用户信息
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user.avatarUrl || undefined} />
                  <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                    {user.nickname ? getInitials(user.nickname) : user.phone.slice(-4)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm text-muted-foreground">
                  {user.nickname || `用户 ${user.phone.slice(-4)}`}
                </span>
              </div>
              <Button size="sm" onClick={() => router.push('/')}>
                进入系统
              </Button>
            </div>
          ) : (
            // 未登录：显示登录/注册按钮
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleAuthClick('login')}
              >
                登录
              </Button>
              <Button
                size="sm"
                onClick={() => handleAuthClick('register')}
              >
                注册
              </Button>
            </div>
          )}
        </div>
      </header>

      {/* 认证弹窗 */}
      <AuthDialog
        open={authDialogOpen}
        onOpenChange={setAuthDialogOpen}
        defaultTab={authTab}
        showChangePassword={false}
      />

      {/* 客服弹窗 */}
      <CustomerServiceDialog
        open={customerServiceDialogOpen}
        onOpenChange={setCustomerServiceDialogOpen}
      />

      {/* Hero 区域 */}
      <section className="py-16 px-4">
        <div className="max-w-5xl mx-auto text-center">
          <Badge className="mb-4" variant="secondary">
            <Sparkles className="w-3 h-3 mr-1" />
            专为跨境电商从业者打造
          </Badge>
          <h1 className="text-5xl md:text-7xl font-bold mb-4 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent leading-tight">
            AI 视频创作专家
          </h1>
          <p className="text-2xl md:text-3xl font-semibold mb-3 text-slate-700 dark:text-slate-200">
            60秒长视频生成
          </p>
          <p className="text-lg text-muted-foreground mb-6 max-w-3xl mx-auto">
            根据产品信息，AI 自动生成完整脚本和强力钩子，一键生成分镜视频
            <br />
            助力跨境电商内容创作，提升转化率
          </p>
          {!isAuthenticated ? (
            // 未登录：显示开始创作和立即登录按钮
            <div className="flex items-center justify-center gap-4">
              <Button
                size="lg"
                className="h-14 px-10 text-lg"
                onClick={() => handleAuthClick('register')}
              >
                开始创作
                <ChevronRight className="w-5 h-5 ml-2" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-14 px-10 text-lg"
                onClick={() => handleAuthClick('login')}
              >
                立即登录
              </Button>
            </div>
          ) : (
            // 已登录：显示进入系统按钮
            <Button
              size="lg"
              className="h-14 px-10 text-lg"
              onClick={() => router.push('/')}
            >
              进入系统
              <ChevronRight className="w-5 h-5 ml-2" />
            </Button>
          )}
        </div>
      </section>

      {/* 成品案例展示 */}
      <section className="py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-4xl font-bold mb-3">成品案例</h2>
            <p className="text-lg text-muted-foreground">查看 AI 生成的长视频效果</p>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : cases.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">
              暂无案例
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
              {cases.map((item) => (
                <div key={item.id} className="cursor-pointer">
                  <div
                    className="rounded-xl overflow-hidden relative border-2 border-slate-200 dark:border-slate-800 hover:border-blue-500 transition-colors bg-muted group"
                    onClick={() => toggleVideo(item.id)}
                  >
                    <video
                      ref={(el) => { videoRefs.current[item.id] = el; }}
                      src={item.mediaUrl}
                      poster={item.thumbnailUrl}
                      preload="metadata"
                      className={`w-full h-auto object-contain ${playingVideoId === item.id ? '' : 'group-hover:opacity-90'}`}
                      controls={playingVideoId === item.id}
                      onEnded={() => setPlayingVideoId(null)}
                    />
                    {playingVideoId !== item.id && (
                      <>
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 pointer-events-none">
                          <Play className="w-16 h-16 text-white fill-white" />
                        </div>
                        {item.duration && (
                          <Badge className="absolute bottom-2 right-2 bg-black/70 text-white pointer-events-none">
                            {item.duration}秒
                          </Badge>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 核心功能 */}
      <section className="py-12 px-4 bg-gradient-to-b from-blue-50/50 to-purple-50/50 dark:from-blue-950/20 dark:to-purple-950/20">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-4xl font-bold mb-3">核心功能</h2>
            <p className="text-lg text-muted-foreground">一站式 AI 视频创作解决方案</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 bg-white dark:bg-slate-800 rounded-2xl border-2 border-blue-200 dark:border-blue-800 hover:shadow-xl transition-shadow">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
                  <Video className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-xl font-bold">长视频生成</h3>
              </div>
              <p className="text-base text-muted-foreground mb-2">
                最长 <span className="text-blue-600 font-bold">60秒</span> 完整视频
              </p>
              <p className="text-sm text-muted-foreground">
                超越传统短视频限制，完整展示产品卖点，深度讲解使用场景
              </p>
            </div>

            <div className="p-6 bg-white dark:bg-slate-800 rounded-2xl border-2 border-purple-200 dark:border-purple-800 hover:shadow-xl transition-shadow">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
                  <Sparkles className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-xl font-bold">AI 自动脚本</h3>
              </div>
              <p className="text-base text-muted-foreground mb-2">
                根据产品信息 <span className="text-purple-600 font-bold">自动生成</span> 完整脚本
              </p>
              <p className="text-sm text-muted-foreground">
                智能分析产品特点，自动生成专业分镜脚本和口播台词
              </p>
            </div>

            <div className="p-6 bg-white dark:bg-slate-800 rounded-2xl border-2 border-pink-200 dark:border-pink-800 hover:shadow-xl transition-shadow">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-14 h-14 bg-gradient-to-br from-pink-500 to-pink-600 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
                  <Target className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-xl font-bold">强力钩子</h3>
              </div>
              <p className="text-base text-muted-foreground mb-2">
                <span className="text-pink-600 font-bold">10种</span> 高转化钩子模板
              </p>
              <p className="text-sm text-muted-foreground">
                痛点暴击、颠覆认知、悬念提问等，黄金3秒抓住用户注意力
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 产品优势 */}
      <section className="py-10 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-4xl font-bold mb-3">为什么选择 Avatap</h2>
            <p className="text-lg text-muted-foreground">专为跨境电商内容创作量身打造</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 rounded-xl border border-green-200 dark:border-green-800">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Zap className="w-5 h-5 text-green-600" />
                </div>
                <h3 className="text-base font-bold">提升转化率</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                专业钩子设计，前3秒抓住用户，提升视频转化效果
              </p>
            </div>

            <div className="p-5 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20 rounded-xl border border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Clock className="w-5 h-5 text-blue-600" />
                </div>
                <h3 className="text-base font-bold">节省时间</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                AI 自动生成脚本和视频，无需专业团队，分钟级完成创作
              </p>
            </div>

            <div className="p-5 bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-950/20 dark:to-violet-950/20 rounded-xl border border-purple-200 dark:border-purple-800">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Video className="w-5 h-5 text-purple-600" />
                </div>
                <h3 className="text-base font-bold">专业级质量</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                高清输出，专业分镜，满足电商营销高标准要求
              </p>
            </div>

            <div className="p-5 bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20 rounded-xl border border-orange-200 dark:border-orange-800">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Globe className="w-5 h-5 text-orange-600" />
                </div>
                <h3 className="text-base font-bold">多平台适配</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                支持竖版横版，适配 TikTok、抖音、Instagram 等平台
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 使用流程 */}
      <section className="py-10 px-4 bg-slate-50 dark:bg-slate-900/50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-4xl font-bold mb-3">简单三步，生成专业视频</h2>
            <p className="text-lg text-muted-foreground">无需专业技能，人人都能创作</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl">
                <span className="text-3xl font-bold text-white">1</span>
              </div>
              <h3 className="text-xl font-bold mb-3">上传产品信息</h3>
              <p className="text-muted-foreground">
                简单描述产品名称、类别和核心卖点
              </p>
            </div>

            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl">
                <span className="text-3xl font-bold text-white">2</span>
              </div>
              <h3 className="text-xl font-bold mb-3">AI 自动生成</h3>
              <p className="text-muted-foreground">
                AI 自动生成完整脚本和强力钩子
              </p>
            </div>

            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-pink-500 to-pink-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl">
                <span className="text-3xl font-bold text-white">3</span>
              </div>
              <h3 className="text-xl font-bold mb-3">导出专业视频</h3>
              <p className="text-muted-foreground">
                一键生成60秒长视频，直接使用
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA 区域 */}
      {!isAuthenticated && (
        <section className="py-16 px-4 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">立即开始，提升转化率</h2>
            <p className="text-xl opacity-90 mb-6 max-w-2xl mx-auto">
              免费注册，体验 AI 视频创作的强大功能
              <br />
              让您的产品视频脱颖而出
            </p>
            <Button
              size="lg"
              variant="secondary"
              className="h-14 px-12 text-lg"
              onClick={() => handleAuthClick('register')}
            >
              免费注册
              <ChevronRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        </section>
      )}

      {/* 快捷入口 */}
      <section className="py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button
              variant="outline"
              className="h-16 px-8 text-base flex items-center justify-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-800"
              onClick={() => window.open('/guide', '_blank')}
            >
              <BookOpen className="w-5 h-5" />
              查看使用指南
              <ChevronRight className="w-4 h-4 ml-auto" />
            </Button>
            <Button
              variant="outline"
              className="h-16 px-8 text-base flex items-center justify-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-800"
              onClick={() => {
                if (isAuthenticated) {
                  router.push('/shortfilm');
                } else {
                  handleAuthClick('register');
                }
              }}
            >
              <FolderOpen className="w-5 h-5" />
              我的项目
              <ChevronRight className="w-4 h-4 ml-auto" />
            </Button>
            <Button
              variant="outline"
              className="h-16 px-8 text-base flex items-center justify-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-800"
              onClick={() => setCustomerServiceDialogOpen(true)}
            >
              <MessageCircle className="w-5 h-5" />
              联系客服
              <ChevronRight className="w-4 h-4 ml-auto" />
            </Button>
          </div>
        </div>
      </section>

    </div>
  );
}
