'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AppLayout } from '@/components/app-layout';
import { authFetch } from '@/lib/auth-context';
import {
  Sparkles,
  Film,
  Image as ImageIcon,
  Play,
  Download,
  Loader2,
  CheckCircle,
  XCircle,
  ArrowRight,
  RefreshCw,
  Upload,
  Trash2,
  Grid3X3,
  Clapperboard,
  Package,
  User,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ProductSelector } from '@/components/product-selector';
import { CharacterLibraryDialog } from '@/components/character-library-dialog';
import { ProductSelection } from '@/lib/products';
import { CharacterItem } from '@/lib/history';
import { compressImage } from '@/lib/image-utils';

interface Scene {
  id: string;
  scene_index: number;
  start_time: number;
  description: string;
  camera_movement: string;
  scene_detail: string;
  key_frame_url?: string;
  key_frame_key?: string;
  storyboard_url?: string;
  storyboard_key?: string;
  video_url?: string;
  video_key?: string;
  status: string;
  animate_prompt?: string;
  error?: string;
}

interface Project {
  id: string;
  name: string;
  status: string;
  source_video_url?: string;
  key_frame_grid_url?: string;
  storyboard_grid_url?: string;
  output_video_url?: string;
  product_images: Array<{ key?: string; url?: string; s3Key?: string; name?: string }>;
  character_image?: { key?: string; url?: string; s3Key?: string; name?: string };
  video_duration: number;
  segment_count: number;
  scenes: Scene[];
}

const STEPS = [
  { key: 'upload', label: '上传视频', icon: Film },
  { key: 'analyze', label: '视频理解', icon: Sparkles },
  { key: 'products', label: '产品/角色', icon: ImageIcon },
  { key: 'storyboard', label: '分镜生成', icon: Grid3X3 },
  { key: 'animate', label: '动画化', icon: Clapperboard },
  { key: 'output', label: '输出', icon: Download },
];

