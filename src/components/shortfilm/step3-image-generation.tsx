'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  ArrowLeft,
  ArrowRight,
  Image as ImageIcon,
  Loader2,
  User,
  X,
  AlertCircle,
  Plus,
  Check,
  ZoomIn,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  ImageTask,
  ScriptSegment,
  VideoTask,
} from '@/lib/shortfilm';
import { CharacterItem } from '@/lib/history';
import { ImageApiConfig, VideoApiConfig } from '@/lib/system-config';
import { ModelSelector } from '@/components/model-selector';

interface Step3ImageGenerationProps {
  selectedImageModelId: string;
  onSelectedImageModelIdChange: (id: string) => void;
  selectedImageModelConfig: ImageApiConfig | null;
  onSelectedImageModelConfigChange: (config: ImageApiConfig) => void;
  productImages: Array<{ key: string; url: string }>;
  productDescription: string;
  selectedCharacters: CharacterItem[];
  onSelectedCharactersChange: (characters: CharacterItem[]) => void;
  onShowCharacterLibrary: () => void;
  imageTasks: ImageTask[];
  onImageTasksChange: (tasks: ImageTask[]) => void;
  failedImageUrls: Set<string>;
  onFailedImageUrlsChange: (urls: Set<string>) => void;
  onShowReferenceDialog: (taskId: string, references: string[]) => void;
  onPreviewImages: (images: { url: string; id: string }[], index: number) => void;
  onImageGenerate: (taskId: string, prompt: string, referenceImages: string[], model: string, baseUrl: string) => void;
  storageWarning: string | null;
  scriptSegments: ScriptSegment[];
  videoTasks: VideoTask[];
  onVideoTasksChange: (tasks: VideoTask[]) => void;
  videoTasksRef: React.MutableRefObject<VideoTask[]>;
  selectedVideoModelConfig: VideoApiConfig | null;
  onGoBack: () => void;
  onConfirm: () => void;
}

