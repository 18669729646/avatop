'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  ArrowLeft,
  ArrowRight,
  Image as ImageIcon,
  Loader2,
  Play,
  Check,
  AlertCircle,
  Maximize2,
  Settings2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  VideoTask,
} from '@/lib/shortfilm';
import { ImageTask } from '@/lib/shortfilm';
import { VideoApiConfig } from '@/lib/system-config';
import { ModelSelector } from '@/components/model-selector';

// Seedance 2.0 支持的配置选项
const SEEDANCE_ASPECT_RATIOS = [
  { value: '16:9', label: '16:9 横屏' },
  { value: '9:16', label: '9:16 竖屏' },
  { value: '4:3', label: '4:3 横屏' },
  { value: '3:4', label: '3:4 竖屏' },
  { value: '1:1', label: '1:1 方形' },
  { value: '21:9', label: '21:9 超宽屏' },
  { value: 'adaptive', label: '自适应（根据输入图）' },
];

const SEEDANCE_RESOLUTIONS = [
  { value: '480p', label: '480p' },
  { value: '720p', label: '720p' },
  { value: '1080p', label: '1080p（仅标准版）' },
];

const SEEDANCE_DURATIONS = [
  { value: 4, label: '4秒' },
  { value: 5, label: '5秒（默认）' },
  { value: 6, label: '6秒' },
  { value: 7, label: '7秒' },
  { value: 8, label: '8秒' },
  { value: 9, label: '9秒' },
  { value: 10, label: '10秒' },
  { value: 11, label: '11秒' },
  { value: 12, label: '12秒' },
  { value: 13, label: '13秒' },
  { value: 14, label: '14秒' },
  { value: 15, label: '15秒' },
];

// Seedance 积分价格表（积分/秒）
const SEEDANCE_CREDITS: Record<string, Record<string, number>> = {
  'doubao-seedance-2.0': { '480p': 80, '720p': 120, '1080p': 150 },
  'doubao-seedance-2.0-fast': { '480p': 60, '720p': 100 },
};

function isSeedanceModel(model?: string): boolean {
  return !!model && (model.startsWith('doubao-seedance') || model.startsWith('seedance'));
}

// Seedance 额外参数
export interface SeedanceParams {
  aspectRatio: string;
  resolution: string;
  duration: number;
  watermark: boolean;
  realPersonMode: boolean;
}

interface Step4VideoGenerationProps {
  selectedVideoModelId: string;
  onSelectedVideoModelIdChange: (id: string) => void;
  selectedVideoModelConfig: VideoApiConfig | null;
  onSelectedVideoModelConfigChange: (config: VideoApiConfig) => void;
  videoTasks: VideoTask[];
  onVideoTasksChange: (tasks: VideoTask[]) => void;
  videoTasksRef: React.MutableRefObject<VideoTask[]>;
  imageTasks: ImageTask[];
  onVideoGenerate: (taskId: string, prompt: string, startFrameUrl: string | undefined, endFrameUrl: string | undefined, model: string, baseUrl: string, seedanceParams?: SeedanceParams) => void;
  onPreviewVideo: (url: string) => void;
  onGoBack: () => void;
  onMergeVideos: () => void;
  // Seedance 参数（由父组件管理）
  seedanceParams: SeedanceParams;
  onSeedanceParamsChange: (params: SeedanceParams) => void;
}

