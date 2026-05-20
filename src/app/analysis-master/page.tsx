'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AppLayout } from '@/components/app-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { authFetch, useAuth } from '@/lib/auth-context';
import { useTaskEvents } from '@/hooks/use-task-events';
import { Download, Loader2, Music, Play, RefreshCw, Sparkles, Upload, Copy, Trash2 } from 'lucide-react';
import { copyToClipboard } from '@/lib/prompt-templates';

const ANALYSIS_MAX_VIDEO_BYTES = 100 * 1024 * 1024;

const CHUNK_SIZE = 5 * 1024 * 1024;

interface UploadState {
  phase: 'idle' | 'uploading' | 'done' | 'error';
  uploadId?: string;
  projectId?: string;
  current?: number;
  total?: number;
  message?: string;
}

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
  imagePrompt: string;
  videoPrompt: string;
  dialogue_vo_original: string;
  dialogue_vo_zh: string;
  cta_a: string;
  cta_b: string;
  cta_c: string;
  cta_d: string;
}

interface AnalysisProject {
  id: string;
  name: string;
  sourceType: string;
  sourceUrl?: string;
  videoUrl?: string;
  videoDuration?: number;
  fileSize?: number;
  audioUrl?: string;
  audioDuration?: number;
  audioFileSize?: number;
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
  downloading: '下载中',
  draft: '待分析',
  analyzing: '分析中',
  failed: '分析失败',
  completed: '已完成',
};

