'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  ArrowLeft,
  ArrowRight,
  ChevronRight,
} from 'lucide-react';
import {
  ImageTask,
  ScriptSegment,
  generateId,
} from '@/lib/shortfilm';

interface Step2ScriptConfirmProps {
  scriptGenerationMode: 'ai' | 'manual';
  scriptRawResponse: string | null;
  scriptSegments: ScriptSegment[];
  onScriptSegmentsChange: (segments: ScriptSegment[]) => void;
  remakeMode: boolean;
  productImages: Array<{ key: string; url: string }>;
  productDescription: string;
  scriptPrompt: string;
  duration: number;
  imageTasks: ImageTask[];
  onGoBack: () => void;
  onConfirm: (tasks: ImageTask[]) => void;
}

export function Step2ScriptConfirm({
  scriptGenerationMode,
  scriptRawResponse,
  scriptSegments,
  onScriptSegmentsChange,
  remakeMode,
  productImages,
  productDescription,
  scriptPrompt,
  duration,
  imageTasks,
  onGoBack,
  onConfirm,
}: Step2ScriptConfirmProps) {
  const updateSegment = (segmentId: string, field: keyof ScriptSegment, value: string) => {
    const updated = scriptSegments.map((s) =>
      s.id === segmentId ? { ...s, [field]: value } : s
    );
    onScriptSegmentsChange(updated);
  };

  const handleGoBack = () => {
    onGoBack();
  };

  const handleConfirm = () => {
    let tasks: ImageTask[];

    if (imageTasks.length > 0) {
      tasks = imageTasks.map((task) => ({
        ...task,
        prompt:
          scriptSegments.find((s) => s.id === task.segmentId)?.imagePrompt ||
          task.prompt,
      }));
    } else {
      tasks = scriptSegments.map((seg) => ({
        id: generateId('img'),
        segmentId: seg.id,
        order: seg.order,
        prompt: seg.imagePrompt,
        status: 'pending' as const,
        referenceImages: [],
        characterImages: [],
        generatedImages: [],
        selectedImageId: '',
      }));
    }

    onConfirm(tasks);
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">确认脚本内容</h2>
        <p className="text-sm text-muted-foreground mb-4">
          {scriptGenerationMode === 'manual'
            ? '为每个段落输入图片和视频提示词'
            : '请检查并编辑每个段落的脚本内容'}
        </p>

        {scriptGenerationMode === 'ai' && scriptRawResponse && (
          <details className="mb-6 group">
            <summary className="cursor-pointer flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
              <ChevronRight className="w-4 h-4 text-muted-foreground transition-transform group-open:rotate-90" />
              <span className="text-sm font-medium">查看模型完整返回内容</span>
              <Badge variant="secondary" className="ml-2">
                {scriptRawResponse.length.toLocaleString()} 字符
              </Badge>
            </summary>
            <div className="mt-3 p-4 bg-slate-50 dark:bg-slate-900 rounded-lg border max-h-96 overflow-auto">
              <pre className="text-xs text-muted-foreground whitespace-pre-wrap break-words font-mono">
                {scriptRawResponse}
              </pre>
            </div>
          </details>
        )}

        <div className="space-y-4">
          {scriptSegments.map((segment) => (
            <div key={segment.id} className="p-4 border rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <Badge variant="outline" className="text-sm">
                  段落 {segment.order} ({segment.duration}秒)
                </Badge>
                {scriptGenerationMode === 'ai' && segment.description && (
                  <span className="text-sm text-muted-foreground truncate max-w-md">
                    {segment.description}
                  </span>
                )}
              </div>

              <div className="space-y-3">
                {scriptGenerationMode === 'ai' && (
                  <div>
                    <Label className="text-xs text-muted-foreground">段落描述</Label>
                    <Textarea
                      value={segment.description || ''}
                      onChange={(e) => updateSegment(segment.id, 'description', e.target.value)}
                      rows={2}
                      className="mt-1 text-sm"
                    />
                  </div>
                )}

                <div>
                  <Label htmlFor={`image-prompt-${segment.id}`} className="text-xs text-muted-foreground font-medium">
                    图片提示词
                  </Label>
                  <Textarea
                    id={`image-prompt-${segment.id}`}
                    value={segment.imagePrompt}
                    onChange={(e) => updateSegment(segment.id, 'imagePrompt', e.target.value)}
                    rows={3}
                    className="mt-1 text-sm"
                    placeholder="描述要生成的图片内容，例如：一位美女在办公室里工作，阳光从窗户照进来..."
                  />
                </div>

                <div>
                  <Label htmlFor={`video-prompt-${segment.id}`} className="text-xs text-muted-foreground font-medium">
                    视频提示词
                  </Label>
                  <Textarea
                    id={`video-prompt-${segment.id}`}
                    value={segment.videoPrompt}
                    onChange={(e) => updateSegment(segment.id, 'videoPrompt', e.target.value)}
                    rows={3}
                    className="mt-1 text-sm"
                    placeholder="描述视频的运动和效果，例如：人物微微转头，眼神看向镜头，轻柔地微笑..."
                  />
                </div>

                {remakeMode && (segment.shotType || segment.cameraMovement || segment.speechText || segment.audioPrompt || segment.backgroundMusic) && (
                  <div className="space-y-2 mt-2 p-3 bg-purple-50/50 dark:bg-purple-950/20 rounded-lg border border-purple-100 dark:border-purple-900/30">
                    <div className="text-xs font-medium text-purple-700 dark:text-purple-300 mb-1">复刻解析信息</div>
                    {(segment.startTime !== undefined || segment.endTime !== undefined) && (
                      <div className="text-xs text-muted-foreground">
                        时间段: {segment.startTime?.toFixed(1)}s - {segment.endTime?.toFixed(1)}s
                      </div>
                    )}
                    {segment.shotType && (
                      <div className="text-xs"><span className="text-muted-foreground">镜头类型: </span>{segment.shotType}</div>
                    )}
                    {segment.cameraMovement && (
                      <div className="text-xs"><span className="text-muted-foreground">运镜方式: </span>{segment.cameraMovement}</div>
                    )}
                    {segment.speechText && (
                      <div>
                        <Label className="text-xs text-muted-foreground">口播文本</Label>
                        <Textarea
                          value={segment.speechText}
                          onChange={(e) => updateSegment(segment.id, 'speechText', e.target.value)}
                          rows={2}
                          className="mt-1 text-sm"
                        />
                      </div>
                    )}
                    {segment.audioPrompt && (
                      <div>
                        <Label className="text-xs text-muted-foreground">音频提示</Label>
                        <Textarea
                          value={segment.audioPrompt}
                          onChange={(e) => updateSegment(segment.id, 'audioPrompt', e.target.value)}
                          rows={2}
                          className="mt-1 text-sm"
                        />
                      </div>
                    )}
                    {segment.backgroundMusic && (
                      <div className="text-xs"><span className="text-muted-foreground">背景音乐: </span>{segment.backgroundMusic}</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <Card className="mt-4 p-4 bg-slate-50 dark:bg-slate-900">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              共 {scriptSegments.length} 个段落，总时长 {scriptSegments.reduce((sum, s) => sum + s.duration, 0)} 秒
            </span>
            <Badge variant="secondary">
              {scriptSegments.filter((s) => s.imagePrompt && s.videoPrompt).length} / {scriptSegments.length} 已填写
            </Badge>
          </div>
        </Card>

        <div className="flex justify-between mt-6">
          <Button variant="outline" onClick={handleGoBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回修改
          </Button>
          <Button
            className="bg-gradient-to-r from-blue-500 to-purple-500"
            onClick={handleConfirm}
          >
            确认脚本，生成图片
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </Card>
    </div>
  );
}
