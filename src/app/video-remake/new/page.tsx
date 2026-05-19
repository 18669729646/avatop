'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/app-layout';
import { getAuthToken } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Video, Link2, Upload, ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function NewRemakeProjectPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const projectNameRef = useRef<HTMLInputElement>(null);

  const createProject = async (name: string): Promise<string> => {
    const token = getAuthToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const response = await fetch('/api/shortfilm/projects', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name,
        sourceType: 'remake',
      }),
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || '创建项目失败');
    }
    return result.data?.id || result.id;
  };

  const validateVideoUrl = (url: string): boolean => {
    const allowedHosts = [
      'tiktok.com', 'vm.tiktok.com',
      'youtube.com', 'youtu.be',
      'instagram.com',
      'xiaohongshu.com', 'xhslink.com',
      'bilibili.com', 'b23.tv',
      'douyin.com', 'v.douyin.com',
      'weibo.com', 'weibo.cn', 'm.weibo.cn',
      'kuaishou.com', 'v.kuaishou.com', 'gifshow.com',
    ];
    try {
      const hostname = new URL(url).hostname.toLowerCase();
      return allowedHosts.some(host => hostname === host || hostname.endsWith('.' + host));
    } catch {
      return false;
    }
  };

  const handleLinkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!projectName.trim()) {
      toast.error('请输入项目名称');
      return;
    }
    
    if (!videoUrl.trim()) {
      toast.error('请输入视频链接');
      return;
    }

    if (!validateVideoUrl(videoUrl)) {
      toast.error('暂不支持该平台链接，请上传视频文件');
      return;
    }

    setLoading(true);
    try {
      const id = await createProject(projectName.trim());
      
      const token = getAuthToken();
      const linkResponse = await fetch('/api/shortfilm/remake-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          url: videoUrl.trim(),
          projectId: id,
        }),
      });
      
      const linkResult = await linkResponse.json();
      if (!linkResult.success) {
        toast.warning('项目已创建，但链接解析失败：' + (linkResult.error || '未知错误'));
        router.push(`/shortfilm/new?id=${id}&mode=remake`);
        return;
      }
      
      toast.success('项目创建成功');
      router.push(`/shortfilm/new?id=${id}&mode=remake`);
    } catch (error) {
      console.error('创建项目失败:', error);
      toast.error(error instanceof Error ? error.message : '创建失败');
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const allowedTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('请上传 MP4、MOV、AVI 或 WebM 格式的视频');
      return;
    }
    
    const maxSize = 500 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error('视频文件不能超过 500MB');
      return;
    }
    
    setSelectedFile(file);
  };
  
  const handleStartUpload = async () => {
    const currentProjectName = projectNameRef.current?.value?.trim() || projectName.trim();
    
    if (!currentProjectName) {
      toast.error('请输入项目名称');
      projectNameRef.current?.focus();
      return;
    }
    
    if (!selectedFile) {
      toast.error('请先选择视频文件');
      return;
    }
    
    const token = getAuthToken();
    if (!token) {
      toast.error('请先登录后再上传视频');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    
    let projectId: string | null = null;
    
    try {
      setUploadProgress(1);
      projectId = await createProject(currentProjectName);

      setUploadProgress(5);
      
      const CHUNK_SIZE = 5 * 1024 * 1024;
      const totalChunks = Math.ceil(selectedFile.size / CHUNK_SIZE);
      
      const initResponse = await fetch('/api/shortfilm/remake-chunk-init', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          projectId,
          fileName: selectedFile.name,
          fileSize: selectedFile.size,
          chunkSize: CHUNK_SIZE,
          totalChunks,
        }),
      });
      
      const initData = await initResponse.json();
      if (!initData.success) {
        throw new Error(initData.error || '初始化上传失败');
      }
      
      const { uploadId, key } = initData;
      
      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, selectedFile.size);
        const chunk = selectedFile.slice(start, end);
        
        const formData = new FormData();
        formData.append('chunk', chunk);
        formData.append('uploadId', uploadId);
        formData.append('chunkIndex', String(i));
        
        const chunkResponse = await fetch('/api/shortfilm/remake-chunk-upload', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData,
        });
        
        if (!chunkResponse.ok) {
          throw new Error(`分片 ${i + 1} 上传失败`);
        }
        
        const percent = Math.round(((i + 1) / totalChunks) * 90) + 5;
        setUploadProgress(percent);
      }
      
      setUploadProgress(95);
      
      const completeResponse = await fetch('/api/shortfilm/remake-chunk-complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ uploadId, key }),
      });
      
      const completeData = await completeResponse.json();
      if (!completeData.success) {
        throw new Error(completeData.error || '完成上传失败');
      }
      
      setUploadProgress(100);
      toast.success('视频上传成功');
      router.push(`/shortfilm/new?id=${projectId}&mode=remake`);

    } catch (error) {
      console.error('[Upload] Error:', error);
      toast.error(error instanceof Error ? error.message : '上传失败');
      setUploading(false);
    }
  };

  return (
    <AppLayout>
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="shrink-0 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex items-center justify-between px-6 h-14">
            <div className="flex items-center gap-4">
              <Link href="/video-remake">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  返回
                </Button>
              </Link>
              <h1 className="text-xl font-semibold">新建视频复刻项目</h1>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-auto">
          <div className="container mx-auto py-6 px-6 max-w-2xl">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Video className="h-6 w-6" />
                  新建视频复刻项目
                </CardTitle>
                <CardDescription>
                  输入爆款短视频链接或上传视频，AI 将自动解析并复刻
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="name">项目名称</Label>
                  <Input
                    id="name"
                    ref={projectNameRef}
                    placeholder="例如：2024年度爆款带货视频"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                  />
                </div>

                <Tabs defaultValue="upload" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="link" className="gap-2">
                      <Link2 className="h-4 w-4" />
                      社交链接
                    </TabsTrigger>
                    <TabsTrigger value="upload" className="gap-2">
                      <Upload className="h-4 w-4" />
                      本地上传
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="link" className="space-y-4 mt-4">
                    <form onSubmit={handleLinkSubmit} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="url">视频链接</Label>
                        <Input
                          id="url"
                          type="url"
                          placeholder="https://www.tiktok.com/... 或 https://www.youtube.com/..."
                          value={videoUrl}
                          onChange={(e) => setVideoUrl(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                          支持 TikTok、YouTube、Instagram、抖音、B站、小红书、快手等平台
                        </p>
                      </div>
                      <Button type="submit" className="w-full" disabled={loading}>
                        {loading ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            创建并解析...
                          </>
                        ) : (
                          '创建项目'
                        )}
                      </Button>
                    </form>
                  </TabsContent>

                  <TabsContent value="upload" className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label>选择视频文件</Label>
                      <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
                        <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground mb-2">
                          支持 MP4、MOV、AVI、WebM 格式
                        </p>
                        <p className="text-xs text-muted-foreground mb-4">
                          最大支持 500MB
                        </p>
                        <input
                          type="file"
                          id="video-upload"
                          accept="video/mp4,video/quicktime,video/x-msvideo,video/webm"
                          className="hidden"
                          onChange={handleFileSelect}
                          disabled={uploading}
                        />
                        {!selectedFile ? (
                          <Button
                            variant="outline"
                            onClick={() => document.getElementById('video-upload')?.click()}
                            disabled={uploading}
                          >
                            <Upload className="h-4 w-4 mr-2" />
                            选择文件
                          </Button>
                        ) : (
                          <div className="space-y-4">
                            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                              <Video className="h-5 w-5 text-primary" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                                </p>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelectedFile(null)}
                                disabled={uploading}
                              >
                                移除
                              </Button>
                            </div>
                            <Button
                              className="w-full"
                              onClick={handleStartUpload}
                              disabled={uploading}
                            >
                              {uploading ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  上传中 {uploadProgress}%
                                </>
                              ) : (
                                <>
                                  <Video className="h-4 w-4 mr-2" />
                                  开始上传
                                </>
                              )}
                            </Button>
                            {uploading && uploadProgress > 0 && (
                              <div className="h-2 bg-muted rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-primary transition-all duration-300"
                                  style={{ width: `${uploadProgress}%` }}
                                />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </div>
        </div>
      </AppLayout>
  );
}
