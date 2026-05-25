'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
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
import { authFetch, getAuthToken, useAuth } from '@/lib/auth-context';
import { useTaskEvents } from '@/hooks/use-task-events';
import { Download, FileSpreadsheet, Loader2, Music, Play, RefreshCw, Sparkles, Upload, Copy, Trash2 } from 'lucide-react';
import { copyToClipboard } from '@/lib/prompt-templates';
import { useTaskQueue } from '@/lib/swr';
import { useAnalysisMasterProjects } from '@/lib/swr';
import {
  createAnalysisMasterDraftProject,
  loadAnalysisMasterDraftProjects,
  mergeAnalysisMasterProjects,
  saveAnalysisMasterDraftProjects,
  type AnalysisMasterDraftProject,
} from '@/lib/analysis-master-drafts';
import { ScriptRemakePanel } from '@/components/script-remake-panel';
import { ScriptRemakeDetailModal } from '@/components/script-remake-detail-modal';
import {
  ANALYSIS_LOCAL_HELPER_CHUNK_SIZE,
  ANALYSIS_LOCAL_HELPER_URL,
  buildAnalysisLocalHelperRequest,
} from '@/lib/analysis-master-local-helper';

const ANALYSIS_MAX_VIDEO_BYTES = 100 * 1024 * 1024;
const ANALYSIS_HELPER_DOWNLOAD_URL = '/analysis-helper/analysis-download-helper-0.1.4.zip';

const CHUNK_SIZE = 5 * 1024 * 1024;
const PROJECT_PAGE_SIZE = 12;

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
  dialogueVoOriginal?: string;
  dialogueVoZh?: string;
  ctaA?: string;
  ctaB?: string;
  ctaC?: string;
  ctaD?: string;
  actionScheduling?: string;
  productDesc?: string;
  mustShow?: string;
  onScreenTextGraphics?: string;
  cameraShotSize?: string;
  cameraAngle?: string;
  cameraMovement?: string;
  compositionNotes?: string;
  lightingAtmosphere?: string;
  colorGrading?: string;
  languageStyle?: string;
  emphasisNotes?: string;
  audioBgm?: string;
  audioSfx?: string;
  ambientSound?: string;
  editingTransition?: string;
  pacingNotes?: string;
  filmingConstraints?: string;
  constraintsCompliance?: string;
  reverseConstraints?: string;
  assetsNeeded?: string;
  sentenceMapping?: string;
  mappingNotes?: string;
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
  /** 产品描述，SSE 映射来源 */
  productDesc?: string;
  /** 卖点列表，SSE 映射来源 */
  sellingPoints?: unknown[];
  /** 原始分析数据，用于 Excel 导出列映射 */
  raw?: Record<string, unknown>;
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
  importMetadata?: Record<string, string>;
  clientRequestId?: string;
  optimisticStatus?: 'creating' | 'failed';
  optimisticError?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ScriptRemakeStatus {
  id: string;
  status: string;
  title: string;
  created_at: string;
}

interface BatchImportSummary {
  batchId: string;
  taskId: string;
  sourceFileName?: string;
  total: number;
  limit: number;
  status: string;
  createdRows?: number;
  failedRows?: number;
  failedItems?: Array<{
    sourceUrl: string;
    error: string;
  }>;
  error?: string;
}

function formatSize(size?: number) {
  if (!size) return '未知大小';
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)}KB`;
  return `${(size / 1024 / 1024).toFixed(1)}MB`;
}

function createClientRequestId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `amreq-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

const statusLabels: Record<string, string> = {
  downloading: '下载中',
  draft: '待分析',
  analyzing: '分析中',
  failed: '分析失败',
  completed: '已完成',
};

function getProjectStatusLabel(project: AnalysisProject): string {
  if (project.optimisticStatus === 'creating') {
    return '创建中';
  }
  if (project.optimisticStatus === 'failed') {
    return '创建失败';
  }
  return statusLabels[project.status] || project.status;
}

