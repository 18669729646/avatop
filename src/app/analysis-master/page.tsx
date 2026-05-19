'use client';

import { useCallback, useEffect, useState } from 'react';
import { AppLayout } from '@/components/app-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { authFetch } from '@/lib/auth-context';
import { Loader2, Play, RefreshCw, Sparkles, Upload } from 'lucide-react';

const ANALYSIS_MAX_VIDEO_BYTES = 100 * 1024 * 1024;

interface AnalysisScene {
  id: string;
  order: number;
  duration: number;
  title: string;
  description: string;
  imagePrompt: string;
  videoPrompt: string;
  speechText?: string;
  sellingPoint?: string;
}

interface AnalysisResult {
  videoType: string;
  targetAudience: string;
  summary: string;
  scenes: AnalysisScene[];
}

interface AnalysisProject {
  id: string;
  name: string;
  sourceType: string;
  sourceUrl?: string;
  videoUrl?: string;
  videoDuration?: number;
  fileSize?: number;
  status: 'draft' | 'analyzing' | 'completed' | 'failed' | string;
  result?: AnalysisResult | null;
  error?: string | null;
  createdAt: string;
  updatedAt: string;
}

function formatSize(size?: number) {
  if (!size) return '未知大小';
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)}KB`;
  return `${(size / 1024 / 1024).toFixed(1)}MB`;
}

const statusLabels: Record<string, string> = {
  draft: '待分析',
  analyzing: '分析中',
  completed: '已完成',
  failed: '失败',
};

export default function AnalysisMasterPage() {
  const [projects, setProjects] = useState<AnalysisProject[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [projectName, setProjectName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [analyzingId, setAnalyzingId] = useState('');
  const [error, setError] = useState('');

  const selectedProject = projects.find(project => project.id === selectedId) || projects[0];

  const loadProjects = useCallback(async () => {
    const response = await authFetch('/api/analysis-master/projects');
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || '获取分析项目失败');
    const list = (data.data || []) as AnalysisProject[];
    setProjects(list);
    if (!selectedId && list.length > 0) {
      setSelectedId(list[0].id);
    }
  }, [selectedId]);

  useEffect(() => {
    loadProjects().catch(err => setError(err.message));
  }, [loadProjects]);

  useEffect(() => {
    if (!projects.some(project => project.status === 'analyzing')) return;

    const timer = window.setInterval(() => {
      loadProjects().catch(err => setError(err.message));
    }, 5000);

    return () => window.clearInterval(timer);
  }, [loadProjects, projects]);

  const createFromLink = async () => {
    if (!sourceUrl.trim()) {
      setError('请输入 TikTok/抖音视频链接');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await authFetch('/api/analysis-master/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceUrl: sourceUrl.trim(),
          name: projectName.trim() || '链接分析项目',
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '创建失败');
      setSourceUrl('');
      setProjectName('');
      await loadProjects();
      setSelectedId(data.data.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建失败');
    } finally {
      setLoading(false);
    }
  };

  const createFromUpload = async () => {
    if (!file) {
      setError('请选择视频文件');
      return;
    }
    if (file.size > ANALYSIS_MAX_VIDEO_BYTES) {
      setError('视频文件不能超过 100MB');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('name', projectName.trim() || file.name);
      const response = await authFetch('/api/analysis-master/projects', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '上传失败');
      setFile(null);
      setProjectName('');
      await loadProjects();
      setSelectedId(data.data.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : '上传失败');
    } finally {
      setLoading(false);
    }
  };

  const analyzeProject = async (id: string) => {
    setAnalyzingId(id);
    setError('');
    try {
      const response = await authFetch(`/api/analysis-master/analyze/${id}`, { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '分析失败');
      await loadProjects();
    } catch (err) {
      setError(err instanceof Error ? err.message : '分析失败');
      await loadProjects().catch(() => undefined);
    } finally {
      setAnalyzingId('');
    }
  };

  return (
    <AppLayout>
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="shrink-0 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="max-w-7xl mx-auto flex items-center justify-between px-4 sm:px-6 h-14">
            <div className="flex items-center gap-3">
              <Sparkles className="w-5 h-5 text-purple-500" />
              <h1 className="text-lg sm:text-xl font-semibold">分析大师</h1>
              <Badge variant="secondary">{projects.length} 个项目</Badge>
            </div>
            <Button variant="outline" size="sm" onClick={() => loadProjects()} disabled={loading}>
              <RefreshCw className="w-4 h-4 mr-1" />
              刷新
            </Button>
          </div>
        </header>

        <ScrollArea className="flex-1">
          <div className="max-w-7xl mx-auto p-4 sm:p-6 grid gap-4 lg:grid-cols-[360px_1fr]">
            <div className="space-y-4">
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">新建分析</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>项目名称</Label>
                    <Input value={projectName} onChange={event => setProjectName(event.target.value)} placeholder="可选" />
                  </div>
                  <div className="space-y-2">
                    <Label>视频链接</Label>
                    <Textarea value={sourceUrl} onChange={event => setSourceUrl(event.target.value)} placeholder="粘贴 TikTok/抖音公开视频链接" rows={3} />
                    <Button className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700" onClick={createFromLink} disabled={loading}>
                      {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
                      从链接导入
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <Label>或上传视频</Label>
                    <Input type="file" accept="video/*" onChange={event => setFile(event.target.files?.[0] || null)} />
                    <p className="text-xs text-muted-foreground">最大支持 100MB</p>
                    <Button variant="outline" className="w-full" onClick={createFromUpload} disabled={loading || !file}>
                      <Upload className="w-4 h-4 mr-2" />
                      上传并创建
                    </Button>
                  </div>
                  {error && <div className="text-sm text-destructive bg-destructive/10 rounded-md p-3">{error}</div>}
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">历史项目</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {projects.length === 0 ? (
                    <div className="text-sm text-muted-foreground py-6 text-center">暂无分析项目</div>
                  ) : projects.map(project => (
                    <button
                      key={project.id}
                      className={`w-full text-left rounded-lg border p-3 hover:bg-muted transition ${selectedProject?.id === project.id ? 'border-primary bg-muted/60' : ''}`}
                      onClick={() => setSelectedId(project.id)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-medium text-sm truncate">{project.name}</div>
                        <Badge variant={project.status === 'failed' ? 'destructive' : 'secondary'}>{statusLabels[project.status] || project.status}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">{project.sourceType} · {formatSize(project.fileSize)}</div>
                    </button>
                  ))}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4 min-w-0">
              {!selectedProject ? (
                <Card className="border-dashed shadow-sm">
                  <CardContent className="py-20 text-center text-muted-foreground">创建项目后开始分析</CardContent>
                </Card>
              ) : (
                <>
                  <Card className="shadow-sm">
                    <CardHeader className="space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div>
                          <CardTitle>{selectedProject.name}</CardTitle>
                          <div className="text-sm text-muted-foreground mt-1">{statusLabels[selectedProject.status] || selectedProject.status} · {formatSize(selectedProject.fileSize)}</div>
                        </div>
                        <Button className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700" onClick={() => analyzeProject(selectedProject.id)} disabled={analyzingId === selectedProject.id || selectedProject.status === 'analyzing'}>
                          {analyzingId === selectedProject.id ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                          开始分析
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {selectedProject.videoUrl && (
                        <video src={selectedProject.videoUrl} controls className="w-full max-h-[420px] rounded-lg bg-black" />
                      )}
                      {selectedProject.error && <div className="text-sm text-destructive bg-destructive/10 rounded-md p-3">{selectedProject.error}</div>}
                      {selectedProject.result && (
                        <div className="grid gap-3 sm:grid-cols-3">
                          <div className="rounded-lg border p-3">
                            <div className="text-xs text-muted-foreground mb-1">类型</div>
                            <div className="text-sm font-medium">{selectedProject.result.videoType || '未识别'}</div>
                          </div>
                          <div className="rounded-lg border p-3">
                            <div className="text-xs text-muted-foreground mb-1">目标人群</div>
                            <div className="text-sm font-medium">{selectedProject.result.targetAudience || '未识别'}</div>
                          </div>
                          <div className="rounded-lg border p-3">
                            <div className="text-xs text-muted-foreground mb-1">分镜数量</div>
                            <div className="text-sm font-medium">{selectedProject.result.scenes?.length || 0} 段</div>
                          </div>
                        </div>
                      )}
                      {selectedProject.result?.summary && (
                        <div className="rounded-lg border p-4">
                          <div className="font-medium mb-2">整体总结</div>
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{selectedProject.result.summary}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {selectedProject.result?.scenes?.map(scene => (
                    <Card key={scene.id} className="shadow-sm">
                      <CardHeader>
                        <CardTitle className="text-base">#{scene.order} {scene.title}</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3 text-sm">
                        <p className="text-muted-foreground">{scene.description}</p>
                        <div>
                          <div className="font-medium mb-1">图片提示词</div>
                          <div className="rounded-md bg-muted p-3 whitespace-pre-wrap">{scene.imagePrompt}</div>
                        </div>
                        <div>
                          <div className="font-medium mb-1">视频提示词</div>
                          <div className="rounded-md bg-muted p-3 whitespace-pre-wrap">{scene.videoPrompt}</div>
                        </div>
                        {(scene.speechText || scene.sellingPoint) && (
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div><span className="font-medium">口播：</span>{scene.speechText || '无'}</div>
                            <div><span className="font-medium">卖点：</span>{scene.sellingPoint || '无'}</div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </>
              )}
            </div>
          </div>
        </ScrollArea>
      </div>
    </AppLayout>
  );
}
