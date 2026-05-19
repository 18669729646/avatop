'use client';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';

interface ScriptConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isAdmin: boolean;
  scriptRequestBody: Record<string, unknown> | null;
  isGeneratingScript: boolean;
  onConfirm: (body: Record<string, unknown>) => void;
}

export function ScriptConfirmDialog({
  open,
  onOpenChange,
  isAdmin,
  scriptRequestBody,
  isGeneratingScript,
  onConfirm,
}: ScriptConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>确认生成脚本</DialogTitle>
          <DialogDescription>
            {isAdmin ? '请检查以下请求参数，确认后将发送给AI模型生成脚本' : '确认后将发送给AI模型生成脚本'}
          </DialogDescription>
        </DialogHeader>
        {isAdmin && (
          <div className="flex-1 overflow-auto">
            <pre className="text-xs bg-muted p-4 rounded-lg overflow-auto whitespace-pre-wrap break-all">
              {scriptRequestBody ? JSON.stringify(scriptRequestBody, null, 2) : ''}
            </pre>
          </div>
        )}
        <DialogFooter className="flex-col sm:flex-row gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
            取消
          </Button>
          <Button
            onClick={() => scriptRequestBody && onConfirm(scriptRequestBody)}
            disabled={isGeneratingScript}
            className="w-full sm:w-auto"
          >
            {isGeneratingScript ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                生成中...
              </>
            ) : (
              '确认生成'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