export function Step3ImageGeneration({
  selectedImageModelId,
  onSelectedImageModelIdChange,
  selectedImageModelConfig,
  onSelectedImageModelConfigChange,
  productImages,
  productDescription,
  selectedCharacters,
  onSelectedCharactersChange,
  onShowCharacterLibrary,
  imageTasks,
  onImageTasksChange,
  failedImageUrls,
  onFailedImageUrlsChange,
  onShowReferenceDialog,
  onPreviewImages,
  onImageGenerate,
  storageWarning,
  scriptSegments,
  videoTasks,
  onVideoTasksChange,
  videoTasksRef,
  selectedVideoModelConfig,
  onGoBack,
  onConfirm,
}: Step3ImageGenerationProps) {
  const firstTask = imageTasks[0];
  const firstSelectedImage = firstTask?.generatedImages.find((img) => img.id === firstTask.selectedImageId);

  const getDisplayReferenceImages = (task: ImageTask, isFirstTask: boolean) => {
    const hasGeneratedImages = task.generatedImages.length > 0;
    const defaultReferenceImage = !isFirstTask && firstSelectedImage ? firstSelectedImage.url : null;

    if (hasGeneratedImages) {
      return task.referenceImages || [];
    }

    if (task.referenceImages && task.referenceImages.length > 0) {
      return task.referenceImages;
    }

    return [
      ...productImages.map((img) => img.url),
      ...selectedCharacters.map((c) => c.url),
      ...(defaultReferenceImage ? [defaultReferenceImage] : []),
    ].filter((url, index, self) => self.indexOf(url) === index);
  };

  const handleGenerateClick = (task: ImageTask, displayReferenceImages: string[]) => {
    if (!selectedImageModelConfig?.apiKeyMasked) {
      return;
    }

    onImageGenerate(
      task.id,
      task.prompt,
      displayReferenceImages,
      selectedImageModelConfig.model || '',
      selectedImageModelConfig.baseUrl || ''
    );
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">生成段落图片</h2>
        <p className="text-sm text-muted-foreground mb-4">
          为每个段落生成图片。第一张图片需要先生成，后续图片会自动参考第一张图片以保持风格一致性。
        </p>

        <div className="mb-4 flex items-center gap-3">
          <Label className="flex-shrink-0">图片生成模型</Label>
          <ModelSelector
            type="image"
            value={selectedImageModelId}
            onChange={(id, config) => {
              onSelectedImageModelIdChange(id);
              onSelectedImageModelConfigChange(config as ImageApiConfig);
            }}
            placeholder="选择图片模型"
            className="flex-1 max-w-xs"
          />
        </div>

        {(productImages.length > 0 || productDescription) && (
          <div className="mb-4 p-3 border rounded-lg bg-green-50/50 dark:bg-green-950/20">
            <div className="flex items-center gap-2 mb-2">
              <ImageIcon className="w-4 h-4 text-green-500" />
              <span className="text-sm font-medium">产品信息</span>
            </div>
            {productImages.length > 0 && (
              <div className="flex gap-2 mb-2 flex-wrap">
                {productImages.map((img, idx) => (
                  <div key={idx} className="w-16 h-16 rounded-lg overflow-hidden border bg-muted">
                    <img src={img.url} alt={`产品图${idx + 1}`} loading="lazy" className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            )}
            {productDescription && (
              <p className="text-sm text-muted-foreground line-clamp-3">{productDescription}</p>
            )}
          </div>
        )}

        <div className="mb-4 p-3 border rounded-lg bg-blue-50/50 dark:bg-blue-950/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-blue-500" />
              <span className="text-sm font-medium">达人参考图</span>
              {selectedCharacters.length > 0 && (
                <Badge variant="default" className="text-xs bg-blue-500">
                  {selectedCharacters.length} 张
                </Badge>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={onShowCharacterLibrary}
            >
              {selectedCharacters.length > 0 ? '修改' : '选择'}达人图
            </Button>
          </div>
          {selectedCharacters.length > 0 && (
            <div className="flex gap-2 mt-2">
              {selectedCharacters.map((char) => (
                <div key={char.id} className="relative w-16 h-16 rounded-lg overflow-hidden border">
                  <img src={char.url} alt={char.name} loading="lazy" className="w-full h-full object-cover" />
                  <button
                    onClick={() => onSelectedCharactersChange(selectedCharacters.filter((c) => c.id !== char.id))}
                    className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          {imageTasks.map((task) => {
            const isFirstTask = task.order === 1;
            const canGenerate = isFirstTask || firstTask?.status === 'completed';
            const displayReferenceImages = getDisplayReferenceImages(task, isFirstTask);
            const hasGeneratedImages = task.generatedImages.length > 0;

            return (
              <div key={task.id} className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Badge>{isFirstTask ? '首张' : `段落 ${task.order}`}</Badge>
                    {!isFirstTask && !canGenerate && (
                      <Badge variant="destructive" className="text-xs">
                        等待首张图片
                      </Badge>
                    )}
                  </div>
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
                        <p className="font-medium mb-1">图片生成失败</p>
                        {task.error && <p className="text-xs whitespace-pre-wrap">{task.error}</p>}
                      </div>
                    </div>
                  </div>
                )}

                <div className="mb-3">
                  <Label className="text-xs text-muted-foreground">图片提示词</Label>
                  <Textarea
                    value={task.prompt}
                    onChange={(e) => {
                      onImageTasksChange(
                        imageTasks.map((t) => (t.id === task.id ? { ...t, prompt: e.target.value } : t))
                      );
                    }}
                    rows={2}
                    className="mt-1 text-sm"
                  />
                </div>

                <div className="mb-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground">
                        参考图 {displayReferenceImages.length > 0 && `(${displayReferenceImages.length})`}
                      </Label>
                      {hasGeneratedImages && displayReferenceImages.length > 0 && (
                        <Badge variant="outline" className="text-[10px] px-1.5 h-4">
                          生成时使用
                        </Badge>
                      )}
                      {task.isReferenceManuallySet && !hasGeneratedImages && (
                        <Badge variant="outline" className="text-[10px] px-1.5 h-4">
                          手动选择
                        </Badge>
                      )}
                      {!task.isReferenceManuallySet && !hasGeneratedImages && displayReferenceImages.length > 0 && firstSelectedImage && !isFirstTask && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 h-4 bg-green-50 text-green-600 dark:bg-green-950/50 dark:text-green-400">
                          来自首张
                        </Badge>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1 border-blue-200 text-blue-600 hover:bg-blue-50 hover:text-blue-700 dark:border-blue-800 dark:text-blue-400 dark:hover:bg-blue-950/50"
                      onClick={() => onShowReferenceDialog(task.id, displayReferenceImages)}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      添加参考图
                    </Button>
                  </div>
                  {displayReferenceImages.length > 0 ? (
                    <div className="flex gap-2 flex-wrap">
                      {displayReferenceImages.map((url, idx) => {
                        const isProductImage = productImages.some((img) => img.url === url);
                        const isCharacterImage = selectedCharacters.some((c) => c.url === url);
                        const isDefaultFirstImage = !isFirstTask && firstSelectedImage?.url === url;

                        return (
                          <div
                            key={idx}
                            className="relative w-16 h-16 rounded-lg overflow-hidden border group cursor-pointer"
                            onClick={() => onPreviewImages([{ url, id: `ref-${idx}` }], 0)}
                          >
                            <img src={url} alt="参考图" loading="lazy" className="w-full h-full object-cover" />
                            {isProductImage && (
                              <div className="absolute bottom-0 left-0 right-0 bg-blue-500/80 text-white text-[8px] py-0.5 text-center">产品</div>
                            )}
                            {isCharacterImage && (
                              <div className="absolute bottom-0 left-0 right-0 bg-purple-500/80 text-white text-[8px] py-0.5 text-center">达人</div>
                            )}
                            {isDefaultFirstImage && (
                              <div className="absolute bottom-0 left-0 right-0 bg-green-500/80 text-white text-[8px] py-0.5 text-center">首张</div>
                            )}
                            <button
                              className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={(e) => {
                                e.stopPropagation();
                                const newReferenceImages = displayReferenceImages.filter((_, i) => i !== idx);
                                onImageTasksChange(
                                  imageTasks.map((t) =>
                                    t.id === task.id
                                      ? { ...t, referenceImages: newReferenceImages, isReferenceManuallySet: true }
                                      : t
                                  )
                                );
                              }}
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground">点击上方按钮添加参考图</div>
                  )}
                </div>

                {task.generatedImages.length > 0 && (
                  <div className="mb-3">
                    <Label className="text-xs text-muted-foreground mb-2 block">生成结果</Label>
                    <div className="grid grid-cols-4 gap-2">
                      {task.generatedImages.map((img, imgIndex) => {
                        const isFailed = failedImageUrls.has(img.url);

                        return (
                          <div
                            key={img.id}
                            className={cn(
                              'relative aspect-[9/16] rounded-lg overflow-hidden cursor-pointer border-2 transition-all group bg-muted',
                              task.selectedImageId === img.id ? 'border-primary' : 'border-transparent hover:border-slate-300',
                              isFailed && 'border-red-300'
                            )}
                            onClick={() => {
                              if (isFailed) return;
                              onImageTasksChange(
                                imageTasks.map((t) => (t.id === task.id ? { ...t, selectedImageId: img.id } : t))
                              );
                            }}
                          >
                            {isFailed ? (
                              <div className="w-full h-full flex flex-col items-center justify-center bg-red-50 dark:bg-red-950/20 text-red-500 p-1">
                                <AlertCircle className="w-5 h-5 mb-1" />
                                <span className="text-[10px] text-center">加载失败</span>
                                <button
                                  className="text-[10px] underline mt-1 hover:text-red-700"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const newSet = new Set(failedImageUrls);
                                    newSet.delete(img.url);
                                    onFailedImageUrlsChange(newSet);
                                  }}
                                >
                                  重试
                                </button>
                              </div>
                            ) : (
                              <img
                                src={img.url}
                                alt=""
                                loading="lazy"
                                className="w-full h-full object-contain"
                                onError={() => {
                                  console.warn('[图片加载] 失败:', img.url.substring(0, 100));
                                  onFailedImageUrlsChange(new Set(failedImageUrls).add(img.url));
                                }}
                              />
                            )}
                            {task.selectedImageId === img.id && !isFailed && (
                              <div className="absolute top-1 left-1 bg-primary text-white rounded-full p-0.5">
                                <Check className="w-3 h-3" />
                              </div>
                            )}
                            {!isFailed && (
                              <button
                                className="absolute top-1 right-1 bg-black/60 hover:bg-black/80 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onPreviewImages(
                                    task.generatedImages.map((i) => ({ url: i.url, id: i.id })),
                                    imgIndex
                                  );
                                }}
                              >
                                <ZoomIn className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <Button
                  size="sm"
                  className="w-full"
                  variant={task.status === 'completed' ? 'outline' : 'default'}
                  disabled={task.status === 'generating' || !canGenerate}
                  onClick={() => handleGenerateClick(task, displayReferenceImages)}
                >
                  {task.status === 'generating' ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                      生成中...
                    </>
                  ) : task.status === 'completed' ? (
                    <>
                      <ImageIcon className="w-4 h-4 mr-1" />
                      重新生成
                    </>
                  ) : task.status === 'failed' ? (
                    <>
                      <ImageIcon className="w-4 h-4 mr-1" />
                      重试
                    </>
                  ) : !canGenerate ? (
                    <>
                      <ImageIcon className="w-4 h-4 mr-1" />
                      等待首张图片
                    </>
                  ) : (
                    <>
                      <ImageIcon className="w-4 h-4 mr-1" />
                      生成图片
                    </>
                  )}
                </Button>
              </div>
            );
          })}
        </div>

        <div className="flex justify-between mt-6">
          <Button variant="outline" onClick={onGoBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回修改脚本
          </Button>
          <Button
            className="bg-gradient-to-r from-blue-500 to-purple-500"
            disabled={!imageTasks.every((t) => t.status === 'completed')}
            onClick={onConfirm}
          >
            全部图片已生成，生成视频
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </Card>
    </div>
  );
}
