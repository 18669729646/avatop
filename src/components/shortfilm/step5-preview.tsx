'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  ArrowLeft,
  Check,
  Film,
  Image as ImageIcon,
  Video,
} from 'lucide-react';
import {
  ImageTask,
  MergedVideo,
  ShortFilmProject,
  VideoTask,
} from '@/lib/shortfilm';

interface Step5PreviewProps {
  project: ShortFilmProject | null;
  imageTasks: ImageTask[];
  videoTasks: VideoTask[];
  onGoBack: () => void;
  onGoToList: () => void;
  onPreviewImages: (images: { url: string; id: string }[], index: number) => void;
}

export function Step5Preview({
  project,
  imageTasks,
  videoTasks,
  onGoBack,
  onGoToList,
  onPreviewImages,
}: Step5PreviewProps) {
  const completedVideoTasks = videoTasks.filter(
    (t) => t.status === 'completed' && t.generatedVideos.length > 0
  );
  const completedImageTasks = imageTasks.filter(
    (t) => t.status === 'completed' && t.generatedImages.length > 0
  );

  const handleDownloadVideo = async (video: MergedVideo) => {
    try {
      const response = await fetch(video.url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `${project?.name || 'shortfilm'}_${video.createdAt}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('Download failed:', err);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-6 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-200 dark:border-green-800">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center">
            <Check className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-green-800 dark:text-green-200">短片创作完成！</h2>
            <p className="text-sm text-green-600 dark:text-green-400">您的短片已成功生成，可以预览和下载</p>
          </div>
        </div>
      </Card>

      {project?.mergedVideos && project.mergedVideos.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Film className="w-5 h-5 text-primary" />
            合成视频
          </h3>
          <div className="space-y-4">
            {project.mergedVideos.map((video) => (
              <div key={video.id} className="border rounded-lg overflow-hidden">
                <div className="aspect-video bg-black">
                  <video
                    src={video.url}
                    controls
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="p-3 bg-muted/50 flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    <span>时长: {video.duration}秒</span>
                    <span className="mx-2">•</span>
                    <span>大小: {(video.size / 1024 / 1024).toFixed(2)} MB</span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDownloadVideo(video)}
                  >
                    下载视频
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {completedVideoTasks.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Video className="w-5 h-5 text-primary" />
            视频片段
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {completedVideoTasks.map((task) => {
              const selectedVideo =
                task.generatedVideos.find((v) => v.id === task.selectedVideoId) ||
                task.generatedVideos[0];

              return (
                <div key={task.id} className="border rounded-lg overflow-hidden">
                  <div className="aspect-video bg-black">
                    <video
                      src={selectedVideo?.url}
                      controls
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div className="p-3 bg-muted/50">
                    <div className="flex items-center justify-between mb-1">
                      <Badge variant="outline">片段 {task.order}</Badge>
                      {task.generatedVideos.length > 1 && (
                        <span className="text-[10px] text-muted-foreground">
                          共 {task.generatedVideos.length} 个版本
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{task.prompt}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {completedImageTasks.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-primary" />
            生成的图片
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {completedImageTasks.map((task) => {
              const selectedImage =
                task.generatedImages.find((img) => img.id === task.selectedImageId) ||
                task.generatedImages[0];
              return (
                <div
                  key={task.id}
                  className="aspect-[9/16] rounded-lg overflow-hidden border cursor-pointer hover:ring-2 hover:ring-primary transition-all"
                  onClick={() => {
                    onPreviewImages(
                      task.generatedImages.map((img) => ({ url: img.url, id: img.id })),
                      task.generatedImages.findIndex((img) => img.id === selectedImage.id)
                    );
                  }}
                >
                  <img
                    src={selectedImage?.url}
                    alt={`图片 ${task.order}`}
                    loading="lazy"
                    className="w-full h-full object-cover"
                  />
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={onGoBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          返回视频编辑
        </Button>
        <Button
          className="bg-gradient-to-r from-purple-500 to-pink-500"
          onClick={onGoToList}
        >
          返回短片列表
        </Button>
      </div>
    </div>
  );
}
