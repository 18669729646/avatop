'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { VisuallyHidden } from '@/components/ui/visually-hidden';
import { X, Image as ImageIcon, FileText, Video, ArrowDown } from 'lucide-react';

// 引导步骤
const steps = [
  {
    id: 1,
    icon: ImageIcon,
    iconColor: 'from-blue-500 to-blue-600',
    iconBgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-200 dark:border-blue-800',
    title: '图库管理',
    description: '上传产品图和角色图',
  },
  {
    id: 2,
    icon: FileText,
    iconColor: 'from-purple-500 to-purple-600',
    iconBgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-200 dark:border-purple-800',
    title: '广告模板',
    description: '配置脚本和钩子',
  },
  {
    id: 3,
    icon: Video,
    iconColor: 'from-pink-500 to-pink-600',
    iconBgColor: 'bg-pink-500/10',
    borderColor: 'border-pink-200 dark:border-pink-800',
    title: '短片管理',
    description: '一键创建短视频',
  },
];

interface OnboardingGuideProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function OnboardingGuide({ open, onOpenChange }: OnboardingGuideProps) {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  // 从 localStorage 加载设置
  useEffect(() => {
    try {
      const savedChoice = localStorage.getItem('onboarding_dont_show');
      console.log('[OnboardingGuide] localStorage 读取:', savedChoice);
      // 使用 setTimeout 避免同步 setState
      setTimeout(() => {
        setDontShowAgain(savedChoice === 'true');
      }, 0);
    } catch (error) {
      console.error('[OnboardingGuide] localStorage 读取失败:', error);
    }
  }, []);

  // 勾选或取消勾选"不再显示"时同步保存
  useEffect(() => {
    try {
      if (dontShowAgain) {
        localStorage.setItem('onboarding_dont_show', 'true');
        console.log('[OnboardingGuide] 已保存不再显示设置');
      } else {
        localStorage.removeItem('onboarding_dont_show');
        console.log('[OnboardingGuide] 已清除不再显示设置');
      }
    } catch (error) {
      console.error('[OnboardingGuide] localStorage 保存失败:', error);
    }
  }, [dontShowAgain]);

  const handleClose = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-0 overflow-hidden border-2 border-primary/20 shadow-2xl [&>button]:hidden">
        <VisuallyHidden>
          <DialogTitle>新手引导</DialogTitle>
        </VisuallyHidden>
        
        {/* 顶部渐变背景 */}
        <div className="h-16 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center relative overflow-hidden">
          {/* 装饰圆点 */}
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-2 left-10 w-2 h-2 bg-white rounded-full" />
            <div className="absolute top-4 right-20 w-3 h-3 bg-white rounded-full" />
            <div className="absolute bottom-3 left-1/4 w-2 h-2 bg-white rounded-full" />
            <div className="absolute bottom-2 right-1/3 w-1.5 h-1.5 bg-white rounded-full" />
          </div>
          
          {/* 标题 */}
          <div className="relative z-10 text-center">
            <h2 className="text-xl font-bold text-white tracking-wide">
              🚀 快速开始
            </h2>
            <p className="text-white/90 text-sm mt-1">
              三步完成爆款短视频制作
            </p>
          </div>
        </div>

        <div className="p-6">
          {/* 步骤卡片 */}
          <div className="space-y-4">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isLast = index === steps.length - 1;
              
              return (
                <div key={step.id} className="relative">
                  {/* 步骤卡片 */}
                  <div className={`flex items-center gap-4 p-4 rounded-xl border-2 ${step.borderColor} ${step.iconBgColor} hover:shadow-md transition-shadow`}>
                    {/* 步骤序号 */}
                    <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${step.iconColor} flex items-center justify-center text-white font-bold text-sm shadow-lg`}>
                      {step.id}
                    </div>
                    
                    {/* 图标 */}
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${step.iconColor} flex items-center justify-center shadow-md`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    
                    {/* 内容 */}
                    <div className="flex-1">
                      <h3 className="font-bold text-base text-foreground">{step.title}</h3>
                      <p className="text-sm text-muted-foreground mt-0.5">{step.description}</p>
                    </div>
                  </div>
                  
                  {/* 连接箭头 */}
                  {!isLast && (
                    <div className="flex justify-center items-center py-0.5 mt-2">
                      <ArrowDown className="w-5 h-5 text-muted-foreground/50" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* 底部操作 */}
          <div className="flex items-center justify-between pt-5 mt-5 border-t">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={dontShowAgain}
                onChange={(e) => setDontShowAgain(e.target.checked)}
                className="w-4 h-4 rounded border-2 border-gray-400 bg-white checked:bg-primary checked:border-primary focus:ring-2 focus:ring-primary focus:ring-offset-2 cursor-pointer"
              />
              <span className="text-sm text-muted-foreground">
                不再显示
              </span>
            </label>
            
            <button
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
            >
              关闭
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