export function Step4VideoGeneration({
  selectedVideoModelId,
  onSelectedVideoModelIdChange,
  selectedVideoModelConfig,
  onSelectedVideoModelConfigChange,
  videoTasks,
  onVideoTasksChange,
  videoTasksRef,
  imageTasks,
  onVideoGenerate,
  onPreviewVideo,
  onGoBack,
  onMergeVideos,
  seedanceParams,
  onSeedanceParamsChange,
}: Step4VideoGenerationProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const isSeedance = isSeedanceModel(selectedVideoModelConfig?.model);

  // 计算当前 Seedance 配置的积分消耗
  const estimatedCredits = useMemo(() => {
    if (!isSeedance || !selectedVideoModelConfig?.model) return null;
    const model = selectedVideoModelConfig.model;
    const prices = SEEDANCE_CREDITS[model];
    if (!prices) return null;
    const perSecond = prices[seedanceParams.resolution] || prices['720p'] || 0;
    return perSecond * seedanceParams.duration;
  }, [isSeedance, selectedVideoModelConfig?.model, seedanceParams.resolution, seedanceParams.duration]);

  // 检查分辨率是否可选
  const isResolutionDisabled = (resolution: string): boolean => {
    if (selectedVideoModelConfig?.model === 'doubao-seedance-2.0-fast' && resolution === '1080p') {
      return true; // Fast 版不支持 1080p
    }
    return false;
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">生成视频片段</h2>
        <p className="text-sm text-muted-foreground mb-4">
          为每个段落生成视频
        </p>

        <div className="mb-4 flex items-center gap-3">
          <Label className="shrink-0">视频生成模型</Label>
          <ModelSelector
            type="video"
            value={selectedVideoModelId}
            onChange={(id, config) => {
              onSelectedVideoModelIdChange(id);
              onSelectedVideoModelConfigChange(config as VideoApiConfig);
            }}
            placeholder="选择视频模型"
          />
        </div>

        {/* Seedance 2.0 高级参数面板 */}
        {isSeedance && (
          <div className="mb-4 border rounded-lg overflow-hidden">
            <button
              type="button"
              className="w-full flex items-center justify-between px-4 py-3 bg-muted/50 hover:bg-muted/70 transition-colors"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              <div className="flex items-center gap-2">
                <Settings2 className="w-4 h-4" />
                <span className="text-sm font-medium">Seedance 2.0 参数配置</span>
                {estimatedCredits !== null && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800">
                    预估 {estimatedCredits} 积分
                  </Badge>
                )}
              </div>
              {showAdvanced ? (
                <ChevronUp className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              )}
            </button>

            {showAdvanced && (
              <div className="p-4 space-y-4 bg-card">
                {/* 宽高比 */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm">宽高比</Label>
                    <Select
                      value={seedanceParams.aspectRatio}
                      onValueChange={(v) => onSeedanceParamsChange({ ...seedanceParams, aspectRatio: v })}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SEEDANCE_ASPECT_RATIOS.map((ar) => (
                          <SelectItem key={ar.value} value={ar.value}>
                            {ar.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* 分辨率 */}
                  <div className="space-y-2">
                    <Label className="text-sm">分辨率</Label>
                    <Select
                      value={seedanceParams.resolution}
                      onValueChange={(v) => onSeedanceParamsChange({ ...seedanceParams, resolution: v })}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SEEDANCE_RESOLUTIONS.map((res) => (
                          <SelectItem
                            key={res.value}
                            value={res.value}
                            disabled={isResolutionDisabled(res.value)}
                          >
                            {res.label}
                            {isResolutionDisabled(res.value) && ' (不可用)'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* 时长 */}
                <div className="space-y-2">
                  <Label className="text-sm">视频时长</Label>
                  <Select
                    value={String(seedanceParams.duration)}
                    onValueChange={(v) => onSeedanceParamsChange({ ...seedanceParams, duration: Number(v) })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SEEDANCE_DURATIONS.map((d) => (
                        <SelectItem key={d.value} value={String(d.value)}>
                          {d.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* 开关选项 */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-sm">真人模式</Label>
                    <p className="text-xs text-muted-foreground">参考图/视频中含真人时需开启</p>
                  </div>
                  <Switch
                    checked={seedanceParams.realPersonMode}
                    onCheckedChange={(v) => onSeedanceParamsChange({ ...seedanceParams, realPersonMode: v })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-sm">添加水印</Label>
                    <p className="text-xs text-muted-foreground">AI 生成水印标识</p>
                  </div>
                  <Switch
                    checked={seedanceParams.watermark}
                    onCheckedChange={(v) => onSeedanceParamsChange({ ...seedanceParams, watermark: v })}
                  />
                </div>

                {/* 积分预估 */}
                {estimatedCredits !== null && (
                  <div className="p-3 rounded-lg bg-muted/50 border text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">预估积分消耗</span>
                      <span className="font-semibold text-amber-600 dark:text-amber-400">{estimatedCredits} 积分</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {seedanceParams.resolution} × {seedanceParams.duration}秒 × {SEEDANCE_CREDITS[selectedVideoModelConfig?.model || '']?.[seedanceParams.resolution] || 0} 积分/秒
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="space-y-4">
          {videoTasks.map((task) => (
            <div key={task.id} className="p-4 border rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <Badge>视频 {task.order}</Badge>
                <Badge
                  variant={
                    task.status === 'completed'
                      ? 'default'
                      : task.status === 'generating'
                      ? 'secondary'
                      : task.status === 'failed'
                      ? 'destructive'
                      : 'outline'
                  }
                >
                  {task.status === 'completed'
                    ? '已完成'
                    : task.status === 'generating'
                    ? '生成中'
                    : task.status === 'failed'
                    ? '生成失败'
                    : '待生成'}
                </Badge>
              </div>

              {task.status === 'failed' && (
                <div className="mb-3 p-2 bg-red-50 dark:bg-red-900/20 rounded text-sm text-red-600 dark:text-red-400">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-medium mb-1">视频生成失败</p>
                      {task.error && <p className="text-xs whitespace-pre-wrap">{task.error}</p>}
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 mb-3">
                <div>
                  <Label className="text-xs text-muted-foreground">首帧</Label>
                  <div className="mt-1 aspect-video rounded-lg overflow-hidden border bg-muted">
                    {task.startFrameUrl ? (
                      <img src={task.startFrameUrl} alt="" loading="lazy" className="w-full h-full object-contain" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="w-6 h-6 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">尾帧</Label>
                  <div className="mt-1 aspect-video rounded-lg overflow-hidden border bg-muted">
                    {task.endFrameUrl ? (
                      <img src={task.endFrameUrl} alt="" loading="lazy" className="w-full h-full object-contain" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="w-6 h-6 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="mb-3">
                <Label className="text-xs text-muted-foreground">视频提示词</Label>
                <Textarea
                  value={task.prompt}
                  onChange={(e) => {
                    const updated = videoTasks.map((t) => (t.id === task.id ? { ...t, prompt: e.target.value } : t));
                    onVideoTasksChange(updated);
                    videoTasksRef.current = updated;
                  }}
                  rows={2}
                  className="mt-1 text-sm"
                />
              </div>

              {task.generatedVideos.length > 0 && (
                <div className="mb-3">
                  <Label className="text-xs text-muted-foreground mb-2 block">
                    已生成视频 ({task.generatedVideos.length}) - 点击选择用于合成
                  </Label>
                  <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
                    {task.generatedVideos.map((video, videoIndex) => {
                      const isSelected = task.selectedVideoId === video.id;
                      const aspectRatio = task.aspectRatio || '9:16';
                      const isVertical = aspectRatio === '9:16' || aspectRatio === '1:1';
                      const containerAspect = isVertical ? 'aspect-[9/16]' : 'aspect-video';
                      const containerWidth = isVertical ? 'w-20' : 'w-32';

                      return (
                        <div
                          key={video.id}
                          className={cn(
                            'relative flex-shrink-0 rounded-lg overflow-hidden cursor-pointer border-2 transition-all group',
                            containerWidth,
                            containerAspect,
                            isSelected
                              ? 'border-primary ring-2 ring-primary/20'
                              : 'border-transparent hover:border-slate-300 dark:hover:border-slate-600'
                          )}
                          onClick={() => {
                            const updated = videoTasks.map((t) =>
                              t.id === task.id ? { ...t, selectedVideoId: video.id } : t
                            );
                            onVideoTasksChange(updated);
                            videoTasksRef.current = updated;
                          }}
                        >
                          <div className="w-full h-full bg-muted">
                            <video
                              src={video.url}
                              className="w-full h-full object-contain"
                              muted
                              playsInline
                              preload="metadata"
                              onMouseEnter={(e) => {
                                e.currentTarget.play().catch(() => {});
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.pause();
                                e.currentTarget.currentTime = 0;
                              }}
                            />
                          </div>

                          {isSelected && (
                            <div className="absolute top-1 left-1 bg-primary text-white rounded-full p-0.5">
                              <Check className="w-3 h-3" />
                            </div>
                          )}

                          <div className="absolute bottom-1 left-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">
                            #{videoIndex + 1}
                          </div>

                          <button
                            className="absolute top-1 right-1 bg-black/60 hover:bg-black/80 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => {
                              e.stopPropagation();
                              onPreviewVideo(video.url);
                            }}
                          >
                            <Maximize2 className="w-3 h-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  {task.generatedVideos.length > 1 && (
                    <p className="text-[10px] text-muted-foreground mt-1">
                      已选择第 {task.generatedVideos.findIndex((v) => v.id === task.selectedVideoId) + 1} 个视频用于合成
                    </p>
                  )}
                </div>
              )}

              <Button
                size="sm"
                className="w-full"
                variant={task.status === 'completed' ? 'outline' : 'default'}
                disabled={task.status === 'generating'}
                onClick={() => onVideoGenerate(
                  task.id,
                  task.prompt,
                  task.startFrameUrl,
                  task.endFrameUrl,
                  selectedVideoModelConfig?.model || '',
                  selectedVideoModelConfig?.baseUrl || '',
                  isSeedance ? seedanceParams : undefined
                )}
              >
                {task.status === 'generating' ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    生成中...
                  </>
                ) : task.status === 'completed' ? (
                  <>
                    <Play className="w-4 h-4 mr-1" />
                    重新生成
                  </>
                ) : task.status === 'failed' ? (
                  <>
                    <Play className="w-4 h-4 mr-1" />
                    重试
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-1" />
                    生成视频
                  </>
                )}
              </Button>
            </div>
          ))}
        </div>

        <div className="flex justify-between mt-6">
          <Button variant="outline" onClick={onGoBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回修改图片
          </Button>
          <Button
            className="bg-gradient-to-r from-purple-500 to-pink-500"
            disabled={!videoTasks.every((t) => t.status === 'completed')}
            onClick={onMergeVideos}
          >
            全部视频已生成，合成短片
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </Card>
    </div>
  );
}
