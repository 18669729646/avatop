'use client';

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { X, Download } from 'lucide-react';

interface VideoPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  videoUrl: string | null;
}

export function VideoPreviewDialog({
  open,
  onOpenChange,
  videoUrl,
}: VideoPreviewDialogProps) {
  const handleDownload = async () => {
    if (!videoUrl) return;
    try {
      const response = await fetch(videoUrl);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `video_${Date.now()}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('Download failed:', err);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden bg-black border-0">
        <DialogTitle className="sr-only">视频预览</DialogTitle>
        <div className="relative">
          <div className="absolute top-2 right-2 z-10 flex gap-2">
            <button
              className="bg-black/60 hover:bg-black/80 text-white rounded-full p-2 transition-colors"
              onClick={handleDownload}
            >
              <Download className="w-5 h-5" />
            </button>
            <button
              className="bg-black/60 hover:bg-black/80 text-white rounded-full p-2 transition-colors"
              onClick={() => onOpenChange(false)}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          {videoUrl && (
            <video
              src={videoUrl}
              controls
              autoPlay
              className="w-full h-auto max-h-[80vh]"
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
