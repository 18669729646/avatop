'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AppLayout } from '@/components/app-layout';
import { authFetch } from '@/lib/auth-context';
import { 
  Upload, 
  Link2, 
  Loader2, 
  ArrowRight, 
  Film,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getAuthToken } from '@/lib/auth-context';

export default function RemakeProNewPage() {
  const router = useRouter();
  const [sourceType, setSourceType] = useState<'upload' | 'link'>('link');
  const [linkUrl, setLinkUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [uploadPercent, setUploadPercent] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.includes('mp4') && !file.type.includes('mov') && !file.type.includes('quicktime')) {
      alert('仅支持 MP4/MOV 格式');
      return;
    }
    if (file.size > 100 * 1024 * 1024) {
      alert('文件大小不能超过 100MB');
      return;
    }
    setSelectedFile(file);
  }, []);

  const handleCreate = async () => {
    setUploading(true);
    setUploadProgress('创建项目中...');

    try {
      let sourceVideoKey = '';
      let videoDuration = 0;
      let fileName = '';

      if (sourceType === 'upload' && selectedFile) {
        // 分片上传视频到 S3
        setUploadProgress('上传视频中...');

        const CHUNK_SIZE = 5 * 1024 * 1024;
        const totalChunks = Math.ceil(selectedFile.size / CHUNK_SIZE);
        const token = getAuthToken();

        // 初始化分片上传
        const initResp = await fetch('/api/shortfilm/remake-chunk-init', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            projectId: `rp_${Date.now()}`,
            fileName: selectedFile.name,
            fileSize: selectedFile.size,
            chunkSize: CHUNK_SIZE,
            totalChunks,
          }),
        });
        const initData = await initResp.json();
        if (!initData.success) {
          throw new Error(initData.error || '初始化上传失败');
        }
        const { uploadId, key } = initData;

        // 逐片上传
        for (let i = 0; i < totalChunks; i++) {
          const start = i * CHUNK_SIZE;
          const end = Math.min(start + CHUNK_SIZE, selectedFile.size);
          const chunk = selectedFile.slice(start, end);

          const formData = new FormData();
          formData.append('chunk', chunk);
          formData.append('uploadId', uploadId);
          formData.append('chunkIndex', String(i));

          const chunkResp = await fetch('/api/shortfilm/remake-chunk-upload', {
            method: 'POST',
            headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
            body: formData,
          });
          if (!chunkResp.ok) {
            throw new Error(`上传分片 ${i + 1}/${totalChunks} 失败`);
          }
          setUploadPercent(Math.round(((i + 1) / totalChunks) * 100));
        }

        // 完成分片上传
        const completeResp = await fetch('/api/shortfilm/remake-chunk-complete', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ uploadId, key }),
        });
        const completeData = await completeResp.json();
        if (!completeData.success) {
          throw new Error(completeData.error || '完成上传失败');
        }

        sourceVideoKey = completeData.key;
        fileName = selectedFile.name;
      } else if (sourceType === 'link' && linkUrl) {
        // 通过链接解析视频
        setUploadProgress('解析视频链接...');
        const parseResp = await authFetch('/api/shortfilm/remake-link', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: linkUrl }),
        });
        const parseData = await parseResp.json();

        if (!parseData.success) {
          throw new Error(parseData.error || '链接解析失败');
        }
        sourceVideoKey = parseData.data.videoKey;
        videoDuration = parseData.data.duration || 0;
        fileName = parseData.data.fileName || 'linked_video.mp4';
      } else {
        throw new Error('请上传视频或输入视频链接');
      }

      // 创建项目
      setUploadProgress('创建项目...');
      const createResp = await authFetch('/api/remake-pro/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${fileName.replace(/\.[^.]+$/, '')} - 复刻`,
          sourceType,
          sourceUrl: sourceType === 'link' ? linkUrl : undefined,
          sourceVideoKey,
          videoDuration,
          fileName,
        }),
      });
      const createData = await createResp.json();

      if (!createData.success) {
        throw new Error(createData.error || '创建项目失败');
      }

      router.push(`/remake-pro/${createData.data.id}`);
    } catch (error) {
      console.error('[RemakePro] 创建项目失败:', error);
      alert(error instanceof Error ? error.message : '创建项目失败');
    } finally {
      setUploading(false);
      setUploadProgress('');
      setUploadPercent(0);
    }
  };

  return (
    <AppLayout>
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="shrink-0 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex items-center justify-between px-6 h-14">
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-semibold flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-purple-500" />
                新建复刻项目
              </h1>
            </div>
          </div>
        </header>

        <div className="container mx-auto py-8 px-6 max-w-2xl">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Film className="h-5 w-5" />
                上传参考视频
              </CardTitle>
              <CardDescription>
                上传或输入爆款短视频链接，AI 将自动分析视频结构并生成复刻方案
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={sourceType} onValueChange={(v) => setSourceType(v as 'upload' | 'link')}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="link" className="gap-2">
                    <Link2 className="h-4 w-4" />
                    视频链接
                  </TabsTrigger>
                  <TabsTrigger value="upload" className="gap-2">
                    <Upload className="h-4 w-4" />
                    本地上传
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="link" className="mt-4 space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">视频链接</label>
                    <Input
                      placeholder="输入 TikTok/抖音/YouTube/B站 视频链接"
                      value={linkUrl}
                      onChange={(e) => setLinkUrl(e.target.value)}
                      disabled={uploading}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      支持 TikTok、抖音、YouTube、B站 等主流短视频平台
                    </p>
                  </div>
                </TabsContent>

                <TabsContent value="upload" className="mt-4 space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">选择视频文件</label>
                    <Input
                      type="file"
                      accept="video/mp4,video/quicktime,.mp4,.mov"
                      onChange={handleFileSelect}
                      disabled={uploading}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      支持 MP4/MOV 格式，最大 100MB，时长不超过 60 秒
                    </p>
                    {selectedFile && (
                      <p className="text-sm mt-2 text-green-600">
                        已选择: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(1)}MB)
                      </p>
                    )}
                  </div>
                </TabsContent>
              </Tabs>

              <div className="mt-6 flex justify-end">
                <Button
                  onClick={handleCreate}
                  disabled={uploading || (sourceType === 'upload' ? !selectedFile : !linkUrl.trim())}
                  className="bg-purple-600 hover:bg-purple-700 min-w-[140px]"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      {uploadProgress}{uploadPercent > 0 ? ` ${uploadPercent}%` : ''}
                    </>
                  ) : (
                    <>
                      开始复刻
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