function getProjectBadgeVariant(project: AnalysisProject): 'default' | 'destructive' | 'secondary' {
  if (project.optimisticStatus === 'failed' || project.status === 'failed') {
    return 'destructive';
  }
  if (project.optimisticStatus === 'creating') {
    return 'secondary';
  }
  if (project.status === 'completed') {
    return 'default';
  }
  return 'secondary';
}

const batchStatusLabels: Record<string, string> = {
  queued: '已入队',
  pending: '排队中',
  running: '处理中',
  progress: '处理中',
  retrying: '重试中',
  success: '已完成',
  failed: '失败',
};

function sceneDetailFields(scene: AnalysisScene) {
  return [
    ['台词原文', scene.dialogueVoOriginal],
    ['台词中文', scene.dialogueVoZh],
    ['钩子', scene.ctaA],
    ['痛点场景', scene.ctaB],
    ['卖点提炼', scene.ctaC],
    ['转化 CTA', scene.ctaD],
    ['动作调度', scene.actionScheduling],
    ['产品描述', scene.productDesc],
    ['必须展示', scene.mustShow],
    ['屏幕文字', scene.onScreenTextGraphics],
    ['景别', scene.cameraShotSize],
    ['机位角度', scene.cameraAngle],
    ['镜头运动', scene.cameraMovement],
    ['构图', scene.compositionNotes],
    ['灯光氛围', scene.lightingAtmosphere],
    ['色调', scene.colorGrading],
    ['语言风格', scene.languageStyle],
    ['强调备注', scene.emphasisNotes],
    ['背景音乐', scene.audioBgm],
    ['音效', scene.audioSfx],
    ['环境音', scene.ambientSound],
    ['转场', scene.editingTransition],
    ['节奏', scene.pacingNotes],
    ['拍摄限制', scene.filmingConstraints],
    ['合规性', scene.constraintsCompliance],
    ['反向限制', scene.reverseConstraints],
    ['素材需求', scene.assetsNeeded],
    ['句子映射', scene.sentenceMapping],
    ['映射备注', scene.mappingNotes],
  ].filter(([, value]) => value);
}

// 详情面板：仅在选中项目相关数据变化时重渲染
interface ProjectPanelProps {
  selectedProject?: AnalysisProject;
  selectedProjectIsOptimistic: boolean;
  analyzingId: string;
  exporting: boolean;
  isAdmin: boolean;
  analyzeProject: (id: string) => Promise<void>;
  exportProjects: (ids?: string[]) => Promise<void>;
}

