'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { authFetch } from '@/lib/auth-context';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Plus, Film, Trash2, HardDrive, RefreshCw, Bookmark, Loader2,
  ChevronLeft, ChevronRight, Edit, Eye
} from 'lucide-react';
import { 
  ShortFilmProject, 
  getProjects, 
  getProjectsSync,
  deleteProject,  // 改用异步版本
  createNewProject,
  saveProjectSync as saveProject
} from '@/lib/shortfilm';
import { useQueryWithRefresh } from '@/lib/swr';
import { useTaskEvents } from '@/hooks/use-task-events';
import { useAuth } from '@/lib/auth-context';
import { AppLayout } from '@/components/app-layout';
import { cn } from '@/lib/utils';

// 状态映射
const statusConfig = {
  draft: { label: '草稿', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
  scripting: { label: '脚本生成中', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  generating_images: { label: '图片生成中', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
  generating_videos: { label: '视频生成中', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  completed: { label: '已完成', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
};

// 获取存储信息（现在数据存储在服务器端，返回模拟数据）
function getStorageInfo() {
  // 返回固定值，因为数据现在存储在服务器端
  return { used: 0, total: 50 * 1024 * 1024, percent: 0 };
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function cleanupOldProjects(keepCount: number = 5): number {
  let deletedCount = 0;
  
  // 使用 API 清理旧项目
  const projects = getProjectsSync();
  if (projects.length > keepCount) {
    const sortedProjects = projects.sort((a: ShortFilmProject, b: ShortFilmProject) => {
      const aTime = typeof a.updatedAt === 'string' ? new Date(a.updatedAt).getTime() : a.updatedAt;
      const bTime = typeof b.updatedAt === 'string' ? new Date(b.updatedAt).getTime() : b.updatedAt;
      return bTime - aTime;
    });
    const toDelete = sortedProjects.slice(keepCount);
    toDelete.forEach((p: ShortFilmProject) => deleteProject(p.id));
    deletedCount = toDelete.length;
  }
  
  return deletedCount;
}

export default function ShortFilmPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [storageInfo, setStorageInfo] = useState({ used: 0, total: 50 * 1024 * 1024, percent: 0 });
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showCleanupDialog, setShowCleanupDialog] = useState(false);
  const [showClearAllDialog, setShowClearAllDialog] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<ShortFilmProject | null>(null);
  const [newProjectName, setNewProjectName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  
  // 分页状态
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;
  
  // 使用 SWR 管理项目数据，启用窗口聚焦刷新
  const { data: projectsData, isLoading, refresh: refreshProjects } = useQueryWithRefresh<ShortFilmProject[]>(
    user ? `shortfilm:projects:${user.id}` : null,
    getProjects,
    { 
      dedupingInterval: 5000,
      revalidateOnFocus: true, // 启用窗口聚焦时自动刷新
    }
  );
  
  // 排序后的项目列表
  const projects = (projectsData || []).sort((a, b) => {
    const aTime = typeof a.updatedAt === 'string' ? new Date(a.updatedAt).getTime() : a.updatedAt;
    const bTime = typeof b.updatedAt === 'string' ? new Date(b.updatedAt).getTime() : b.updatedAt;
    return bTime - aTime;
  });
  
  // 刷新项目列表
  const loadProjects = useCallback(() => {
    refreshProjects();
    setStorageInfo(getStorageInfo());
  }, [refreshProjects]);
  
  // 监听 SSE 任务事件，当短片相关任务完成时自动刷新
  useTaskEvents(
    useCallback((data) => {
      // 当任务成功且有 projectId 时，刷新项目列表
      if (data.status === 'success' && data.projectId) {
        console.log('[短片列表] 收到任务完成事件，刷新项目:', data.projectId);
        refreshProjects();
      }
    }, [refreshProjects]),
    { enabled: true }
  );

  const handleCreateProject = async () => {
    // 防止重复点击
    if (isCreating) return;
    
    setIsCreating(true);
    try {
      const name = newProjectName.trim() || '未命名短片';
      const project = createNewProject(name);
      await saveProject(project);
      setShowNewDialog(false);
      setNewProjectName('');
      router.push(`/shortfilm/new?id=${project.id}`);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteProject = async () => {
    if (projectToDelete) {
      // 等待删除完成
      await deleteProject(projectToDelete.id);
      setProjectToDelete(null);
      setShowDeleteDialog(false);
      // 刷新项目列表
      loadProjects();
      // 如果删除后当前页没有项目了，回到上一页
      const totalPages = Math.ceil((projects.length - 1) / ITEMS_PER_PAGE);
      if (currentPage > totalPages && totalPages > 0) {
        setCurrentPage(totalPages);
      }
    }
  };

  const handleCleanup = (keepCount: number) => {
    cleanupOldProjects(keepCount);
    loadProjects();
    setShowCleanupDialog(false);
    setCurrentPage(1); // 重置页码
  };

  const handleClearAllProjects = async () => {
    // 使用 API 批量删除所有项目
    try {
      const response = await authFetch('/api/shortfilm/projects', {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const data = await response.json();
        console.error('清空项目失败:', data.error);
        return;
      }
      
      setShowClearAllDialog(false);
      loadProjects();
      setCurrentPage(1); // 重置页码
    } catch (error) {
      console.error('清空项目失败:', error);
    }
  };

  const formatTime = (timestamp: string | number | Date) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
    
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <AppLayout>
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* 页面标题栏 */}
        <header className="shrink-0 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex items-center justify-between px-6 h-14">
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-semibold">短片管理</h1>
              <Badge variant="secondary" className="text-xs">{projects.length} 个项目</Badge>
              {projects.length > 0 && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-7 text-xs text-muted-foreground hover:text-destructive"
                  onClick={() => setShowClearAllDialog(true)}
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" />
                  清空全部
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Link href="/shortfilm/templates">
                <Button variant="outline" size="sm">
                  <Bookmark className="w-4 h-4 mr-1" />
                  广告模板
                </Button>
              </Link>
              <Button size="sm" className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700" onClick={() => setShowNewDialog(true)}>
                <Plus className="w-4 h-4 mr-1" />
                新建短片
              </Button>
            </div>
          </div>
        </header>

        {/* 主内容区域 */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* 存储状态 */}
            {storageInfo.percent > 50 && (
              <div className={cn(
                "rounded-lg p-4 flex items-center justify-between",
                storageInfo.percent > 90 
                  ? "bg-destructive/10 border border-destructive/20" 
                  : storageInfo.percent > 70
                    ? "bg-amber-500/10 border border-amber-500/20"
                    : "bg-muted border"
              )}>
                <div className="flex items-center gap-3">
                  <HardDrive className={cn(
                    "w-5 h-5",
                    storageInfo.percent > 90 ? "text-destructive" : 
                    storageInfo.percent > 70 ? "text-amber-500" : "text-muted-foreground"
                  )} />
                  <div>
                    <div className="font-medium text-sm">
                      {storageInfo.percent > 70 ? '存储空间不足' : '存储空间'}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      已使用 {formatBytes(storageInfo.used)} ({storageInfo.percent.toFixed(1)}%)
                    </div>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => setShowCleanupDialog(true)}>
                  <RefreshCw className="w-4 h-4 mr-1" />
                  清理空间
                </Button>
              </div>
            )}

            {/* 项目列表 */}
            {isLoading ? (
              <Card className="border-dashed">
                <CardContent className="py-16 text-center">
                  <Loader2 className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4 animate-spin" />
                  <p className="text-muted-foreground">加载中...</p>
                </CardContent>
              </Card>
            ) : projects.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-16 text-center">
                  <Film className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
                  <h3 className="text-lg font-medium mb-2">还没有短片项目</h3>
                  <p className="text-muted-foreground mb-6">点击"新建短片"开始创作您的第一个短片</p>
                  <Button className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700" onClick={() => setShowNewDialog(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    新建短片
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {projects.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE).map((project) => {
                    const statusInfo = statusConfig[project.status];
                  
                  // 计算进度
                  const totalSegments = project.scriptSegments?.length || 0;
                  const completedVideos = project.videoTasks?.filter(v => v.status === 'completed').length || 0;
                  const totalVideos = project.videoTasks?.length || 0;
                  
                  // 获取已生成的图片（最多4张）
                  const generatedImages = project.imageTasks
                    ?.filter(task => task.generatedImages && task.generatedImages.length > 0)
                    .map(task => {
                      // 优先使用用户选择的图片
                      if (task.selectedImageId) {
                        const selected = task.generatedImages.find(img => img.id === task.selectedImageId);
                        if (selected) return selected.url;
                      }
                      // 否则使用最新生成的图片
                      return task.generatedImages[task.generatedImages.length - 1]?.url;
                    })
                    .filter(Boolean)
                    .slice(0, 4) || [];
                  
                  return (
                    <Card key={project.id} className="group hover:shadow-md hover:border-primary/30 transition-all overflow-hidden py-0 gap-0">
                      {/* 顶部状态栏 - 加高并显示状态文字 */}
                      <div className={cn(
                        "h-6 w-full flex items-center justify-center text-[10px] font-medium rounded-t-xl",
                        project.status === 'completed' && "bg-green-500 text-white",
                        project.status === 'draft' && "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
                        project.status === 'scripting' && "bg-blue-500 text-white",
                        project.status === 'generating_images' && "bg-yellow-500 text-white",
                        project.status === 'generating_videos' && "bg-orange-500 text-white"
                      )}>
                        {statusInfo.label}
                      </div>
                      
                      {/* 图片预览区域 - 在状态条下方，固定高度保证对齐 */}
                      <div className="grid grid-cols-4 gap-0.5 p-1.5 bg-muted/30">
                        {generatedImages.length > 0 ? (
                          <>
                            {generatedImages.map((url, index) => (
                              <div 
                                key={index} 
                                className="aspect-square relative overflow-hidden rounded-sm"
                              >
                                <img 
                                  src={url} 
                                  alt={`图片 ${index + 1}`}
                                  loading="lazy"
                                  decoding="async"
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                />
                              </div>
                            ))}
                            {/* 如果图片不足4张，填充空白占位 */}
                            {generatedImages.length < 4 && Array.from({ length: 4 - generatedImages.length }).map((_, i) => (
                              <div key={`empty-${i}`} className="aspect-square bg-muted rounded-sm" />
                            ))}
                          </>
                        ) : (
                          /* 无图片时显示占位 */
                          <div className="col-span-4 flex items-center justify-center text-[10px] text-muted-foreground/50 py-4">
                            暂无图片
                          </div>
                        )}
                      </div>
                      
                      <div className="px-2.5 py-2">
                        {/* 标题行 */}
                        <div className="mb-1">
                          <div className="text-xs font-medium truncate">{project.name}</div>
                        </div>
                        
                        {/* 更多信息 */}
                        <div className="space-y-0.5 mb-2 text-[10px] text-muted-foreground">
                          <div className="flex items-center justify-between">
                            <span>脚本段落</span>
                            <span className="font-medium text-foreground">{totalSegments} 段</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>图片生成</span>
                            <span className="font-medium text-foreground">{project.imageTasks?.filter(t => t.status === 'completed').length || 0}/{project.imageTasks?.length || 0}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>视频生成</span>
                            <span className="font-medium text-foreground">{completedVideos}/{totalVideos}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>合成视频</span>
                            <span className="font-medium text-foreground">{project.mergedVideos?.length || 0} 个</span>
                          </div>
                        </div>

                        {/* 操作按钮 */}
                        <div className="flex gap-1.5">
                          <Button 
                            size="sm" 
                            variant="outline"
                            className="flex-1 h-6 text-[10px] hover:bg-primary hover:text-primary-foreground"
                            onClick={() => {
                              // 智能计算目标步骤（不依赖数据库中可能过时的 currentStep）
                              let targetStep = 1;
                              const hasMergedVideos = project.mergedVideos && project.mergedVideos.length > 0;
                              const hasVideoTasks = project.videoTasks && project.videoTasks.length > 0;
                              const allVideosCompleted = hasVideoTasks && 
                                project.videoTasks.every(v => v.status === 'completed');
                              const allImagesCompleted = project.imageTasks?.length > 0 && 
                                project.imageTasks.every(i => i.status === 'completed');
                              const hasScript = project.scriptSegments && project.scriptSegments.length > 0;
                              const hasProductInfo = project.productImages?.length > 0 || project.productDescription;
                              
                              if (hasMergedVideos || project.status === 'completed') {
                                targetStep = 5;
                              } else if (allVideosCompleted) {
                                targetStep = 4; // 视频完成进入合成
                              } else if (hasVideoTasks) {
                                targetStep = 4; // 有视频任务（进行中或失败）进入视频生成
                              } else if (allImagesCompleted) {
                                targetStep = 3; // 图片完成但没有视频任务，需要用户点击"生成视频"按钮
                              } else if (hasScript && project.imageTasks && project.imageTasks.length > 0) {
                                targetStep = 3; // 有脚本且有图片任务（进行中或失败），进入图片生成
                              } else if (hasScript) {
                                targetStep = 2; // 只有脚本没有图片任务，进入确认脚本
                              } else if (hasProductInfo) {
                                targetStep = 1; // 只有产品信息，在第一步
                              }
                              
                              console.log('[短片列表] 点击继续, project:', project.id, 
                                'hasScript:', hasScript, 'allImagesCompleted:', allImagesCompleted,
                                'hasVideoTasks:', hasVideoTasks, 'targetStep:', targetStep);
                              router.push(`/shortfilm/new?id=${project.id}&step=${targetStep}`);
                            }}
                          >
                            {project.status === 'completed' ? (
                              <>
                                <Eye className="w-3 h-3 mr-1" />
                                查看
                              </>
                            ) : (
                              <>
                                <Edit className="w-3 h-3 mr-1" />
                                继续
                              </>
                            )}
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost"
                            className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            onClick={() => {
                              setProjectToDelete(project);
                              setShowDeleteDialog(true);
                            }}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
              
              {/* 分页控制 */}
              {projects.length > ITEMS_PER_PAGE && (() => {
                const totalPages = Math.ceil(projects.length / ITEMS_PER_PAGE);
                return (
                  <div className="flex items-center justify-center gap-2 pt-4 pb-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="w-4 h-4 mr-1" />
                      上一页
                    </Button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum: number;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }
                        return (
                          <Button
                            key={pageNum}
                            variant={currentPage === pageNum ? "default" : "outline"}
                            size="sm"
                            className="w-8 h-8 p-0"
                            onClick={() => setCurrentPage(pageNum)}
                          >
                            {pageNum}
                          </Button>
                        );
                      })}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage >= totalPages}
                    >
                      下一页
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                    <span className="text-sm text-muted-foreground ml-2">
                      共 {projects.length} 条
                    </span>
                  </div>
                );
              })()}
            </>
            )}
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* 新建项目对话框 */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建短片项目</DialogTitle>
            <DialogDescription>为您的短片项目起个名字</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="name">项目名称</Label>
            <Input
              id="name"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              placeholder="我的短片"
              className="mt-2"
              onKeyDown={(e) => e.key === 'Enter' && handleCreateProject()}
              disabled={isCreating}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewDialog(false)} disabled={isCreating}>取消</Button>
            <Button onClick={handleCreateProject} disabled={isCreating}>
              {isCreating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认对话框 */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除项目</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除项目 "{projectToDelete?.name}" 吗？此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteProject} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 清理空间对话框 */}
      <Dialog open={showCleanupDialog} onOpenChange={setShowCleanupDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>清理存储空间</DialogTitle>
            <DialogDescription>选择保留最近的项目数量，其他项目将被删除</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3">
            {[5, 3, 1].map((count) => (
              <Button key={count} variant="outline" className="w-full justify-start" onClick={() => handleCleanup(count)}>
                保留最近 {count} 个项目
              </Button>
            ))}
            <Button variant="outline" className="w-full justify-start text-destructive" onClick={() => { cleanupOldProjects(0); loadProjects(); setShowCleanupDialog(false); }}>
              清空所有项目
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 清空全部确认对话框 */}
      <AlertDialog open={showClearAllDialog} onOpenChange={setShowClearAllDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>清空所有短片项目</AlertDialogTitle>
            <AlertDialogDescription>
              确定要清空所有短片项目吗？共 {projects.length} 个项目将被永久删除，此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleClearAllProjects}
            >
              确认清空
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
