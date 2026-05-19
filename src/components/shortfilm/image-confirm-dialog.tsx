'use client';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

interface ImageConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isAdmin: boolean;
  pendingImageTask: {
    taskId: string;
    prompt: string;
    images: string[];
    model: string;
    baseUrl: string;
    referenceImages: string[];
  } | null;
  onConfirm: (task: NonNullable<ImageConfirmDialogProps['pendingImageTask']>) => void;
}

export function ImageConfirmDialog({
  open,
  onOpenChange,
  isAdmin,
  pendingImageTask,
  onConfirm,
}: ImageConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>确认生成图片</DialogTitle>
          <DialogDescription>
            {isAdmin ? '请检查以下请求参数，确认后将发送给AI模型生成图片' : '确认后将发送给AI模型生成图片'}
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-auto space-y-4">
          {pendingImageTask && pendingImageTask.images.length > 0 && (
            <div>
              <Label className="text-sm font-medium mb-2 block">参考图 ({pendingImageTask.images.length} 张)</Label>
              <div className="flex gap-2 flex-wrap">
                {pendingImageTask.images.map((url, idx) => (
                  <div key={idx} className="w-16 h-16 rounded-lg overflow-hidden border bg-muted">
                    <img src={url} alt={`参考图${idx + 1}`} loading="lazy" className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            </div>
          )}
          {isAdmin && pendingImageTask && (
            <div>
              <Label className="text-sm font-medium mb-2 block">完整请求体</Label>
              <pre className="text-xs bg-muted p-4 rounded-lg overflow-auto whitespace-pre-wrap break-all max-h-64">
                {JSON.stringify({
                  prompt: pendingImageTask.prompt,
                  images: pendingImageTask.images,
                  aspectRatio: '9:16',
                  resolution: '2K',
                  model: pendingImageTask.model,
                  baseUrl: pendingImageTask.baseUrl,
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
            onClick={() => pendingImageTask && onConfirm(pendingImageTask)}
            className="w-full sm:w-auto"
          >
            确认生成
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
