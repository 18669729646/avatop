'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Download, Loader2, Check, AlertCircle, Film, Clock, Trash2, Video } from 'lucide-react';
import { concatenateVideos, ProgressCallback } from '@/lib/video-merger';
import { MergedVideo } from '@/lib/shortfilm';

// 可选的切除秒数选项
const TRIM_OPTIONS = [
  { value: '0', label: '不切除' },
  { value: '0.3', label: '切除 0.3 秒' },
  { value: '0.31', label: '切除 0.31 秒' },
  { value: '0.32', label: '切除 0.32 秒' },
  { value: '0.33', label: '切除 0.33 秒' },
  { value: '0.34', label: '切除 0.34 秒' },
  { value: '0.35', label: '切除 0.35 秒（推荐）' },
  { value: '0.36', label: '切除 0.36 秒' },
  { value: '0.37', label: '切除 0.37 秒' },
  { value: '0.38', label: '切除 0.38 秒' },
  { value: '0.39', label: '切除 0.39 秒' },
  { value: '0.4', label: '切除 0.4 秒' },
];

interface VideoMergerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  videoUrls: string[];
  projectName?: string;
  mergedVideos: MergedVideo[];
  onVideosUpdate: (videos: MergedVideo[]) => void;
  onComplete?: (video: MergedVideo) => void; // 合成完成后的回调
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function VideoMergerDialog({
  open,
  onOpenChange,
  videoUrls,
  projectName = 'shortfilm',
  mergedVideos,
  onVideosUpdate,
  onComplete,
}: VideoMergerDialogProps) {
  const [status, setStatus] = useState<'idle' | 'processing' | 'done' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [currentVideo, setCurrentVideo] = useState<MergedVideo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [trimSeconds, setTrimSeconds] = useState<string>('0.35'); // 默认切除 0.35 秒（推荐）

  // 使用 ref 存储回调，避免依赖问题
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const handleMerge = useCallback(async () => {
    if (videoUrls.length === 0) {
      setError('没有视频可以拼接');
      setStatus('error');
      return;
    }

    setStatus('processing');
    setProgress(0);
    setError(null);
    setCurrentVideo(null);

    const onProgress: ProgressCallback = (p) => {
      setProgress(p.progress);
      setMessage(p.message);
    };

    try {
      const videoRecord = await concatenateVideos(
        videoUrls, 
        projectName, 
        onProgress,
        parseFloat(trimSeconds) // 传递切除秒数
      );
      
      setCurrentVideo(videoRecord);
      setStatus('done');
      setMessage('视频拼接完成！');
      
      // 添加到历史记录
      onVideosUpdate([videoRecord, ...mergedVideos]);
      
      // 调用完成回调
      onCompleteRef.current?.(videoRecord);
    } catch (err) {
      console.error('Video merge failed:', err);
      setError(err instanceof Error ? err.message : '视频拼接失败');
      setStatus('error');
    }
  }, [videoUrls, projectName, mergedVideos, onVideosUpdate, trimSeconds]);

  const handleDownload = useCallback(async (video: MergedVideo) => {
    try {
      // 使用 fetch + blob 模式下载，避免跨域 URL 的 download 属性被浏览器忽略
      const response = await fetch(video.url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `${video.projectName}_${video.createdAt}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Download failed:', error);
      // 如果 fetch 失败，回退到直接打开
      window.open(video.url, '_blank');
    }
  }, []);

  const handleDelete = useCallback((videoId: string) => {
    onVideosUpdate(mergedVideos.filter(v => v.id !== videoId));
  }, [mergedVideos, onVideosUpdate]);

  const handleClose = useCallback(() => {
    setStatus('idle');
    setProgress(0);
    setMessage('');
    setCurrentVideo(null);
    setError(null);
    onOpenChange(false);
  }, [onOpenChange]);

  const getStageIcon = () => {
    switch (status) {
      case 'processing':
        return <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />;
      case 'done':
        return <Check className="w-12 h-12 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-12 h-12 text-red-500" />;
      default:
        return <Film className="w-12 h-12 text-gray-400" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>合成完整视频</DialogTitle>
          <DialogDescription>
            将 {videoUrls.length} 个视频片段拼接成一个完整视频
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center py-4 space-y-4">
          {/* 状态图标 */}
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800">
            {getStageIcon()}
          </div>

          {/* 进度条 */}
          {(status === 'processing' || status === 'done') && (
            <div className="w-full space-y-2">
              <Progress value={progress} className="h-2" />
              <p className="text-sm text-center text-muted-foreground">{message}</p>
            </div>
          )}

          {/* 错误信息 */}
          {status === 'error' && (
            <div className="w-full p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {/* 当前合成的视频预览 */}
          {status === 'done' && currentVideo && (
            <div className="w-full space-y-3">
              <video
                src={currentVideo.url}
                controls
                className="w-full max-h-40 object-contain rounded-lg bg-black"
              />
              <Button
                onClick={() => handleDownload(currentVideo)}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
              >
                <Download className="w-4 h-4 mr-2" />
                下载视频 ({formatFileSize(currentVideo.size)})
              </Button>
            </div>
          )}

          {/* 操作按钮 */}
          {status === 'idle' && (
            <>
              {/* 切除选项 */}
              <div className="w-full space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">视频尾部切除</span>
                  <Select value={trimSeconds} onValueChange={setTrimSeconds}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="选择切除秒数" />
                    </SelectTrigger>
                    <SelectContent>
                      {TRIM_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-xs text-muted-foreground">
                  每个视频片段的尾部将被切除指定秒数后再拼接，可使转场更流畅
                </p>
              </div>
              
              <Button
                onClick={handleMerge}
                className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
              >
                <Film className="w-4 h-4 mr-2" />
                开始合成
              </Button>
            </>
          )}

          {status === 'error' && (
            <div className="flex gap-2 w-full">
              <Button variant="outline" onClick={handleClose} className="flex-1">
                关闭
              </Button>
              <Button onClick={handleMerge} className="flex-1">
                重试
              </Button>
            </div>
          )}
        </div>

        {/* 历史记录 */}
        {mergedVideos.length > 0 && (
          <div className="border-t pt-4 mt-2">
            <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              历史记录 ({mergedVideos.length})
            </h4>
            <ScrollArea className="h-40">
              <div className="space-y-2">
                {mergedVideos.map((video) => (
                  <div
                    key={video.id}
                    className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded-lg"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Video className="w-5 h-5 text-purple-500 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{video.projectName}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(video.createdAt)} · {video.videoCount} 个片段 · {formatFileSize(video.size)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDownload(video)}
                        title="下载"
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(video.id)}
                        title="删除"
                        className="text-red-500 hover:text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
