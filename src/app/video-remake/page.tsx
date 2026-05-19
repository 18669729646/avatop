'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { AppLayout } from '@/components/app-layout';
import { authFetch } from '@/lib/auth-context';
import { 
  Video, 
  Plus, 
  Clock, 
  CheckCircle, 
  XCircle,
  Loader2,
  MoreVertical,
  Trash2,
  Eye
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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

interface RemakeProject {
  id: string;
  name: string;
  sourceType: string;
  status: string;
  currentStep: number;
  createdAt: string;
  updatedAt: string;
  scriptSegments?: unknown[];
}

export default function VideoRemakePage() {
  const [projects, setProjects] = useState<RemakeProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    
    const doLoad = async () => {
      try {
        const response = await authFetch('/api/shortfilm/projects?sourceType=remake');
        
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
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    
    doLoad();
    
    return () => { cancelled = true; };
  }, []);

  const handleDelete = async () => {
    if (!deleteId) return;
    
    setDeleting(true);
    try {
      const response = await authFetch(`/api/shortfilm/projects/${deleteId}`, {
        method: 'DELETE',
      });
      const data = await response.json();
      
      if (response.ok && data.success) {
        setProjects(prev => prev.filter(p => p.id !== deleteId));
      } else {
        alert(data.error || `删除失败 (${response.status})`);
      }
    } catch (error) {
      console.error('删除失败:', error);
      alert('删除失败');
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  };

  const getStatusBadge = (status: string, currentStep: number) => {
    if (status === 'completed') {
      return (
        <Badge variant="default" className="bg-green-500 gap-1">
          <CheckCircle className="h-3 w-3" />
          完成
        </Badge>
      );
    }
    if (status === 'failed') {
      return (
        <Badge variant="destructive" className="gap-1">
          <XCircle className="h-3 w-3" />
          失败
        </Badge>
      );
    }
    if (currentStep > 1) {
      return (
        <Badge variant="outline" className="gap-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          步骤 {currentStep}/5
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="gap-1">
        <Clock className="h-3 w-3" />
        草稿
      </Badge>
    );
  };

  return (
    <AppLayout>
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="shrink-0 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex items-center justify-between px-6 h-14">
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-semibold">视频复刻</h1>
              <Badge variant="secondary" className="text-xs">{projects.length} 个项目</Badge>
            </div>
            <Button asChild>
              <Link href="/video-remake/new">
                <Plus className="h-4 w-4 mr-2" />
                新建项目
              </Link>
            </Button>
          </div>
        </header>

        <div className="container mx-auto py-6 px-6 flex-1 overflow-auto">
          <p className="text-muted-foreground mb-6">
            AI 智能复刻爆款短视频，保留原视频风格与内容
          </p>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : projects.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center h-64">
            <Video className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">暂无项目</h3>
            <p className="text-muted-foreground mb-4 text-center max-w-md">
              输入爆款短视频链接或上传视频，AI 将自动解析脚本、镜头语言和口播风格，
              生成高还原度的复刻视频素材。
            </p>
            <Button asChild>
              <Link href="/video-remake/new">
                <Plus className="h-4 w-4 mr-2" />
                创建第一个项目
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Card key={project.id} className="relative">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="truncate text-lg">
                      {project.name || '未命名项目'}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      视频复刻
                    </p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link href={`/shortfilm/new?id=${project.id}&mode=remake`}>
                          <Eye className="h-4 w-4 mr-2" />
                          查看
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        className="text-destructive"
                        onClick={() => setDeleteId(project.id)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        删除
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  {getStatusBadge(project.status, project.currentStep)}
                  <span className="text-xs text-muted-foreground">
                    {new Date(project.createdAt).toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </span>
                </div>
                <Button className="w-full mt-4" variant="outline" asChild>
                  <Link href={`/shortfilm/new?id=${project.id}&mode=remake`}>
                    {project.currentStep > 1 ? '继续编辑' : '开始复刻'}
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除这个项目吗？此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? '删除中...' : '删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
      </div>
    </AppLayout>
  );
}