export default function AnalysisMasterPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [projects, setProjects] = useState<AnalysisProject[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [previewData, setPreviewData] = useState<Record<string, unknown> | null>(null);
  const [previewProjectId, setPreviewProjectId] = useState<string>('');
  const [showPreview, setShowPreview] = useState(false);
  const isInitialLoadRef = useRef(true);
  const [sourceUrl, setSourceUrl] = useState('');
  const [projectName, setProjectName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [analyzingId, setAnalyzingId] = useState('');
  const [deletingId, setDeletingId] = useState('');
  const [uploadState, setUploadState] = useState<UploadState>({ phase: 'idle' });
  const [error, setError] = useState('');

  const selectedProject = projects.find(project => project.id === selectedId) || projects[0];

  const loadProjects = useCallback(async () => {
    const response = await authFetch('/api/analysis-master/projects');
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || '获取分析项目失败');
    const list = (data.data || []) as AnalysisProject[];
    setProjects(list);
    // 仅在首次加载时自动选中第一个项目，避免手动选择触发重新请求
    if (isInitialLoadRef.current && list.length > 0 && !selectedId) {
      setSelectedId(list[0].id);
      isInitialLoadRef.current = false;
    }
  }, [selectedId]);

  // 保持 ref 指向最新的 loadProjects，避免 effect 依赖变化时重建定时器
  const loadProjectsRef = useRef(loadProjects);
  loadProjectsRef.current = loadProjects;

  useEffect(() => {
    loadProjectsRef.current().catch(err => setError(err.message));
  }, []);

  // SSE 订阅：分析任务完成/失败时立即更新状态
  // 轮询仅作 SSE 断线兜底，降低频率避免页面抖动
  useTaskEvents((data) => {
    if (data.type !== 'analysis') return;
    const projectId = data.projectId;
    if (!projectId) return;
    if (data.status === 'success') {
      const r = data.result;
      setProjects(prev => prev.map(p =>
        p.id === projectId
          ? {
              ...p,
              name: r?.summary || p.name,
              status: 'completed',
              result: {
                summary: r?.summary || '',
                videoType: (r as Record<string, unknown>)?.videoType as string || '',
                targetAudience: (r as Record<string, unknown>)?.targetAudience as string || '',
                productDesc: (r as Record<string, unknown>)?.productDesc as string || '',
                sellingPoints: (r as Record<string, unknown>)?.sellingPoints as unknown[] || [],
                scenes: (r as Record<string, unknown>)?.scenes as unknown[] || [],
                imagePrompt: r?.imagePrompt || '',
                videoPrompt: r?.videoPrompt || '',
                dialogue_vo_original: r?.dialogue_vo_original || '',
                dialogue_vo_zh: r?.dialogue_vo_zh || '',
                cta_a: r?.cta_a || '',
                cta_b: r?.cta_b || '',
                cta_c: r?.cta_c || '',
                cta_d: r?.cta_d || '',
                raw: (r as Record<string, unknown>)?.raw as Record<string, unknown> || {},
              } as AnalysisResult,
              error: undefined,
            }
          : p
      ));
      setAnalyzingId(prev => prev === projectId ? '' : prev);
    } else if (data.status === 'failed') {
      setProjects(prev => prev.map(p =>
        p.id === projectId
          ? { ...p, status: 'failed', error: data.error }
          : p
      ));
      setAnalyzingId(prev => prev === projectId ? '' : prev);
      setError(data.error || '分析失败');
    }
  });

  const createFromLink = async () => {
    const url = sourceUrl.trim();
    if (!url) {
      setError('请输入 TikTok/抖音视频链接');
      console.log('[从链接导入] URL 为空，sourceUrl=', sourceUrl);
      return;
    }

    console.log('[从链接导入] 开始, url=', url);
    setLoading(true);
    setError('');
    try {
      const response = await authFetch('/api/analysis-master/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceUrl: url,
          name: projectName.trim() || '链接分析项目',
        }),
      });
      console.log('[从链接导入] 响应状态:', response.status);
      const data = await response.json();
      console.log('[从链接导入] 响应数据:', data);
      if (!response.ok) throw new Error(data.error || '创建失败');
      setSourceUrl('');
      setProjectName('');
      await loadProjects();
      setSelectedId(data.data.id);
      console.log('[从链接导入] 成功, projectId=', data.data.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '创建失败';
      console.error('[从链接导入] 失败:', msg);
      setError(msg);
    } finally {
      setLoading(false);
      console.log('[从链接导入] 结束, loading=false');
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
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
      setUploadState({ phase: 'uploading', current: 0, total: totalChunks });

      // 1. 初始化分片上传
      const initRes = await authFetch('/api/analysis-master/upload/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          fileSize: file.size,
          chunkSize: CHUNK_SIZE,
          totalChunks,
          name: projectName.trim() || file.name,
        }),
      });
      const initData = await initRes.json();
      if (!initRes.ok) throw new Error(initData.error || '初始化上传失败');
      const { uploadId, projectId, key: s3Key } = initData.data;

      // 2. 分片上传
      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunk = file.slice(start, end);

        const partRes = await authFetch(
          `/api/analysis-master/upload/upload?uploadId=${encodeURIComponent(initData.data.uploadId)}&chunkIndex=${i}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/octet-stream' },
            body: chunk,
          }
        );
        if (!partRes.ok) {
          const errData = await partRes.json().catch(() => ({ error: '未知错误' }));
          await authFetch('/api/analysis-master/upload/abort', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uploadId: initData.data.uploadId }),
          });
          throw new Error(`分片 ${i + 1}/${totalChunks} 上传失败: ${errData.error}`);
        }
        const partData = await partRes.json();
        setUploadState({ phase: 'uploading', current: i + 1, total: totalChunks });
      }

      // 3. 完成上传
      const completeRes = await authFetch('/api/analysis-master/upload/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uploadId, projectId, key: s3Key, name: projectName.trim() || file.name }),
      });
      const completeData = await completeRes.json();
      if (!completeRes.ok) throw new Error(completeData.error || '完成上传失败');

      setUploadState({ phase: 'done' });
      setFile(null);
      setProjectName('');
      await loadProjects();
      setSelectedId(projectId);
      setTimeout(() => setUploadState({ phase: 'idle' }), 2000);
    } catch (err) {
      setUploadState({ phase: 'error', message: err instanceof Error ? err.message : '上传失败' });
      setError(err instanceof Error ? err.message : '上传失败');
    } finally {
      setLoading(false);
    }
  };

  const analyzeProject = async (id: string) => {
    setAnalyzingId(id);
    setError('');
    try {
      if (isAdmin) {
        // 管理员：先预览请求体，确认后发送
        setPreviewProjectId(id);
        const res = await authFetch(`/api/analysis-master/analyze/${id}/preview`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '预览失败');
        setPreviewData(data.data || data);
        setShowPreview(true);
        setAnalyzingId('');
        return;
      }
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

  const confirmAnalyze = async () => {
    const id = previewProjectId;
    setShowPreview(false);
    setPreviewData(null);
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

  const handleDeleteProject = async (id: string) => {
    if (!confirm('确定要删除该项目吗？删除后不可恢复。')) return;
    setDeletingId(id);
    try {
      const response = await authFetch(`/api/analysis-master/projects/${id}`, { method: 'DELETE' });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '删除失败');
      }
      setProjects(prev => {
        const filtered = prev.filter(p => p.id !== id);
        if (selectedId === id) {
          setSelectedId(filtered[0]?.id || '');
        }
        return filtered;
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : '删除失败');
    } finally {
      setDeletingId('');
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
          <div className="max-w-7xl mx-auto p-4 sm:p-6 flex gap-6">
            <div className="w-80 shrink-0 space-y-4">
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
                    <Input type="file" accept="video/*" onChange={event => setFile(event.target.files?.[0] || null)} disabled={uploadState.phase === 'uploading'} />
                    <p className="text-xs text-muted-foreground">最大支持 100MB</p>
                    {uploadState.phase === 'uploading' ? (
                      <div className="space-y-2">
                        <Progress value={uploadState.total ? Math.round(((uploadState.current ?? 0) / uploadState.total) * 100) : 0} />
                        <p className="text-xs text-muted-foreground text-center">
                          正在上传 {uploadState.current ?? 0}/{uploadState.total} 分片 · {uploadState.total ? Math.round(((uploadState.current ?? 0) / uploadState.total) * 100) : 0}%
                        </p>
                      </div>
                    ) : (
                      <Button variant="outline" className="w-full" onClick={createFromUpload} disabled={loading || !file}>
                        <Upload className="w-4 h-4 mr-2" />
                        上传并创建
                      </Button>
                    )}
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
                    <div key={project.id} className={`group relative rounded-lg border p-3 hover:bg-muted transition cursor-pointer ${selectedProject?.id === project.id ? 'border-primary bg-muted/60' : ''}`} onClick={() => setSelectedId(project.id)}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="text-sm font-medium truncate flex-1 min-w-0">{project.name}</div>
                            <Badge variant={project.status === 'completed' ? 'default' : project.status === 'downloading' ? 'default' : project.status === 'failed' ? 'destructive' : 'secondary'} className={`shrink-0 ${project.status === 'completed' ? 'bg-emerald-500/20 text-emerald-600 border-emerald-500/30' : ''}`}>{statusLabels[project.status] || project.status}</Badge>
                          </div>
                        <div className="text-xs text-muted-foreground mt-1">{project.sourceType} · {formatSize(project.fileSize)}</div>
                      {project.sourceUrl && (
                        <a
                          href={project.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary/70 hover:text-primary hover:underline truncate block mt-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {project.sourceUrl}
                        </a>
                      )}
                      <div className="flex items-center justify-end gap-2 mt-2">
                        <span className="text-[11px] text-muted-foreground/50">
                          {new Date(project.createdAt).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <button
                          className="p-1.5 rounded-md text-muted-foreground/50 hover:text-destructive transition"
                          onClick={(e) => { e.stopPropagation(); handleDeleteProject(project.id); }}
                          disabled={deletingId === project.id}
                          title="删除项目"
                        >
                          {deletingId === project.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            <div className="flex-1 space-y-4 min-w-0">
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
                        <Button
                          className={selectedProject.status === 'failed' ? 'bg-red-600 hover:bg-red-700' : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700'}
                          onClick={() => analyzeProject(selectedProject.id)}
                          disabled={analyzingId === selectedProject.id || selectedProject.status === 'analyzing'}
                        >
                          {analyzingId === selectedProject.id || selectedProject.status === 'analyzing' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                          {selectedProject.status === 'failed' ? '重新分析' : '开始分析'}
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {selectedProject.videoUrl && (
                        <video src={selectedProject.videoUrl} controls className="w-full max-h-[420px] rounded-lg bg-black" />
                      )}
                      {selectedProject.audioUrl && (
                        <div className="rounded-lg border">
                          <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/50 rounded-t-lg">
                            <Music className="w-4 h-4 text-muted-foreground" />
                            <span className="text-xs font-medium">音频 <span className="text-muted-foreground">({Math.floor((selectedProject.audioDuration || 0) / 60)}:{String((selectedProject.audioDuration || 0) % 60).padStart(2, '0')})</span></span>
                          </div>
                          <div className="px-3 py-2">
                            <audio controls className="w-full h-8"><source src={selectedProject.audioUrl} type="audio/mpeg" /></audio>
                          </div>
                        </div>
                      )}
                      {selectedProject.error && <div className="text-sm text-destructive bg-destructive/10 rounded-md p-3">{selectedProject.error}</div>}
                      {selectedProject.result && (
                        <>
                          <div className="space-y-2">
                            {[
                              { label: '画面提示词', value: selectedProject.result.imagePrompt },
                              { label: '视频提示词', value: selectedProject.result.videoPrompt },
                              { label: '台词原文', value: selectedProject.result.dialogue_vo_original },
                              { label: '台词中文', value: selectedProject.result.dialogue_vo_zh },
                              {
                                label: 'CTA',
                                value: [selectedProject.result.cta_a, selectedProject.result.cta_b, selectedProject.result.cta_c, selectedProject.result.cta_d].filter(Boolean).join(' / ')
                              },
                            ].map(({ label, value }) => value ? (
                              <div key={label} className="rounded-lg border bg-muted/50">
                                <div className="flex items-center justify-between px-3 py-2 border-b bg-muted rounded-t-lg">
                                  <span className="text-xs font-medium text-muted-foreground">{label}</span>
                                  <button
                                    onClick={() => copyToClipboard(value)}
                                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition"
                                    title="复制"
                                  >
                                    <Copy className="w-3 h-3" />
                                    复制
                                  </button>
                                </div>
                                <div className="p-3 text-sm whitespace-pre-wrap">{value}</div>
                              </div>
                            ) : null)}
                          </div>
                        </>
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

        {/* 管理员分析预览弹窗 */}
        <Dialog open={showPreview} onOpenChange={setShowPreview}>
          <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>管理员预览 - 确认分析请求</DialogTitle>
            </DialogHeader>
            <ScrollArea className="flex-1 space-y-4">
              {previewData && (
                <>
                  {previewData.projectName && (
                    <div>
                      <div className="text-xs font-medium text-muted-foreground mb-1">项目名称</div>
                      <div className="text-sm bg-muted p-2 rounded">{String(previewData.projectName)}</div>
                    </div>
                  )}
                  {previewData.originalSize && previewData.compressedSize && (
                    <div className="flex gap-4 text-xs text-muted-foreground">
                      <span>原始大小：{(Number(previewData.originalSize) / 1024 / 1024).toFixed(1)} MB</span>
                      <span>→ 压缩后：{(Number(previewData.compressedSize) / 1024 / 1024).toFixed(1)} MB</span>
                    </div>
                  )}
                  {previewData.prompt && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-muted-foreground">完整提示词</span>
                        <button
                          onClick={() => copyToClipboard(String(previewData.prompt))}
                          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition"
                        >
                          <Copy className="w-3 h-3" /> 复制
                        </button>
                      </div>
                      <pre className="text-xs bg-muted p-3 rounded-lg whitespace-pre-wrap break-all max-h-60 overflow-auto">
                        {String(previewData.prompt)}
                      </pre>
                    </div>
                  )}
                  {previewData.requestBody && (
                    <div>
                      <div className="text-xs font-medium text-muted-foreground mb-1">Gemini 请求体结构</div>
                      <pre className="text-xs bg-muted p-3 rounded-lg whitespace-pre-wrap break-all max-h-60 overflow-auto">
                        {(() => {
                          const body = previewData.requestBody as Record<string, unknown>;
                          // 隐藏 base64 数据，只显示结构
                          const clean = JSON.parse(JSON.stringify(body));
                          if (clean.contents?.[0]?.parts?.[1]?.inlineData) {
                            const sz = clean.contents[0].parts[1].inlineData.data?.length || 0;
                            clean.contents[0].parts[1].inlineData = `[视频数据 base64, ${(sz / 1024 / 1024).toFixed(1)} MB]`;
                          }
                          return JSON.stringify(clean, null, 2);
                        })()}
                      </pre>
                    </div>
                  )}
                  {!previewData.prompt && !previewData.requestBody && (
                    <pre className="text-xs bg-muted p-4 rounded-lg overflow-auto whitespace-pre-wrap break-all">
                      {JSON.stringify(previewData, null, 2)}
                    </pre>
                  )}
                </>
              )}
            </ScrollArea>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => { setShowPreview(false); setPreviewData(null); }}>
                取消
              </Button>
              <Button onClick={confirmAnalyze} disabled={!!analyzingId}>
                {analyzingId ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                确认执行分析
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
