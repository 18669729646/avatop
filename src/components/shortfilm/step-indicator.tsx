'use client';

import { Check, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';

const STEPS = [
  { id: 1 as const, title: '脚本生成', description: 'AI生成视频脚本' },
  { id: 2 as const, title: '确认脚本', description: '编辑和确认脚本内容' },
  { id: 3 as const, title: '生成图片', description: '生成每个段落的图片' },
  { id: 4 as const, title: '生成视频', description: '生成最终视频片段' },
  { id: 5 as const, title: '预览成果', description: '查看完成的短片' },
];

interface StepIndicatorProps {
  currentStep: number;
  maxCompletedStep: number;
  hasMergedVideos: boolean;
  onStepClick: (step: number) => void;
}

export function StepIndicator({ currentStep, maxCompletedStep, hasMergedVideos, onStepClick }: StepIndicatorProps) {
  const getStepStatus = (step: number): 'completed' | 'current' | 'pending' => {
    if (step === 5) {
      if (hasMergedVideos) return 'completed';
      if (maxCompletedStep >= 4) return 'current';
      return 'pending';
    }
    if (step <= maxCompletedStep) return 'completed';
    if (step === currentStep) return 'current';
    return 'pending';
  };

  const progressPercentage = (maxCompletedStep / (STEPS.length - 1)) * 100;

  return (
    <div className="bg-muted/30 border-b">
      <div className="px-6 py-2 bg-background/50">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-muted-foreground">项目进度</span>
          <span className="text-xs font-medium text-primary">{Math.round(progressPercentage)}%</span>
        </div>
        <Progress value={progressPercentage} className="h-2" />
      </div>

      <div className="flex items-center justify-center gap-0.5 px-4 py-2">
        {STEPS.map((step, index) => {
          const status = getStepStatus(step.id);
          const isClickable = (status === 'completed' || status === 'current') && step.id !== currentStep;
          return (
            <div key={step.id} className="flex items-center">
              <div
                onClick={() => onStepClick(step.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all duration-200",
                  status === 'completed' && "bg-green-500 text-white cursor-pointer hover:bg-green-600 hover:shadow-sm",
                  status === 'current' && "bg-primary text-primary-foreground shadow-sm cursor-pointer hover:opacity-90",
                  status === 'pending' && "text-muted-foreground cursor-not-allowed",
                  isClickable && "cursor-pointer"
                )}
                title={isClickable ? `点击${step.id === 5 ? '查看' : '返回'}步骤 ${step.id}: ${step.title}` : undefined}
              >
                {status === 'completed' ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <span className="w-4 h-4 flex items-center justify-center rounded-full text-[10px] font-semibold bg-muted">{step.id}</span>
                )}
                <span>{step.title}</span>
              </div>
              {index < STEPS.length - 1 && (
                <div className={cn(
                  "w-6 h-px mx-1 transition-colors",
                  status === 'completed' ? "bg-green-500" : "bg-border"
                )} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