export default function RemakeProDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [processMsg, setProcessMsg] = useState('');
  const [productFiles, setProductFiles] = useState<File[]>([]);
  const [characterFile, setCharacterFile] = useState<File | null>(null);
  const [productSelectorOpen, setProductSelectorOpen] = useState(false);
  const [characterDialogOpen, setCharacterDialogOpen] = useState(false);

  const loadProject = useCallback(async () => {
    try {
      const resp = await authFetch(`/api/remake-pro/projects/${projectId}`);
      const data = await resp.json();
      if (data.success) {
        setProject(data.data);
      } else {
        alert(data.error || '加载项目失败');
        router.push('/remake-pro');
      }
    } catch (error) {
      console.error('加载项目失败:', error);
    } finally {
      setLoading(false);
    }
  }, [projectId, router]);

  useEffect(() => {
    loadProject();
  }, [loadProject]);

  // 计算当前步骤
  const getCurrentStep = () => {
    if (!project) return 0;
    const s = project.status;
    if (s === 'pending') return 0;
    if (s === 'uploaded') return 1;
    if (s === 'analyzing' || s === 'analyze_failed') return 1;
    if (s === 'analyzed' || s === 'extracting' || s === 'extract_failed' || s === 'frames_extracted') return 2;
    if (['generating_storyboard', 'storyboard_failed', 'storyboard_generated'].includes(s)) return 3;
    if (['animating', 'animate_failed', 'animated'].includes(s)) return 4;
    if (['merging', 'merge_failed', 'completed'].includes(s)) return 5;
    return 0;
  };

  const currentStep = getCurrentStep();

  // 视频理解
  const handleAnalyze = async () => {
    setProcessing(true);
    setProcessMsg('AI 正在分析视频结构...');
    try {
      const resp = await authFetch(`/api/remake-pro/analyze/${projectId}`, { method: 'POST' });
      const data = await resp.json();
      if (data.success) {
        // 自动提取关键帧
        setProcessMsg('提取关键帧中...');
        const extractResp = await authFetch(`/api/remake-pro/extract-frames/${projectId}`, { method: 'POST' });
        const extractData = await extractResp.json();
        if (!extractData.success) {
          alert(extractData.error || '关键帧提取失败');
        }
        await loadProject();
      } else {
        alert(data.error || '视频理解失败');
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : '操作失败');
    } finally {
      setProcessing(false);
      setProcessMsg('');
    }
  };

  // 从产品库选择产品
  const handleProductSelect = async (selection: ProductSelection) => {
    setProcessing(true);
    setProcessMsg('加载产品图...');
    try {
      // 获取产品完整信息（含图片）- API 返回 { data: { id, name, images: [{url}], ... } }
      const resp = await authFetch(`/api/products/manage/${selection.id}`);
      if (!resp.ok) {
        console.error('[RemakePro] 获取产品详情失败:', resp.status);
        return;
      }
      const result = await resp.json();
      const productData = result.data || result;
      console.log('[RemakePro] 产品详情:', JSON.stringify(productData)?.substring(0, 500));
      if (productData?.images?.length) {
        const productImages = productData.images
          .filter((img: { url?: string }) => img.url)
          .slice(0, 7)
          .map((img: { url: string; key?: string; id?: string }) => ({
            url: img.url,
            key: img.key || extractS3Key(img.url) || img.id,
            name: productData.name || '产品图',
          }));
        
        const saveResp = await authFetch(`/api/remake-pro/projects/${projectId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ product_images: productImages }),
        });
        if (!saveResp.ok) {
          const errText = await saveResp.text();
          console.error('[RemakePro] 保存产品图失败:', saveResp.status, errText);
        }
        await loadProject();
      }
    } catch (error) {
      console.error('选择产品失败:', error);
    } finally {
      setProcessing(false);
      setProcessMsg('');
    }
  };

  // 上传产品图（本地上传）
  const handleProductUpload = async () => {
    if (productFiles.length === 0) return;
    setProcessing(true);
    setProcessMsg('上传产品图...');
    try {
      const currentImages = project?.product_images || [];
      const newImages = [...currentImages];

      for (const file of productFiles) {
        if (newImages.length >= 7) break;
        // 压缩图片
        const compressed = await compressImage(file);
        const base64 = typeof compressed === 'string' ? compressed : await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(compressed);
        });

        const resp = await authFetch('/api/upload-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image: base64,
            fileName: file.name,
            folder: `remake-pro/products/${projectId}`,
          }),
        });
        const data = await resp.json();
        if (data.success) {
          newImages.push({ key: data.data?.key || data.key, url: data.data?.url || data.url, name: file.name });
        }
      }

      const updateResp = await authFetch(`/api/remake-pro/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_images: newImages }),
      });
      const updateData = await updateResp.json();
      if (updateData.success) {
        setProductFiles([]);
        await loadProject();
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : '上传失败');
    } finally {
      setProcessing(false);
      setProcessMsg('');
    }
  };

  // 从 URL 中提取 S3 key（去掉签名参数）
  const extractS3Key = (url: string): string => {
    try {
      const u = new URL(url);
      // 路径格式: /coze_storage_xxx/实际key?sign=...
      const parts = u.pathname.split('/');
      // 去掉前两段: /coze_storage_xxx/
      const key = parts.slice(2).join('/');
      return key.split('?')[0];
    } catch {
      return '';
    }
  };

  // 从角色图库选择
  const handleCharacterSelect = async (characters: CharacterItem[]) => {
    if (characters.length === 0) return;
    const char = characters[0]; // 只取1张
    setProcessing(true);
    setProcessMsg('设置角色图...');
    try {
      let charUrl = char.url;
      let charKey = extractS3Key(char.url);
      // 如果是 base64 格式，先上传
      if (charUrl.startsWith('data:')) {
        const resp = await authFetch('/api/upload-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image: charUrl,
            fileName: `${char.name || 'character'}.jpg`,
            folder: `remake-pro/characters/${projectId}`,
          }),
        });
        const data = await resp.json();
        if (data.success) {
          charUrl = data.data?.url || data.url;
          charKey = data.data?.key || '';
        }
      }
      
      await authFetch(`/api/remake-pro/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ character_image: { url: charUrl, key: charKey, name: char.name } }),
      });
      await loadProject();
    } catch (error) {
      console.error('选择角色图失败:', error);
    } finally {
      setProcessing(false);
      setProcessMsg('');
    }
  };

  // 上传角色图（本地上传）
  const handleCharacterUpload = async () => {
    if (!characterFile) return;
    setProcessing(true);
    setProcessMsg('上传角色图...');
    try {
      const compressed = await compressImage(characterFile);
      const base64 = typeof compressed === 'string' ? compressed : await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(compressed);
      });

      const resp = await authFetch('/api/upload-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: base64,
          fileName: characterFile.name,
          folder: `remake-pro/characters/${projectId}`,
        }),
      });
      const data = await resp.json();
      if (data.success) {
        await authFetch(`/api/remake-pro/projects/${projectId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ character_image: { key: data.data?.key || data.key, url: data.data?.url || data.url, name: characterFile.name } }),
        });
        setCharacterFile(null);
        await loadProject();
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : '上传失败');
    } finally {
      setProcessing(false);
      setProcessMsg('');
    }
  };

  // 轮询项目状态直到完成
  const pollUntilComplete = async (targetStatus: string, processingStatus: string, errorMsg: string) => {
    const maxAttempts = 120; // 最多轮询10分钟（每5秒一次）
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(r => setTimeout(r, 5000));
      const resp = await authFetch(`/api/remake-pro/projects/${projectId}`);
      const data = await resp.json();
      if (data.success) {
        setProject(data.data);
        const status = data.data?.status;
        if (status === targetStatus) return data.data;
        if (status !== processingStatus) {
          // 状态变了但不是目标状态（可能是失败）
          throw new Error(data.data?.error || errorMsg);
        }
      }
    }
    throw new Error('操作超时，请稍后查看结果');
  };

  // 生成分镜图
  const handleGenerateStoryboard = async () => {
    setProcessing(true);
    setProcessMsg('AI 正在生成分镜图...');
    try {
      const resp = await authFetch(`/api/remake-pro/generate-storyboard/${projectId}`, { method: 'POST' });
      const data = await resp.json();
      if (!data.success) { alert(data.error || '分镜图生成启动失败'); return; }
      setProcessMsg('分镜图生成中，请稍候...');
      await pollUntilComplete('storyboarded', 'generating_storyboard', '分镜图生成失败');
    } catch (error) {
      alert(error instanceof Error ? error.message : '操作失败');
    } finally {
      setProcessing(false);
      setProcessMsg('');
    }
  };

  // 视频动画化
  const handleAnimate = async () => {
    setProcessing(true);
    setProcessMsg('AI 正在动画化...');
    try {
      const resp = await authFetch(`/api/remake-pro/animate/${projectId}`, { method: 'POST' });
      const data = await resp.json();
      if (!data.success) { alert(data.error || '动画化启动失败'); return; }
      setProcessMsg('视频动画化中，请稍候...');
      await pollUntilComplete('animated', 'animating', '动画化失败');
    } catch (error) {
      alert(error instanceof Error ? error.message : '操作失败');
    } finally {
      setProcessing(false);
      setProcessMsg('');
    }
  };

  // 拼接视频
  const handleMerge = async () => {
    setProcessing(true);
    setProcessMsg('拼接视频中...');
    try {
      const resp = await authFetch(`/api/remake-pro/merge/${projectId}`, { method: 'POST' });
      const data = await resp.json();
      if (!data.success) { alert(data.error || '拼接启动失败'); return; }
      setProcessMsg('视频拼接中，请稍候...');
      await pollUntilComplete('completed', 'merging', '拼接失败');
    } catch (error) {
      alert(error instanceof Error ? error.message : '操作失败');
    } finally {
      setProcessing(false);
      setProcessMsg('');
    }
  };

  // 删除产品图
  const handleRemoveProductImage = async (index: number) => {
    if (!project) return;
    const newImages = [...project.product_images];
    newImages.splice(index, 1);
    await authFetch(`/api/remake-pro/projects/${projectId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product_images: newImages }),
    });
    await loadProject();
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  if (!project) return null;

  return (
    <AppLayout>
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="shrink-0 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex items-center justify-between px-6 h-14">
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-500" />
              {project.name}
            </h1>
            <Badge variant={project.status === 'completed' ? 'default' : 'secondary'}>
              {project.status}
            </Badge>
          </div>

          {/* Steps indicator */}
          <div className="px-6 pb-3 flex items-center gap-1 overflow-x-auto">
            {STEPS.map((step, i) => {
              const isCompleted = i < currentStep;
              const isCurrent = i === currentStep;
              const Icon = step.icon;
              return (
                <div key={step.key} className="flex items-center">
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap ${
                    isCompleted ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' :
                    isCurrent ? 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300' :
                    'bg-muted text-muted-foreground'
                  }`}>
                    {isCompleted ? <CheckCircle className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                    {step.label}
                  </div>
                  {i < STEPS.length - 1 && <ArrowRight className="h-3 w-3 mx-1 text-muted-foreground" />}
                </div>
              );
            })}
          </div>
        </header>

        {/* Main content */}
        <div className="flex-1 overflow-auto p-6">
          {processing && (
            <Card className="mb-4 border-purple-200 bg-purple-50 dark:border-purple-800 dark:bg-purple-950">
              <CardContent className="flex items-center gap-3 py-4">
                <Loader2 className="h-5 w-5 animate-spin text-purple-600" />
                <span className="text-purple-700 dark:text-purple-300">{processMsg}</span>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left column: Video + Analysis */}
            <div className="space-y-4">
              {/* 原视频 */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Film className="h-4 w-4" />
                    参考视频
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {project.source_video_url ? (
                    <video
                      src={project.source_video_url}
                      controls
                      className="w-full rounded-lg max-h-[360px] bg-black"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-40 bg-muted rounded-lg">
                      <p className="text-muted-foreground">视频加载中...</p>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground mt-2">
                    时长: {project.video_duration}秒 | 段落: {project.segment_count}
                  </p>
                </CardContent>
              </Card>

              {/* 视频理解 */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Sparkles className="h-4 w-4" />
                      视频理解
                    </CardTitle>
                    {(currentStep === 1) && (
                      <Button size="sm" onClick={handleAnalyze} disabled={processing} className="bg-purple-600 hover:bg-purple-700">
                        <Sparkles className="h-3.5 w-3.5 mr-1" />
                        开始分析
                      </Button>
                    )}
                    {currentStep > 1 && (
                      <Button size="sm" variant="outline" onClick={handleAnalyze} disabled={processing}>
                        <RefreshCw className="h-3.5 w-3.5 mr-1" />
                        重新分析
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {project.scenes?.length > 0 ? (
                    <div className="space-y-2 max-h-[400px] overflow-auto">
                      {project.scenes.map((scene, i) => (
                        <div key={scene.id} className="flex gap-3 p-2 rounded-lg bg-muted/50">
                          <div className="flex-shrink-0">
                            {scene.key_frame_url ? (
                              <img src={scene.key_frame_url} alt={`场景${i}`} className="w-16 h-16 object-cover rounded" />
                            ) : (
                              <div className="w-16 h-16 bg-muted rounded flex items-center justify-center text-xs text-muted-foreground">
                                {i + 1}
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium">场景 {i + 1} - {scene.start_time?.toFixed(1)}s</p>
                            <p className="text-xs text-muted-foreground line-clamp-2">{scene.description}</p>
                            {scene.camera_movement && (
                              <Badge variant="outline" className="text-[10px] mt-1 h-4">
                                {scene.camera_movement}
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">尚未进行视频理解分析</p>
                  )}
                </CardContent>
              </Card>

              {/* 九宫格关键帧 */}
              {project.key_frame_grid_url && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Grid3X3 className="h-4 w-4" />
                      关键帧九宫格
                    </CardTitle>
                    <CardDescription>原视频9个关键场景画面</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <img src={project.key_frame_grid_url} alt="关键帧九宫格" className="w-full rounded-lg" />
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Right column: Products + Storyboard + Animation */}
            <div className="space-y-4">
              {/* 产品图/角色图 */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    产品图 & 角色图
                  </CardTitle>
                  <CardDescription>从产品库选择或上传产品图（最多7张）和角色图（1张）</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* 产品图 */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium">产品图 ({project.product_images?.length || 0}/7)</label>
                      <Button size="sm" variant="outline" onClick={() => setProductSelectorOpen(true)} disabled={processing}>
                        <Package className="h-3.5 w-3.5 mr-1" />
                        从产品库选择
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {project.product_images?.map((img, i) => (
                        <div key={i} className="relative group w-16 h-16">
                          {img.url && <img src={img.url} alt={`产品${i}`} className="w-full h-full object-cover rounded border" />}
                          <button
                            onClick={() => handleRemoveProductImage(i)}
                            className="absolute -top-1 -right-1 w-4 h-4 bg-destructive text-destructive-foreground rounded-full text-[10px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                          >
                            <Trash2 className="h-2.5 w-2.5" />
                          </button>
                        </div>
                      ))}
                      {(!project.product_images || project.product_images.length < 7) && (
                        <label className="w-16 h-16 border-2 border-dashed rounded flex items-center justify-center cursor-pointer hover:border-purple-400 transition-colors">
                          <Upload className="h-4 w-4 text-muted-foreground" />
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            onChange={(e) => {
                              const files = Array.from(e.target.files || []);
                              const remaining = 7 - (project.product_images?.length || 0);
                              setProductFiles(prev => [...prev, ...files.slice(0, remaining)]);
                            }}
                          />
                        </label>
                      )}
                    </div>
                    {productFiles.length > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{productFiles.length} 张待上传</span>
                        <Button size="sm" onClick={handleProductUpload} disabled={processing}>
                          上传
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* 角色图 */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium">角色图（可选）</label>
                      <Button size="sm" variant="outline" onClick={() => setCharacterDialogOpen(true)} disabled={processing}>
                        <User className="h-3.5 w-3.5 mr-1" />
                        从角色库选择
                      </Button>
                    </div>
                    <div className="flex items-center gap-2">
                      {project.character_image?.url ? (
                        <div className="relative group w-16 h-16">
                          <img src={project.character_image.url} alt="角色" className="w-full h-full object-cover rounded border" />
                          <button
                            onClick={async () => {
                              await authFetch(`/api/remake-pro/projects/${projectId}`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ character_image: null }),
                              });
                              await loadProject();
                            }}
                            className="absolute -top-1 -right-1 w-4 h-4 bg-destructive text-destructive-foreground rounded-full text-[10px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                          >
                            <Trash2 className="h-2.5 w-2.5" />
                          </button>
                        </div>
                      ) : (
                        <label className="w-16 h-16 border-2 border-dashed rounded flex items-center justify-center cursor-pointer hover:border-purple-400 transition-colors">
                          <Upload className="h-4 w-4 text-muted-foreground" />
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              if (e.target.files?.[0]) setCharacterFile(e.target.files[0]);
                            }}
                          />
                        </label>
                      )}
                      {characterFile && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{characterFile.name}</span>
                          <Button size="sm" onClick={handleCharacterUpload} disabled={processing}>上传</Button>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 分镜图生成 */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Grid3X3 className="h-4 w-4" />
                      分镜图
                    </CardTitle>
                    {currentStep >= 2 && currentStep <= 3 && project.product_images?.length > 0 && (
                      <Button size="sm" onClick={handleGenerateStoryboard} disabled={processing} className="bg-purple-600 hover:bg-purple-700">
                        {project.storyboard_grid_url ? (
                          <><RefreshCw className="h-3.5 w-3.5 mr-1" />重新生成</>
                        ) : (
                          <><Grid3X3 className="h-3.5 w-3.5 mr-1" />生成分镜图</>
                        )}
                      </Button>
                    )}
                  </div>
                  <CardDescription>AI 将产品/角色替换到分镜构图中</CardDescription>
                </CardHeader>
                <CardContent>
                  {project.storyboard_grid_url ? (
                    <img src={project.storyboard_grid_url} alt="分镜九宫格" className="w-full rounded-lg" />
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {project.product_images?.length > 0 ? '点击"生成分镜图"开始' : '请先添加产品图'}
                    </p>
                  )}
                  {/* 单个分镜预览 */}
                  {project.scenes?.some(s => s.storyboard_url) && (
                    <div className="grid grid-cols-3 gap-2 mt-4">
                      {project.scenes.filter(s => s.storyboard_url).map((scene, i) => (
                        <div key={scene.id} className="relative group">
                          <img src={scene.storyboard_url} alt={`分镜${i}`} className="w-full aspect-square object-cover rounded" />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded flex items-center justify-center">
                            <span className="text-white text-xs">场景 {scene.scene_index + 1}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* 动画化 */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Clapperboard className="h-4 w-4" />
                      视频动画化
                    </CardTitle>
                    {currentStep >= 4 && project.scenes?.some(s => s.status === 'storyboard_generated') && (
                      <Button size="sm" onClick={handleAnimate} disabled={processing} className="bg-purple-600 hover:bg-purple-700">
                        <Play className="h-3.5 w-3.5 mr-1" />
                        开始动画化
                      </Button>
                    )}
                  </div>
                  <CardDescription>将静态分镜图转化为动态视频</CardDescription>
                </CardHeader>
                <CardContent>
                  {project.scenes?.some(s => s.video_url) ? (
                    <div className="space-y-2">
                      {project.scenes.filter(s => s.video_url).map((scene, i) => (
                        <div key={scene.id} className="flex items-center gap-3 p-2 bg-muted/50 rounded">
                          <video src={scene.video_url} className="w-20 h-20 object-cover rounded" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium">场景 {scene.scene_index + 1}</p>
                            <p className="text-xs text-muted-foreground line-clamp-1">{scene.animate_prompt}</p>
                          </div>
                          <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                        </div>
                      ))}
                      {/* 拼接按钮 */}
                      {project.scenes?.filter(s => s.status === 'video_generated').length > 1 && !project.output_video_url && (
                        <Button onClick={handleMerge} disabled={processing} className="w-full mt-2">
                          拼接完整视频
                        </Button>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">请先生成分镜图</p>
                  )}
                </CardContent>
              </Card>

              {/* 最终输出 */}
              {project.output_video_url && (
                <Card className="border-green-200 dark:border-green-800">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2 text-green-700 dark:text-green-300">
                      <CheckCircle className="h-4 w-4" />
                      完整视频
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <video src={project.output_video_url} controls className="w-full rounded-lg max-h-[400px] bg-black" />
                    <div className="flex gap-2 mt-3">
                      <Button asChild className="flex-1 bg-green-600 hover:bg-green-700">
                        <a href={project.output_video_url} download target="_blank" rel="noopener noreferrer">
                          <Download className="h-4 w-4 mr-2" />
                          下载视频
                        </a>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>

        {/* 产品库选择器 */}
        <ProductSelector
          open={productSelectorOpen}
          onOpenChange={(open) => setProductSelectorOpen(open)}
          onSelect={handleProductSelect}
        />

        {/* 角色图库选择器 */}
        <CharacterLibraryDialog
          open={characterDialogOpen}
          onOpenChange={(open) => setCharacterDialogOpen(open)}
          onSelect={handleCharacterSelect}
        />
      </div>
    </AppLayout>
  );
}