const ProjectPanel = React.memo<ProjectPanelProps>(({
  selectedProject,
  selectedProjectIsOptimistic,
  analyzingId,
  exporting,
  isAdmin,
  analyzeProject,
  exportProjects,
}) => {
  if (!selectedProject) {
    return (
      <div className="flex-1 space-y-4 min-w-0">
        <Card className="border-dashed shadow-sm">
          <CardContent className="py-20 text-center text-muted-foreground">创建项目后开始分析</CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-4 min-w-0">
      <Card className="shadow-sm">
        <CardHeader className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle>{selectedProject.name}</CardTitle>
              <div className="text-sm text-muted-foreground mt-1">{getProjectStatusLabel(selectedProject)} · {formatSize(selectedProject.fileSize)}</div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={() => exportProjects([selectedProject.id])} disabled={exporting || !selectedProject.result || selectedProjectIsOptimistic}>
                {exporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                导出结果
              </Button>
              <Button
                className={selectedProject.status === 'failed' ? 'bg-red-600 hover:bg-red-700' : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700'}
                onClick={() => analyzeProject(selectedProject.id)}
                disabled={selectedProjectIsOptimistic || analyzingId === selectedProject.id || selectedProject.status === 'analyzing'}
              >
                {analyzingId === selectedProject.id || selectedProject.status === 'analyzing' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                {selectedProject.status === 'failed' ? '重新分析' : '开始分析'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {selectedProject.videoUrl && (
            <video key={selectedProject.id + '-video'} src={selectedProject.videoUrl} controls className="w-full max-h-[420px] rounded-lg bg-black" />
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
          {selectedProject.optimisticStatus === 'creating' && (
            <div className="text-sm text-muted-foreground bg-muted/50 rounded-md p-3">
              正在创建项目，完成后会自动进入历史项目列表。
            </div>
          )}
          {selectedProject.optimisticStatus === 'failed' && (
            <div className="text-sm text-destructive bg-destructive/10 rounded-md p-3">
              创建失败，项目已保留在本地列表中，刷新后仍会显示。
            </div>
          )}
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
            {sceneDetailFields(scene).length > 0 && (
              <div className="rounded-md border">
                <div className="border-b px-3 py-2 font-medium">分镜细节</div>
                <div className="grid gap-0 sm:grid-cols-2">
                  {sceneDetailFields(scene).map(([label, value]) => (
                    <div key={label} className="border-b px-3 py-2 last:border-b-0 sm:odd:border-r">
                      <div className="text-xs text-muted-foreground mb-1">{label}</div>
                      <div className="whitespace-pre-wrap">{value}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      <ScriptRemakePanel selectedProject={selectedProject} isAdmin={isAdmin} />
    </div>
  );
}, (prev, next) => {
  // 仅当选中项目 ID 变化、或关键业务数据（status/result/error/optimisticStatus）变化时才重渲染
  const prevP = prev.selectedProject;
  const nextP = next.selectedProject;
  if (!prevP && !nextP) return true; // 都是 null，不重渲染
  if (!prevP || !nextP) return false; // 一个是 null，需要重渲染
  return (
    prevP.id === nextP.id &&
    prevP.status === nextP.status &&
    prevP.error === nextP.error &&
    prevP.optimisticStatus === nextP.optimisticStatus &&
    JSON.stringify(prevP.result) === JSON.stringify(nextP.result) &&
    prevP.videoUrl === nextP.videoUrl &&
    prevP.audioUrl === nextP.audioUrl &&
    prev.analyzingId === next.analyzingId &&
    prev.exporting === next.exporting
  );
});
ProjectPanel.displayName = 'ProjectPanel';


export default function AnalysisMasterPage() {
  const router = useRouter();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const { tasks: queueTasks } = useTaskQueue('mine', user?.id, { excludeAnalysisMaster: false });
  const [draftProjects, setDraftProjects] = useState<AnalysisMasterDraftProject[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [previewData, setPreviewData] = useState<Record<string, unknown> | null>(null);
  const [previewProjectId, setPreviewProjectId] = useState<string>('');
  const [showPreview, setShowPreview] = useState(false);
  const [sourceUrl, setSourceUrl] = useState('');
  const [localHelperDisconnected, setLocalHelperDisconnected] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [batchFile, setBatchFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [batchImporting, setBatchImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [analyzingId, setAnalyzingId] = useState('');
  const [deletingId, setDeletingId] = useState('');
  const [uploadState, setUploadState] = useState<UploadState>({ phase: 'idle' });
  const [error, setError] = useState('');
  const [batchSummary, setBatchSummary] = useState<BatchImportSummary | null>(null);
  const [projectPage, setProjectPage] = useState(1);
  const { projects: serverProjects, pagination: projectPagination, mutate: mutateProjects, isLoading: isProjectsLoading } = useAnalysisMasterProjects(user?.id, projectPage);
  const [remakeStatuses, setRemakeStatuses] = useState<Record<string, ScriptRemakeStatus>>({});
  const [selectedRemake, setSelectedRemake] = useState<ScriptRemakeStatus | null>(null);
  const [showRemakeModal, setShowRemakeModal] = useState(false);

  const projects = useMemo(
    () => mergeAnalysisMasterProjects(serverProjects, draftProjects) as unknown as AnalysisProject[],
    [draftProjects, serverProjects]
  );

  // 稳定 selectedProject 引用：仅当关键业务字段变化时才更新，避免 SWR 轮询导致的无效重渲染
  const rawSelectedProject = projects.find(project => project.id === selectedId) || projects[0];
  const stableProjectRef = useRef(rawSelectedProject);
  if (
    !rawSelectedProject && !stableProjectRef.current ||
    rawSelectedProject && !stableProjectRef.current ||
    !rawSelectedProject && stableProjectRef.current
  ) {
    stableProjectRef.current = rawSelectedProject;
  } else if (rawSelectedProject && stableProjectRef.current) {
    const prev = stableProjectRef.current;
    const curr = rawSelectedProject;
    if (
      prev.id !== curr.id ||
      prev.status !== curr.status ||
      prev.error !== curr.error ||
      prev.optimisticStatus !== curr.optimisticStatus ||
      Boolean(prev.result) !== Boolean(curr.result) ||
      (prev.result && curr.result && JSON.stringify(prev.result) !== JSON.stringify(curr.result)) ||
      prev.videoDuration !== curr.videoDuration ||
      prev.audioDuration !== curr.audioDuration ||
      prev.fileSize !== curr.fileSize
    ) {
      stableProjectRef.current = rawSelectedProject;
    }
  }
  const selectedProject = stableProjectRef.current;
  const selectedProjectIsOptimistic = Boolean(selectedProject?.optimisticStatus);
  const displayedProjectCount = projectPagination.total + draftProjects.length;
  const batchTask = batchSummary ? queueTasks.find(task => task.id === batchSummary.taskId) || null : null;
  const batchTaskResult = batchTask?.result as BatchImportSummary | undefined;
  const batchTotal = batchTaskResult?.total ?? batchSummary?.total ?? 0;
  const batchProcessed = (batchTaskResult?.createdRows ?? 0) + (batchTaskResult?.failedRows ?? 0);
  const batchProgress = batchTotal > 0
    ? Math.min(100, Math.round((batchProcessed / batchTotal) * 100))
    : 0;
  const batchStatus = batchTask?.status || batchSummary?.status || 'queued';

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('analysis-master-batch-summary');
      if (!saved) return;
      const parsed = JSON.parse(saved) as BatchImportSummary;
      if (parsed?.taskId && parsed?.batchId) {
        setBatchSummary(parsed);
      }
    } catch {
      window.localStorage.removeItem('analysis-master-batch-summary');
    }
  }, []);

  useEffect(() => {
    try {
      if (batchSummary) {
        window.localStorage.setItem('analysis-master-batch-summary', JSON.stringify(batchSummary));
      } else {
        window.localStorage.removeItem('analysis-master-batch-summary');
      }
    } catch {}
  }, [batchSummary]);

  useEffect(() => {
    if (!user?.id) {
      setDraftProjects([]);
      return;
    }

    try {
      const drafts = loadAnalysisMasterDraftProjects(window.localStorage, user.id);
      setDraftProjects(drafts);
    } catch {
      setDraftProjects([]);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    try {
      saveAnalysisMasterDraftProjects(window.localStorage, user.id, draftProjects);
    } catch {}
  }, [draftProjects, user?.id]);

  // SSE 订阅：任务完成/失败时触发 SWR 重新验证，3秒轮询兜底
  useTaskEvents((data) => {
    if (data.type === 'analysis') {
      // 触发 SWR 重新获取数据，实时反映最新项目状态
      mutateProjects();
    }
    if (data.type === 'script_remake') {
      // 当复刻任务有更新时，重新获取复刻状态
      if (data.projectId) {
        const projectId = typeof data.projectId === 'string' ? data.projectId : String(data.projectId);
        fetchRemakeStatusForProject(projectId);
      }
    }
  });

  // 单独提取查询单个项目复刻状态的函数
  const fetchRemakeStatusForProject = useCallback(async (projectId: string) => {
    try {
      const response = await authFetch(`/api/analysis-master/script-remake?projectId=${projectId}`);
      const result = await response.json();
      if (result.success && result.data && result.data.length > 0) {
        const latest = result.data[0];
        setRemakeStatuses(prev => ({
          ...prev,
          [projectId]: {
            id: latest.id,
            status: latest.status,
            title: latest.title,
            created_at: latest.created_at,
          }
        }));
      }
    } catch (err) {
      console.error(`[Analysis Master] 获取复刻状态失败: ${projectId}`, err);
    }
  }, [authFetch, setRemakeStatuses]);

  // 获取已完成项目的复刻状态，并轮询正在进行中的任务
  useEffect(() => {
    const completedProjects = projects.filter(p => p.status === 'completed');
    if (completedProjects.length === 0) return;

    const fetchRemakeStatuses = async () => {
      const statuses: Record<string, ScriptRemakeStatus> = {};
      await Promise.all(
        completedProjects.map(async (project) => {
          try {
            const response = await authFetch(`/api/analysis-master/script-remake?projectId=${project.id}`);
            const result = await response.json();
            if (result.success && result.data && result.data.length > 0) {
              const latest = result.data[0];
              statuses[project.id] = {
                id: latest.id,
                status: latest.status,
                title: latest.title,
                created_at: latest.created_at,
              };
            }
          } catch (err) {
            console.error(`[Analysis Master] 获取复刻状态失败: ${project.id}`, err);
          }
        })
      );
      setRemakeStatuses(prev => ({ ...prev, ...statuses }));
    };

    fetchRemakeStatuses();
  }, [projects, fetchRemakeStatusForProject]);

  // 轮询正在进行中的复刻任务（pending/running 状态）
  useEffect(() => {
    const intervalId = setInterval(() => {
      // 在定时器回调中重新计算，避免闭包陷阱
      const inProgressProjects = Object.entries(remakeStatuses).filter(
        ([_, status]) => status.status === 'pending' || status.status === 'running'
      );

      if (inProgressProjects.length === 0) return;

      inProgressProjects.forEach(([projectId]) => {
        fetchRemakeStatusForProject(projectId);
      });
    }, 3000); // 每3秒轮询一次

    return () => clearInterval(intervalId);
  }, [remakeStatuses, fetchRemakeStatusForProject]);

  const createFromLink = async () => {
    const url = sourceUrl.trim();
    if (!url) {
      setError('请输入视频链接');
      console.log('[从链接导入] URL 为空，sourceUrl=', sourceUrl);
      return;
    }

    const clientRequestId = createClientRequestId();
    const optimisticProject = createAnalysisMasterDraftProject({
      clientRequestId,
      name: projectName.trim() || '链接分析项目',
      sourceUrl: url,
    });

    console.log('[从链接导入] 开始, url=', url);
    setLoading(true);
    setError('');
    setDraftProjects(prev => [
      optimisticProject,
      ...prev.filter(item => item.clientRequestId !== clientRequestId),
    ]);
    setSelectedId(clientRequestId);
    try {
      const helperRequest = buildAnalysisLocalHelperRequest({
        sourceUrl: url,
        projectName: projectName.trim() || '链接分析项目',
        saasBaseUrl: window.location.origin,
        authToken: getAuthToken(),
        chunkSize: ANALYSIS_LOCAL_HELPER_CHUNK_SIZE,
      });

      const healthController = new AbortController();
      const healthTimeout = window.setTimeout(() => healthController.abort(), 2000);
      try {
        const healthRes = await fetch(`${ANALYSIS_LOCAL_HELPER_URL}/health`, {
          signal: healthController.signal,
        });
        if (!healthRes.ok) {
          throw new Error('helper unavailable');
        }
        setLocalHelperDisconnected(false);
      } catch {
        setLocalHelperDisconnected(true);
        throw new Error('解析组件未连接，请启动后重试；也可以直接上传视频继续分析。');
      } finally {
        window.clearTimeout(healthTimeout);
      }

      const response = await fetch(`${ANALYSIS_LOCAL_HELPER_URL}/v1/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(helperRequest),
      });
      console.log('[从链接导入] 响应状态:', response.status);
      const data = await response.json();
      console.log('[从链接导入] 响应数据:', data);
      if (!response.ok || data.success === false) throw new Error(data.error || '视频解析失败，请检查当前网络环境后重试。');
      setSourceUrl('');
      setProjectName('');
      setLocalHelperDisconnected(false);
      const createdProject = (data.data || data) as { id?: string; projectId?: string };
      setDraftProjects(prev => prev.filter(item => item.clientRequestId !== clientRequestId));
      await mutateProjects().catch(refreshErr => {
        console.warn('[从链接导入] 列表刷新失败，但项目已创建:', refreshErr);
      });
      setSelectedId(String(createdProject.id || createdProject.projectId || ''));
      console.log('[从链接导入] 成功, projectId=', createdProject.id || createdProject.projectId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '创建失败';
      console.error('[从链接导入] 失败:', msg);
      setDraftProjects(prev => prev.map(item =>
        item.clientRequestId === clientRequestId
          ? { ...item, optimisticStatus: 'failed', status: 'failed', error: msg, updatedAt: new Date().toISOString() }
          : item
      ));
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
      await mutateProjects();
      setSelectedId(projectId);
      setTimeout(() => setUploadState({ phase: 'idle' }), 2000);
    } catch (err) {
      setUploadState({ phase: 'error', message: err instanceof Error ? err.message : '上传失败' });
      setError(err instanceof Error ? err.message : '上传失败');
    } finally {
      setLoading(false);
    }
  };

  const importFromExcel = async () => {
    if (!batchFile) {
      setError('请选择 Excel 文件');
      return;
    }

    setBatchImporting(true);
    setError('');
    setBatchSummary(null);
    try {
      const formData = new FormData();
      formData.append('file', batchFile);
      const response = await authFetch('/api/analysis-master/batch-import', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '批量导入失败');
      setBatchSummary(data.data as BatchImportSummary);
      setBatchFile(null);
      await mutateProjects();
    } catch (err) {
      setError(err instanceof Error ? err.message : '批量导入失败');
    } finally {
      setBatchImporting(false);
    }
  };

  const exportProjects = useCallback(async (projectIds?: string[]) => {
    setExporting(true);
    setError('');
    try {
      const response = await authFetch('/api/analysis-master/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectIds }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || '导出失败');
      }

      const blob = await response.blob();
      const disposition = response.headers.get('content-disposition') || '';
      const utf8Filename = disposition.match(/filename\*=UTF-8''([^;]+)/)?.[1];
      const asciiFilename = disposition.match(/filename="([^"]+)"/)?.[1];
      const filename = utf8Filename ? decodeURIComponent(utf8Filename) : (asciiFilename || 'analysis-master-export.xlsx');
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : '导出失败');
    } finally {
      setExporting(false);
    }
  }, []);

  const analyzeProject = useCallback(async (id: string) => {
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
      await mutateProjects();
    } catch (err) {
      setError(err instanceof Error ? err.message : '分析失败');
      await mutateProjects().catch(() => undefined);
    } finally {
      setAnalyzingId('');
    }
  }, [isAdmin, mutateProjects]);

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
      await mutateProjects();
    } catch (err) {
      setError(err instanceof Error ? err.message : '分析失败');
      await mutateProjects().catch(() => undefined);
    } finally {
      setAnalyzingId('');
    }
  };

  const handleDeleteProject = async (project: AnalysisProject) => {
    if (project.optimisticStatus === 'creating') {
      return;
    }

    if (project.optimisticStatus === 'failed') {
      if (!confirm('确定要删除这条创建失败的本地记录吗？删除后不可恢复。')) return;
      setDraftProjects(prev => prev.filter(item => item.clientRequestId !== project.clientRequestId));
      if (selectedId === project.id) {
        setSelectedId(projects.find(item => item.id !== project.id)?.id || '');
      }
      return;
    }

    if (!confirm('确定要删除该项目吗？删除后不可恢复。')) return;
    setDeletingId(project.id);
    try {
      const response = await authFetch(`/api/analysis-master/projects/${project.id}`, { method: 'DELETE' });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '删除失败');
      }
      await mutateProjects();
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
              <Badge variant="secondary">{displayedProjectCount || projects.length} 个项目</Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => mutateProjects().catch(err => setError(err.message))} disabled={loading}>
                <RefreshCw className="w-4 h-4 mr-1" />
                刷新
              </Button>
            </div>
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
                    <div className="rounded-md border border-purple-200 bg-purple-50 p-3 text-sm text-purple-900">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <div className="font-medium">需要先启动解析组件</div>
                          <div className="mt-1 text-xs text-purple-700">
                            {localHelperDisconnected ? '当前未检测到解析组件，请下载并启动后重试。' : '首次使用请先下载并启动，启动后再从链接导入。'}
                          </div>
                        </div>
                        <Button asChild size="sm" variant="outline" className="shrink-0 border-purple-300 bg-white text-purple-700 hover:bg-purple-100">
                          <a href={ANALYSIS_HELPER_DOWNLOAD_URL}>
                            <Download className="w-4 h-4 mr-2" />
                            下载轻量解析组件
                          </a>
                        </Button>
                      </div>
                    </div>
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
                  <CardTitle className="text-base">Excel 批量导入</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {error && !batchSummary && <div className="text-sm text-destructive bg-destructive/10 rounded-md p-3">{error}</div>}
                  <Input type="file" accept=".xlsx,.xls" onChange={event => setBatchFile(event.target.files?.[0] || null)} />
                  <Button variant="outline" className="w-full" onClick={importFromExcel} disabled={batchImporting || !batchFile}>
                    {batchImporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileSpreadsheet className="w-4 h-4 mr-2" />}
                    导入 Excel
                  </Button>
                  {batchSummary && (
                    <div className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground space-y-1">
                      <div>已加入后台队列，识别 {batchSummary.total} 条</div>
                      <div>批次 ID：{batchSummary.batchId}</div>
                      <div className="text-primary">系统会自动创建项目并进入分析队列</div>
                    </div>
                  )}
                  {batchSummary && (
                    <div className="rounded-md border bg-background p-3 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-medium">批量导入任务</div>
                        <Badge variant={batchStatus === 'failed' ? 'destructive' : batchStatus === 'success' ? 'default' : 'secondary'}>
                          {batchStatusLabels[batchStatus] || batchStatus}
                        </Badge>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-purple-600 to-pink-600 transition-all"
                          style={{ width: `${batchProgress}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>进度 {batchProgress}%</span>
                        <span>已导入 {batchProcessed}/{batchTotal} 条</span>
                      </div>
                      <div className="rounded-lg border bg-muted/30 p-3 text-xs space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-muted-foreground">成功</span>
                          <span className="font-medium text-foreground">{batchTaskResult?.createdRows ?? 0}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-muted-foreground">失败</span>
                          <span className="font-medium text-foreground">{batchTaskResult?.failedRows ?? 0}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-muted-foreground">状态</span>
                          <span className="font-medium text-foreground">{batchStatusLabels[batchStatus] || batchStatus}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-muted-foreground">总条数</span>
                          <span className="font-medium text-foreground">{batchTotal}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-muted-foreground">已处理</span>
                          <span className="font-medium text-foreground">{batchProcessed}</span>
                        </div>
                        {(batchSummary.failedRows ?? 0) > 0 && (
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-muted-foreground">失败</span>
                            <span className="font-medium text-destructive">{batchSummary.failedRows}</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-muted-foreground">批次编号</span>
                          <span className="font-medium text-foreground break-all text-right">{batchSummary.batchId}</span>
                        </div>
                        {batchSummary.failedItems && batchSummary.failedItems.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-border/50 space-y-1.5">
                            <div className="text-xs font-medium text-muted-foreground">失败详情（{batchSummary.failedRows} 条）</div>
                            {batchSummary.failedItems.map((item, idx) => (
                              <div key={idx} className="text-xs bg-destructive/5 border border-destructive/20 rounded px-2 py-1.5">
                                <div className="text-destructive font-medium truncate">{item.sourceUrl}</div>
                                <div className="text-muted-foreground mt-0.5">{item.error}</div>
                              </div>
                            ))}
                          </div>
                        )}
                        {batchSummary && batchTask?.status === 'failed' && !batchSummary.error && (
                          <div className="mt-3 p-3 bg-destructive/5 border border-destructive/20 rounded-lg">
                            <div className="text-sm font-medium text-destructive">批量导入失败</div>
                            <div className="text-xs text-muted-foreground mt-1">{batchTask.error || '任务执行异常，请重试'}</div>
                          </div>
                        )}
                      </div>

                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base">历史项目</CardTitle>
                  <Button variant="outline" size="sm" onClick={() => exportProjects()} disabled={exporting}>
                    {exporting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Download className="w-4 h-4 mr-1" />}
                    批量导出
                  </Button>
                </CardHeader>
                <CardContent className="space-y-2">
                  {isProjectsLoading && projects.length === 0 ? (
                    <>
                      {[1, 2, 3].map(i => (
                        <div key={i} className="rounded-lg border p-3 animate-pulse">
                          <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                          <div className="h-3 bg-muted rounded w-1/2" />
                        </div>
                      ))}
                    </>
                  ) : projects.length === 0 ? (
                    <div className="text-sm text-muted-foreground py-6 text-center">暂无分析项目</div>
                  ) : projects.map(project => (
                    <div key={project.id} className={`group relative rounded-lg border p-3 hover:bg-muted transition cursor-pointer ${selectedProject?.id === project.id ? 'border-primary bg-muted/60' : ''}`} onClick={() => setSelectedId(project.id)}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="text-sm font-medium truncate flex-1 min-w-0">{project.name}</div>
                        <Badge
                          variant={getProjectBadgeVariant(project)}
                          className={`shrink-0 ${project.status === 'completed' ? 'bg-emerald-500/20 text-emerald-600 border-emerald-500/30' : ''}`}
                        >
                          {getProjectStatusLabel(project)}
                        </Badge>
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
                      {project.status === 'completed' && remakeStatuses[project.id] && (
                        <button
                          className="flex items-center gap-2 text-xs text-purple-600/70 hover:text-purple-600 mt-1 w-full"
                          onClick={async (e) => {
                            e.stopPropagation();
                            const status = remakeStatuses[project.id];
                            try {
                              const response = await authFetch(`/api/analysis-master/script-remake?id=${status.id}`);
                              const result = await response.json();
                              if (result.success && result.data) {
                                setSelectedRemake(result.data);
                                setShowRemakeModal(true);
                              }
                            } catch (err) {
                              console.error('[Analysis Master] 获取复刻详情失败', err);
                            }
                          }}
                        >
                          <Sparkles className="w-3 h-3" />
                          <span className="truncate">
                            {remakeStatuses[project.id].status === 'pending' ? '脚本复刻: 排队中' :
                             remakeStatuses[project.id].status === 'running' ? '脚本复刻: 生成中' :
                             remakeStatuses[project.id].status === 'completed' ? `脚本复刻: ${remakeStatuses[project.id].title || '已完成'}` :
                             '脚本复刻: 失败'}
                          </span>
                        </button>
                      )}
                      <div className="flex items-center justify-end gap-2 mt-2">
                        <span className="text-[11px] text-muted-foreground/50">
                          {new Date(project.createdAt).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <button
                          className="p-1.5 rounded-md text-muted-foreground/50 hover:text-destructive transition"
                          onClick={(e) => { e.stopPropagation(); handleDeleteProject(project); }}
                          disabled={deletingId === project.id || project.optimisticStatus === 'creating'}
                          title="删除项目"
                        >
                          {deletingId === project.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  ))}
                  {projectPagination.totalPages > 1 && (
                    <div className="flex items-center justify-between gap-2 pt-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (projectPagination.page > 1) {
                            setProjectPage(projectPagination.page - 1);
                          }
                        }}
                        disabled={projectPagination.page <= 1 || isProjectsLoading}
                      >
                        上一页
                      </Button>
                      <div className="text-xs text-muted-foreground">
                        第 {projectPagination.page} / {projectPagination.totalPages} 页
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (projectPagination.page < projectPagination.totalPages) {
                            setProjectPage(projectPagination.page + 1);
                          }
                        }}
                        disabled={projectPagination.page >= projectPagination.totalPages || isProjectsLoading}
                      >
                        下一页
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

<ProjectPanel
                  selectedProject={selectedProject}
                  selectedProjectIsOptimistic={selectedProjectIsOptimistic}
                  analyzingId={analyzingId}
                  exporting={exporting}
                  isAdmin={isAdmin}
                  analyzeProject={analyzeProject}
                  exportProjects={exportProjects}
                />
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

        <ScriptRemakeDetailModal
          scriptRemake={selectedRemake}
          open={showRemakeModal}
          onClose={() => {
            setShowRemakeModal(false);
            setSelectedRemake(null);
          }}
        />
      </div>
    </AppLayout>
  );
}
