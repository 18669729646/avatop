'use client';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Image as ImageIcon } from 'lucide-react';
import { SeedanceParams } from '@/components/shortfilm/step4-video-generation';

interface VideoConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isAdmin: boolean;
  pendingVideoTask: {
    taskId: string;
    prompt: string;
    startFrameUrl?: string;
    endFrameUrl?: string;
    model: string;
    baseUrl: string;
    seedanceParams?: SeedanceParams;
  } | null;
  onConfirm: (task: NonNullable<VideoConfirmDialogProps['pendingVideoTask']>) => void;
}

function isSeedanceModel(model?: string): boolean {
  return !!model && (model.startsWith('doubao-seedance') || model.startsWith('seedance'));
}

// Seedance 积分价格表（积分/秒）
const SEEDANCE_CREDITS: Record<string, Record<string, number>> = {
  'doubao-seedance-2.0': { '480p': 80, '720p': 120, '1080p': 150 },
  'doubao-seedance-2.0-fast': { '480p': 60, '720p': 100 },
};

export function VideoConfirmDialog({
  open,
  onOpenChange,
  isAdmin,
  pendingVideoTask,
  onConfirm,
}: VideoConfirmDialogProps) {
  const isSeedance = isSeedanceModel(pendingVideoTask?.model);
  const seedanceP = pendingVideoTask?.seedanceParams;

  // 计算积分
  const estimatedCredits = isSeedance && pendingVideoTask?.model && seedanceP
    ? (SEEDANCE_CREDITS[pendingVideoTask.model]?.[seedanceP.resolution] || 0) * seedanceP.duration
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>确认生成视频</DialogTitle>
          <DialogDescription>
            {isAdmin ? '请检查以下请求参数，确认后将发送给AI模型生成视频' : '确认后将发送给AI模型生成视频'}
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-auto space-y-4">
          {pendingVideoTask && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium mb-2 block">首帧</Label>
                <div className="aspect-video rounded-lg overflow-hidden border bg-muted">
                  {pendingVideoTask.startFrameUrl ? (
                    <img src={pendingVideoTask.startFrameUrl} alt="首帧" loading="lazy" className="w-full h-full object-contain" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon className="w-6 h-6 text-muted-foreground" />
                    </div>
                  )}
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium mb-2 block">尾帧</Label>
                <div className="aspect-video rounded-lg overflow-hidden border bg-muted">
                  {pendingVideoTask.endFrameUrl ? (
                    <img src={pendingVideoTask.endFrameUrl} alt="尾帧" loading="lazy" className="w-full h-full object-contain" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon className="w-6 h-6 text-muted-foreground" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Seedance 参数摘要 */}
          {isSeedance && seedanceP && (
            <div className="p-3 rounded-lg border bg-muted/50 space-y-2">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800">
                  Seedance 2.0
                </Badge>
                {estimatedCredits !== null && (
                  <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800">
                    预估 {estimatedCredits} 积分
                  </Badge>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">宽高比：</span>
                  <span className="font-medium">{seedanceP.aspectRatio}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">分辨率：</span>
                  <span className="font-medium">{seedanceP.resolution}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">时长：</span>
                  <span className="font-medium">{seedanceP.duration}秒</span>
                </div>
              </div>
              <div className="flex gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">水印：</span>
                  <span className="font-medium">{seedanceP.watermark ? '是' : '否'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">真人模式：</span>
                  <span className="font-medium">{seedanceP.realPersonMode ? '是' : '否'}</span>
                </div>
              </div>
            </div>
          )}

          {isAdmin && pendingVideoTask && (
            <div>
              <Label className="text-sm font-medium mb-2 block">完整请求体</Label>
              <pre className="text-xs bg-muted p-4 rounded-lg overflow-auto whitespace-pre-wrap break-all max-h-64">
                {JSON.stringify({
                  prompt: pendingVideoTask.prompt,
                  images: [pendingVideoTask.startFrameUrl, pendingVideoTask.endFrameUrl].filter(Boolean),
                  aspectRatio: isSeedance ? seedanceP?.aspectRatio : '9:16',
                  model: pendingVideoTask.model,
                  baseUrl: pendingVideoTask.baseUrl,
                  ...(isSeedance && seedanceP ? {
                    resolution: seedanceP.resolution,
                    duration: seedanceP.duration,
                    watermark: seedanceP.watermark,
                    realPersonMode: seedanceP.realPersonMode,
                  } : {}),
                }, null, 2)}
              </pre>
            </div>
          )}
        </div>
        <DialogFooter className="flex-col sm:flex-row gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
            取消
          </Button>
          <Button
            onClick={() => pendingVideoTask && onConfirm(pendingVideoTask)}
            className="w-full sm:w-auto"
          >
            确认生成
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
