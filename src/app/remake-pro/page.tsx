'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { AppLayout } from '@/components/app-layout';
import { authFetch } from '@/lib/auth-context';
import { 
  Sparkles, 
  Plus, 
  Clock, 
  CheckCircle, 
  XCircle,
  Loader2,
  Trash2,
  Video,
  Film,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';

interface RemakeProProject {
  id: string;
  name: string;
  source_type: string;
  status: string;
  video_duration: number;
  segment_count: number;
  created_at: string;
  updated_at: string;
}

const STATUS_MAP: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: '草稿', color: 'secondary', icon: <Clock className="h-3 w-3" /> },
  uploaded: { label: '已上传', color: 'secondary', icon: <Clock className="h-3 w-3" /> },
  analyzing: { label: '分析中', color: 'default', icon: <Loader2 className="h-3 w-3 animate-spin" /> },
  analyzed: { label: '已分析', color: 'default', icon: <CheckCircle className="h-3 w-3" /> },
  extracting: { label: '提取帧中', color: 'default', icon: <Loader2 className="h-3 w-3 animate-spin" /> },
  frames_extracted: { label: '帧已提取', color: 'default', icon: <CheckCircle className="h-3 w-3" /> },
  generating_storyboard: { label: '生成分镜', color: 'default', icon: <Loader2 className="h-3 w-3 animate-spin" /> },
  storyboard_generated: { label: '分镜已生成', color: 'default', icon: <CheckCircle className="h-3 w-3" /> },
  animating: { label: '动画化中', color: 'default', icon: <Loader2 className="h-3 w-3 animate-spin" /> },
  animated: { label: '已动画化', color: 'default', icon: <CheckCircle className="h-3 w-3" /> },
  merging: { label: '拼接中', color: 'default', icon: <Loader2 className="h-3 w-3 animate-spin" /> },
  completed: { label: '已完成', color: 'default', icon: <CheckCircle className="h-3 w-3" /> },
  analyze_failed: { label: '分析失败', color: 'destructive', icon: <XCircle className="h-3 w-3" /> },
  extract_failed: { label: '提取失败', color: 'destructive', icon: <XCircle className="h-3 w-3" /> },
  storyboard_failed: { label: '分镜失败', color: 'destructive', icon: <XCircle className="h-3 w-3" /> },
  animate_failed: { label: '动画化失败', color: 'destructive', icon: <XCircle className="h-3 w-3" /> },
  merge_failed: { label: '拼接失败', color: 'destructive', icon: <XCircle className="h-3 w-3" /> },
};

export default function RemakeProPage() {
  const [projects, setProjects] = useState<RemakeProProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const doLoad = async () => {
      try {
        const response = await authFetch('/api/remake-pro/projects');
        if (response.status === 401) {
          window.location.href = '/login';
          return;
        }
        const data = await response.json();
        if (!cancelled) {
          setProjects(data.data || []);
        }
      } catch (error) {
        console.error('加载项目失败:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    doLoad();
    return () => { cancelled = true; };
  }, []);

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const response = await authFetch(`/api/remake-pro/projects/${deleteId}`, { method: 'DELETE' });
      const data = await response.json();
      if (response.ok && data.success) {
        setProjects(prev => prev.filter(p => p.id !== deleteId));
      } else {
        alert(data.error || '删除失败');
      }
    } catch (error) {
      console.error('删除失败:', error);
      alert('删除失败');
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const info = STATUS_MAP[status] || { label: status, color: 'secondary', icon: <Clock className="h-3 w-3" /> };
    return (
      <Badge variant={info.color as 'default' | 'secondary' | 'destructive'} className="gap-1">
        {info.icon}
        {info.label}
      </Badge>
    );
  };

  return (
    <AppLayout>
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="shrink-0 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex items-center justify-between px-6 h-14">
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-semibold flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-purple-500" />
                视频复刻大师
              </h1>
              <Badge variant="secondary" className="text-xs">{projects.length} 个项目</Badge>
            </div>
            <Button asChild className="bg-purple-600 hover:bg-purple-700">
              <Link href="/remake-pro/new">
                <Plus className="h-4 w-4 mr-2" />
                新建项目
              </Link>
            </Button>
          </div>
        </header>

        <div className="container mx-auto py-6 px-6 flex-1 overflow-auto">
          <p className="text-muted-foreground mb-6">
            一键复刻爆款短视频结构，实现"爆款骨架复用 + 自家产品替换"的高效素材生产
          </p>

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : projects.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center h-64">
                <Film className="h-16 w-16 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">暂无项目</h3>
                <p className="text-muted-foreground mb-4 text-center max-w-md">
                  上传爆款短视频，AI 自动识别9个关键场景，替换为你的产品，一键生成完整复刻视频。
                </p>
                <Button asChild className="bg-purple-600 hover:bg-purple-700">
                  <Link href="/remake-pro/new">
                    <Plus className="h-4 w-4 mr-2" />
                    创建第一个项目
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {projects.map((project) => (
                <Card key={project.id} className="relative group">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <Link href={`/remake-pro/${project.id}`} className="hover:underline">
                          <CardTitle className="truncate text-lg">
                            {project.name || '未命名项目'}
                          </CardTitle>
                        </Link>
                        <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
                          <Video className="h-3.5 w-3.5" />
                          {project.video_duration ? `${project.video_duration}秒` : '时长未知'}
                          {project.segment_count > 1 && ` · ${project.segment_count}段`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(project.status)}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => setDeleteId(project.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">
                      创建于 {new Date(project.created_at).toLocaleString('zh-CN')}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除这个项目吗？所有相关数据将被永久删除，此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
