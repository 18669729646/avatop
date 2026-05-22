'use client';

import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ProductSelector } from './product-selector';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import type { ProductSelection } from '@/lib/products';
import { authFetch } from '@/lib/auth-context';
import { copyToClipboard } from '@/lib/prompt-templates';
import { Sparkles, Loader2, Copy, FileSpreadsheet } from 'lucide-react';

export interface ScriptRemakeSegment {
  order: number;
  durationSec: number;
  scene: string;
  voiceover: string;
  voiceoverCn?: string;
  action: string;
  productPlacement: string;
  camera: string;
  onScreenText: string;
  onScreenTextCn?: string;
}

export interface ScriptRemakeResult {
  id: string;
  projectId: string;
  productId: string;
  title: string;
  hook: string;
  painPoint: string;
  sellingPointScript: string;
  cta: string;
  fullScript: string;
  fullScriptCn?: string;
  segments: ScriptRemakeSegment[];
  shootingNotes: string;
  visualNotes: string;
  complianceNotes: string;
}

interface AnalysisProject {
  id: string;
  name: string;
  status: string;
  result?: unknown;
}

const TIKTOK_LANGUAGES = [
  { value: 'zh-CN', label: '中文' },
  { value: 'en-US', label: '英语（美国）' },
  { value: 'en-GB', label: '英语（英国）' },
  { value: 'ja-JP', label: '日语' },
  { value: 'ko-KR', label: '韩语' },
  { value: 'id-ID', label: '印尼语' },
  { value: 'th-TH', label: '泰语' },
  { value: 'vi-VN', label: '越南语' },
  { value: 'ms-MY', label: '马来语' },
  { value: 'fil-PH', label: '菲律宾语' },
  { value: 'fr-FR', label: '法语' },
  { value: 'de-DE', label: '德语' },
  { value: 'es-ES', label: '西班牙语（西班牙）' },
  { value: 'it-IT', label: '意大利语' },
  { value: 'pt-BR', label: '葡萄牙语（巴西）' },
  { value: 'es-MX', label: '西班牙语（墨西哥）' },
  { value: 'ru-RU', label: '俄语' },
  { value: 'ar-SA', label: '阿拉伯语' },
  { value: 'hi-IN', label: '印地语' },
  { value: 'tr-TR', label: '土耳其语' },
];

interface ScriptRemakePanelProps {
  selectedProject: AnalysisProject | undefined;
  isAdmin?: boolean;
}

export function ScriptRemakePanel({ selectedProject, isAdmin = false }: ScriptRemakePanelProps) {
  const [selectedProduct, setSelectedProduct] = useState<ProductSelection | null>(null);
  const [showProductSelector, setShowProductSelector] = useState(false);
  const [scriptRemakeResult, setScriptRemakeResult] = useState<ScriptRemakeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const [currentScriptRemakeId, setCurrentScriptRemakeId] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [loadingExisting, setLoadingExisting] = useState(false);
  // 新增：额外要求输入
  const [extraRequirements, setExtraRequirements] = useState('');
  // 管理员预览状态
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<Record<string, unknown> | null>(null);
  const [generating, setGenerating] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('en-US');

  const canGenerate = selectedProject?.status === 'completed' &&
                      selectedProject?.result &&
                      selectedProduct;

  // 查询项目的最新脚本复刻记录
  const loadExistingScriptRemake = async (projectId: string) => {
    setLoadingExisting(true);
    try {
      const response = await authFetch(`/api/analysis-master/script-remake?projectId=${projectId}`, {
        method: 'GET',
      });
      const result = await response.json();
      console.log('[Script Remake Panel] 加载已有脚本响应:', {
        success: result.success,
        hasData: !!result.data,
        dataLength: result.data?.length,
        firstItem: result.data?.[0]
      });
      
      if (result.success && result.data && result.data.length > 0) {
        // 取最新的一个
        const latestScript = result.data[0];
        
        // 保存脚本ID和任务ID（不管状态如何）
        setCurrentScriptRemakeId(latestScript.id);
        setCurrentTaskId(`sr-task-${latestScript.id}`);
        
        if (latestScript.status === 'completed') {
          const segments = Array.isArray(latestScript.segments) ? latestScript.segments : [];
          
          console.log('[Script Remake Panel] 设置脚本结果:', {
            id: latestScript.id,
            title: latestScript.title,
            hasSegments: segments.length > 0
          });
          
          // 从 productSnapshot 恢复 selectedProduct
          if (latestScript.product_snapshot) {
            const ps = latestScript.product_snapshot;
            const allImages = Array.isArray(ps.images) 
              ? ps.images.map((img: { key?: string; url?: string }, idx: number) => ({
                  key: img.key || `image-${idx}`,
                  url: img.url || '',
                }))
              : [];
            setSelectedProduct({
              id: ps.id || latestScript.product_id,
              name: ps.name || '',
              description: ps.description || '',
              sellingPoints: Array.isArray(ps.selling_points) ? ps.selling_points : [],
              targetAudience: ps.target_audience || '',
              usageScenarios: ps.usage_scenarios || '',
              brandInfo: ps.brand_info || '',
              priceRange: ps.price_range || '',
              keywords: Array.isArray(ps.keywords) ? ps.keywords : [],
              primaryImage: allImages.length > 0 ? allImages[0].url : '',
              allImages,
            });
          }
          
          setScriptRemakeResult({
            id: latestScript.id,
            projectId: latestScript.projectId,
            productId: latestScript.productId,
            title: latestScript.title || '',
            hook: latestScript.hook || '',
            painPoint: latestScript.pain_point || '',
            sellingPointScript: latestScript.selling_point_script || '',
            cta: latestScript.cta || '',
            fullScript: latestScript.full_script || '',
            fullScriptCn: latestScript.full_script_cn || '',
            segments: segments.map((seg: Record<string, unknown>, index: number) => ({
              order: typeof seg.order === 'number' ? seg.order : index + 1,
              durationSec: typeof seg.durationSec === 'number' ? seg.durationSec : 8,
              scene: String(seg.scene || ''),
              voiceover: String(seg.voiceover || ''),
              voiceoverCn: String(seg.voiceoverCn || seg.voiceover_cn || ''),
              action: String(seg.action || ''),
              productPlacement: String(seg.productPlacement || ''),
              camera: String(seg.camera || ''),
              onScreenText: String(seg.onScreenText || ''),
              onScreenTextCn: String(seg.onScreenTextCn || seg.onScreenText_cn || ''),
            })),
            shootingNotes: latestScript.shooting_notes || '',
            visualNotes: latestScript.visual_notes || '',
            complianceNotes: latestScript.compliance_notes || '',
          });
        } else if (latestScript.status === 'pending' || latestScript.status === 'running') {
          // 如果有进行中的任务，设置为 loading 状态，开始轮询
          setLoading(true);
          setGenerating(true);
          pollScriptRemakeStatus(latestScript.id, (attempt, retry) => {
            setPollProgress({ attempt, retry });
            setRetryCount(retry);
          });
        }
        // 如果是其他状态（如 failed），不设置结果，显示空表单
      }
    } catch (err) {
      console.error('[Script Remake Panel] 加载已有脚本失败:', err);
    } finally {
      setLoadingExisting(false);
    }
  };

  // 当项目变化时，清空脚本复刻结果并查询最新记录
  const [prevProjectId, setPrevProjectId] = useState<string | null>(null);
  
  React.useEffect(() => {
    if (selectedProject?.id && selectedProject.id !== prevProjectId) {
      if (prevProjectId !== null) {
        // 项目已切换，清空所有状态
        setScriptRemakeResult(null);
        setError('');
        setSelectedProduct(null);
        setCurrentTaskId(null);
        setCurrentScriptRemakeId(null);
        setRetryCount(0);
        setExtraRequirements('');
      }
      setPrevProjectId(selectedProject.id);
      
      // 查询该项目的最新脚本复刻记录
      if (selectedProject.status === 'completed' && selectedProject.result) {
        loadExistingScriptRemake(selectedProject.id);
      }
    }
  }, [selectedProject?.id, prevProjectId]);

  const handleProductSelect = (product: ProductSelection) => {
    setSelectedProduct(product);
    setShowProductSelector(false);
    setScriptRemakeResult(null);
    setError('');
    setCurrentTaskId(null);
  };

  // 轮询配置：5分钟超时，间隔2秒，最大150次
  const POLL_INTERVAL_MS = 2000;
  const MAX_POLL_ATTEMPTS = 150;
  const MAX_AUTO_RETRY = 5;

  const pollScriptRemakeStatus = async (
    scriptRemakeId: string,
    onProgress: (attempt: number, retry: number) => void
  ): Promise<ScriptRemakeResult | { status: 'timeout' | 'failed'; error?: string; scriptRemakeId?: string } | null> => {
    let retry = 0;

    while (retry <= MAX_AUTO_RETRY) {
      for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
        onProgress(attempt, retry);

        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));

        try {
          const response = await authFetch(`/api/analysis-master/script-remake?id=${scriptRemakeId}`, {
            method: 'GET',
          });

          const result = await response.json();
          if (result.success && result.data) {
            const data = result.data;
            if (data.status === 'completed') {
              const segments = Array.isArray(data.segments) ? data.segments : [];

              return {
                id: data.id,
                projectId: data.project_id,
                productId: data.product_id,
                title: data.title || '',
                hook: data.hook || '',
                painPoint: data.pain_point || '',
                sellingPointScript: data.selling_point_script || '',
                cta: data.cta || '',
                fullScript: data.full_script || '',
                fullScriptCn: data.full_script_cn || '',
                segments: segments.map((seg: Record<string, unknown>, index: number) => ({
                  order: typeof seg.order === 'number' ? seg.order : index + 1,
                  durationSec: typeof seg.durationSec === 'number' ? seg.durationSec : 8,
                  scene: String(seg.scene || ''),
                  voiceover: String(seg.voiceover || ''),
                  voiceoverCn: String(seg.voiceoverCn || seg.voiceover_cn || ''),
                  action: String(seg.action || ''),
                  productPlacement: String(seg.productPlacement || ''),
                  camera: String(seg.camera || ''),
                  onScreenText: String(seg.onScreenText || ''),
                  onScreenTextCn: String(seg.onScreenTextCn || seg.onScreenText_cn || ''),
                })),
                shootingNotes: data.shooting_notes || '',
                visualNotes: data.visual_notes || '',
                complianceNotes: data.compliance_notes || '',
              };
            } else if (data.status === 'failed') {
              return { status: 'failed', error: data.error || '脚本生成失败', scriptRemakeId };
            }
          }
        } catch (err) {
          console.error(`[Script Remake Panel] 轮询失败: ${(err as Error).message}`);
        }
      }

      // 单次轮询超时，自动重试
      retry++;
      if (retry <= MAX_AUTO_RETRY) {
        console.log(`[Script Remake Panel] 第${retry}次自动重试...`);
        setRetryCount(retry);
      }
    }

    return { status: 'timeout', scriptRemakeId };
  };

  // 进度状态
  const [pollProgress, setPollProgress] = useState({ attempt: 0, retry: 0 });

  // 管理员：确认执行生成
  const confirmGenerate = async () => {
    setShowPreview(false);
    const data = previewData as { scriptRemakeId: string } | null;
    if (!data?.scriptRemakeId) return;

    setCurrentScriptRemakeId(data.scriptRemakeId);
    setCurrentTaskId(`sr-task-${data.scriptRemakeId}`);
    setGenerating(true);
    setLoading(true);

    try {
      const pollResult = await pollScriptRemakeStatus(data.scriptRemakeId, (attempt, retry) => {
        setPollProgress({ attempt, retry });
        setRetryCount(retry);
        setGenerating(true);
      });

      if (pollResult && 'id' in pollResult) {
        setScriptRemakeResult(pollResult);
      } else if (pollResult && pollResult.status === 'failed') {
        setError(pollResult.error || '脚本生成失败');
      } else {
        setError('脚本生成超时，已达最大重试次数');
      }
    } catch (err) {
      setError((err as Error).message || '脚本生成失败');
    } finally {
      setLoading(false);
      setGenerating(false);
      setPreviewData(null);
    }
  };

  const handleGenerate = async (manualRetryScriptId?: string) => {
    if (!selectedProject?.id || !selectedProduct) return;

    setError('');
    setScriptRemakeResult(null);
    setRetryCount(0);
    setPollProgress({ attempt: 0, retry: 0 });

    // 如果是手动重试，直接用之前的 scriptRemakeId 轮询
    if (manualRetryScriptId) {
      setCurrentScriptRemakeId(manualRetryScriptId);
      setCurrentTaskId(`sr-task-${manualRetryScriptId}`);
      setLoading(true);
      setGenerating(true);

      try {
        const result = await pollScriptRemakeStatus(manualRetryScriptId, (attempt, retry) => {
          setPollProgress({ attempt, retry });
          setRetryCount(retry);
          setGenerating(true);
        });

        if (result && 'id' in result) {
          setScriptRemakeResult(result);
        } else if (result && result.status === 'failed') {
          setError(result.error || '脚本生成失败');
        } else {
          setError('脚本生成超时，已达最大重试次数');
        }
      } finally {
        setLoading(false);
      }
      return;
    }

    // 构建请求体
    const requestBody = {
      projectId: selectedProject.id,
      productId: selectedProduct.id,
      language: selectedLanguage,
      includeChinese: true,
      extraRequirements: extraRequirements.trim() || undefined,
    };

    // 管理员：先预览请求体
    if (isAdmin) {
      setLoading(true);
      try {
        const previewRes = await authFetch('/api/analysis-master/script-remake/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });
        const previewResult = await previewRes.json();
        if (!previewRes.ok) throw new Error(previewResult.error || '预览失败');
        setPreviewData({ ...requestBody, scriptRemakeId: previewResult.data?.scriptRemakeId });
        setShowPreview(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : '预览失败');
      } finally {
        setLoading(false);
      }
      return;
    }

    // 非管理员：直接发送请求
    setLoading(true);
    setGenerating(true);
    try {
      const response = await authFetch('/api/analysis-master/script-remake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const result = await response.json();
      if (!result.success) {
        setError(result.error || '脚本生成失败');
        setGenerating(false);
        setLoading(false);
        return;
      }

      const taskId = result.data.taskId;
      const scriptRemakeId = result.data.scriptRemakeId;
      setCurrentTaskId(taskId);
      setCurrentScriptRemakeId(scriptRemakeId);

      const pollResult = await pollScriptRemakeStatus(scriptRemakeId, (attempt, retry) => {
        setPollProgress({ attempt, retry });
        setRetryCount(retry);
        setGenerating(true);
      });

      if (pollResult && 'id' in pollResult) {
        setScriptRemakeResult(pollResult);
      } else if (pollResult && pollResult.status === 'failed') {
        setError(pollResult.error || '脚本生成失败');
      } else {
        setError('脚本生成超时，已达最大重试次数');
      }
    } catch (err) {
      setError((err as Error).message || '脚本生成失败');
    } finally {
      setLoading(false);
      setGenerating(false);
    }
  };

  // 手动重试
  const handleManualRetry = () => {
    if (currentScriptRemakeId) {
      handleGenerate(currentScriptRemakeId);
    }
  };

  const handleExport = async () => {
    if (!scriptRemakeResult) return;

    try {
      const response = await authFetch('/api/analysis-master/script-remake/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scriptId: scriptRemakeResult.id }),
      });

      if (!response.ok) {
        throw new Error('导出失败');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `script-remake-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert((err as Error).message || '导出失败');
    }
  };

  const handleCopy = async (text: string, fieldName: string) => {
    await copyToClipboard(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleCopyAll = () => {
    if (!scriptRemakeResult) return;

    const currentLangLabel = TIKTOK_LANGUAGES.find(l => l.value === selectedLanguage)?.label || '目标语言';

    const segmentsText = scriptRemakeResult.segments
      .map(seg => `${seg.order}. ${seg.durationSec}秒｜画面：${seg.scene}｜口播：${seg.voiceover}｜动作：${seg.action}`)
      .join('\n');

    const segmentsTextCn = scriptRemakeResult.segments
      .map(seg => `${seg.order}. ${seg.durationSec}秒｜画面：${seg.scene}｜口播：${seg.voiceoverCn || seg.voiceover}｜动作：${seg.action}`)
      .join('\n');

    const allText = `【标题】\n${scriptRemakeResult.title || ''}\n\n【开头钩子】\n${scriptRemakeResult.hook || ''}\n\n【痛点场景】\n${scriptRemakeResult.painPoint || ''}\n\n【核心卖点】\n${scriptRemakeResult.sellingPointScript || ''}\n\n【CTA】\n${scriptRemakeResult.cta || ''}\n\n【完整口播】(${currentLangLabel})\n${scriptRemakeResult.fullScript || ''}\n\n【完整口播】(中文)\n${scriptRemakeResult.fullScriptCn || ''}\n\n【分镜脚本】(${currentLangLabel})\n${segmentsText}\n\n【分镜脚本】(中文)\n${segmentsTextCn}\n\n【拍摄建议】\n${scriptRemakeResult.shootingNotes || ''}\n\n【视觉展示建议】\n${scriptRemakeResult.visualNotes || ''}\n\n【合规注意】\n${scriptRemakeResult.complianceNotes || ''}`;

    handleCopy(allText, 'all');
  };

  return (
    <>
      <Card className="shadow-sm border-purple-500/30 bg-purple-500/5">
        <CardHeader className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-500" />
          <CardTitle className="text-base">脚本复刻</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {selectedProject?.status !== 'completed' && (
            <div className="text-sm text-muted-foreground text-center py-4">
              <div className="text-yellow-500 mb-1">请先完成视频反推</div>
              <div>完成分析后即可使用脚本复刻功能</div>
            </div>
          )}

          {selectedProject?.status === 'completed' && selectedProject?.result !== undefined && selectedProject?.result !== null && (
            <div className="space-y-4">
              {!selectedProduct ? (
                <div className="text-center py-4">
                  <Button
                    onClick={() => setShowProductSelector(true)}
                    className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    选择产品
                  </Button>
                  <div className="text-sm text-muted-foreground mt-2">选择一个产品以生成复刻脚本</div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-lg border p-3 bg-muted/50">
                    <div className="flex items-center gap-3">
                      {selectedProduct.allImages.length > 0 ? (
                        <img
                          src={selectedProduct.allImages[0].url}
                          alt={selectedProduct.name}
                          className="w-16 h-16 object-cover rounded-lg"
                        />
                      ) : (
                        <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center">
                          <div className="text-xs text-muted-foreground">无图片</div>
                        </div>
                      )}
                      <div className="flex-1">
                        <div className="font-medium">{selectedProduct.name}</div>
                        <div className="text-xs text-muted-foreground">
                          卖点: {selectedProduct.sellingPoints.length}个 | 关键词: {selectedProduct.keywords.length}个
                        </div>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => setShowProductSelector(true)}>
                        更换
                      </Button>
                    </div>
                  </div>

                  {(!selectedProduct.allImages || selectedProduct.allImages.length === 0) && (
                    <div className="text-sm text-yellow-600 bg-yellow-500/10 rounded-md p-3 border border-yellow-500/30">
                      ⚠️ 该产品未上传图片，AI将主要基于文字信息仿写
                    </div>
                  )}

                  {error && (
                    <div className="space-y-2">
                      <div className="text-sm text-destructive bg-destructive/10 rounded-md p-3">{error}</div>
                      {currentScriptRemakeId && (
                        <Button
                          onClick={handleManualRetry}
                          variant="outline"
                          className="w-full"
                        >
                          <Sparkles className="w-4 h-4 mr-2" />
                          手动重试
                        </Button>
                      )}
                    </div>
                  )}

                  {loadingExisting ? (
                    <div className="text-center py-4">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto text-purple-500" />
                      <div className="text-sm text-muted-foreground mt-2">加载已有脚本...</div>
                    </div>
                  ) : !scriptRemakeResult ? (
                    <>
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <Label htmlFor="language-select" className="text-sm">
                            选择口播语言
                          </Label>
                          <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
                            <SelectTrigger id="language-select">
                              <SelectValue placeholder="选择语言" />
                            </SelectTrigger>
                            <SelectContent>
                              {TIKTOK_LANGUAGES.map(lang => (
                                <SelectItem key={lang.value} value={lang.value}>
                                  {lang.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="extra-requirements" className="text-sm flex justify-between">
                            <span>额外要求（可选）</span>
                            <span className="text-muted-foreground text-xs">{extraRequirements.length}/500</span>
                          </Label>
                          <Textarea
                            id="extra-requirements"
                            placeholder="输入对脚本的额外要求，如：强调某个卖点、使用特定风格的表达等..."
                            value={extraRequirements}
                            onChange={(e) => setExtraRequirements(e.target.value.slice(0, 500))}
                            rows={3}
                            className="resize-none text-sm"
                          />
                        </div>
                        <Button
                          onClick={() => handleGenerate()}
                          disabled={loading || !canGenerate}
                          className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                        >
                          {loading ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              提交任务...
                            </>
                          ) : generating ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              生成中 ({Math.floor(pollProgress.attempt * 2)}s){retryCount > 0 && ` - 重试${retryCount}/${MAX_AUTO_RETRY}`}
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-4 h-4 mr-2" />
                              生成复刻脚本
                            </>
                          )}
                        </Button>
                      </div>
                      {generating && (
                        <div className="space-y-1">
                          <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                            <div
                              className="bg-gradient-to-r from-purple-600 to-pink-600 h-full transition-all duration-1000"
                              style={{ width: `${Math.min((pollProgress.attempt / MAX_POLL_ATTEMPTS) * 100, 100)}%` }}
                            />
                          </div>
                          <div className="text-xs text-muted-foreground text-center">
                            任务已提交，后台生成中{retryCount > 0 && `（自动重试第${retryCount}次）`}，请勿关闭页面
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="space-y-3">
                        <div className="flex gap-2">
                          <Button onClick={handleCopyAll} variant="outline" className="flex-1">
                            <Copy className="w-4 h-4 mr-2" />
                            {copiedField === 'all' ? '已复制' : '复制全部'}
                          </Button>
                          <Button onClick={handleExport} className="flex-1 bg-green-600 hover:bg-green-700">
                            <FileSpreadsheet className="w-4 h-4 mr-2" />
                            导出Excel
                          </Button>
                        </div>
                        <Button
                          onClick={() => {
                            setScriptRemakeResult(null);
                            setSelectedProduct(null);
                          }}
                          variant="outline"
                          className="w-full"
                        >
                          <Sparkles className="w-4 h-4 mr-2" />
                          重新复刻
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="rounded-md border p-3 bg-muted/30">
                          <div className="text-xs text-muted-foreground mb-1">标题</div>
                          <div className="font-medium">{scriptRemakeResult.title}</div>
                        </div>
                        <div className="rounded-md border p-3 bg-muted/30">
                          <div className="text-xs text-muted-foreground mb-1">开头钩子</div>
                          <div className="font-medium">{scriptRemakeResult.hook}</div>
                        </div>
                        <div className="rounded-md border p-3 bg-muted/30">
                          <div className="text-xs text-muted-foreground mb-1">痛点场景</div>
                          <div>{scriptRemakeResult.painPoint}</div>
                        </div>
                        <div className="rounded-md border p-3 bg-muted/30">
                          <div className="text-xs text-muted-foreground mb-1">核心卖点</div>
                          <div>{scriptRemakeResult.sellingPointScript}</div>
                        </div>
                        <div className="rounded-md border p-3 bg-muted/30 sm:col-span-2">
                          <div className="text-xs text-muted-foreground mb-1">CTA</div>
                          <div>{scriptRemakeResult.cta}</div>
                        </div>
                      </div>

                      <div className="rounded-md border">
                        <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/50">
                          <span className="text-xs font-medium text-muted-foreground">完整口播</span>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleCopy(scriptRemakeResult.fullScript, 'fullScript')}
                              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition"
                            >
                              <Copy className="w-3 h-3" />
                              {copiedField === 'fullScript' ? '已复制' : '复制'}
                            </button>
                            <button
                              onClick={() => handleCopy(scriptRemakeResult.fullScriptCn || '', 'fullScriptCn')}
                              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition"
                            >
                              <Copy className="w-3 h-3" />
                              {copiedField === 'fullScriptCn' ? '已复制' : '复制(中文)'}
                            </button>
                          </div>
                        </div>
                        <div className="p-3 space-y-4">
                          <div>
                            <div className="text-xs font-medium text-muted-foreground mb-1">目标语言</div>
                            <div className="text-sm whitespace-pre-wrap max-h-32 overflow-auto">{scriptRemakeResult.fullScript}</div>
                          </div>
                          {scriptRemakeResult.fullScriptCn && (
                            <div>
                              <div className="text-xs font-medium text-muted-foreground mb-1">中文</div>
                              <div className="text-sm whitespace-pre-wrap max-h-32 overflow-auto">{scriptRemakeResult.fullScriptCn}</div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="rounded-md border">
                        <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/50">
                          <span className="text-xs font-medium text-muted-foreground">分镜脚本</span>
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                const segmentsText = scriptRemakeResult.segments
                                  .map(seg => `${seg.order}. ${seg.durationSec}秒｜画面：${seg.scene}｜口播：${seg.voiceover}｜动作：${seg.action}`)
                                  .join('\n');
                                handleCopy(segmentsText, 'segments');
                              }}
                              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition"
                            >
                              <Copy className="w-3 h-3" />
                              {copiedField === 'segments' ? '已复制' : '复制'}
                            </button>
                            <button
                              onClick={() => {
                                const segmentsTextCn = scriptRemakeResult.segments
                                  .map(seg => `${seg.order}. ${seg.durationSec}秒｜画面：${seg.scene}｜口播：${seg.voiceoverCn || seg.voiceover}｜动作：${seg.action}`)
                                  .join('\n');
                                handleCopy(segmentsTextCn, 'segmentsCn');
                              }}
                              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition"
                            >
                              <Copy className="w-3 h-3" />
                              {copiedField === 'segmentsCn' ? '已复制' : '复制(中文)'}
                            </button>
                          </div>
                        </div>
                        <div className="p-3 space-y-3 max-h-80 overflow-auto">
                          {scriptRemakeResult.segments.map(seg => (
                            <div key={seg.order} className="rounded-md bg-muted/30 p-3">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge variant="secondary" className="text-xs">场景 {seg.order}</Badge>
                                <span className="text-xs text-muted-foreground">{seg.durationSec}秒</span>
                              </div>
                              <div className="space-y-2 text-sm">
                                <div><span className="text-muted-foreground">画面：</span>{seg.scene}</div>
                                <div><span className="text-muted-foreground">口播：</span>{seg.voiceover}</div>
                                {seg.voiceoverCn && <div><span className="text-muted-foreground">口播(中)：</span>{seg.voiceoverCn}</div>}
                                <div><span className="text-muted-foreground">动作：</span>{seg.action}</div>
                                <div><span className="text-muted-foreground">镜头：</span>{seg.camera}</div>
                                {seg.onScreenText && <div><span className="text-muted-foreground">屏幕文字：</span>{seg.onScreenText}</div>}
                                {seg.onScreenTextCn && <div><span className="text-muted-foreground">屏幕文字(中)：</span>{seg.onScreenTextCn}</div>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-md border">
                        <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/50">
                          <span className="text-xs font-medium text-muted-foreground">拍摄建议</span>
                          <button
                            onClick={() => handleCopy(scriptRemakeResult.shootingNotes, 'shootingNotes')}
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition"
                          >
                            <Copy className="w-3 h-3" />
                            {copiedField === 'shootingNotes' ? '已复制' : '复制'}
                          </button>
                        </div>
                        <div className="p-3 text-sm whitespace-pre-wrap">{scriptRemakeResult.shootingNotes}</div>
                      </div>

                      {scriptRemakeResult.visualNotes && (
                        <div className="rounded-md border">
                          <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/50">
                            <span className="text-xs font-medium text-muted-foreground">视觉展示建议</span>
                            <button
                              onClick={() => handleCopy(scriptRemakeResult.visualNotes, 'visualNotes')}
                              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition"
                            >
                              <Copy className="w-3 h-3" />
                              {copiedField === 'visualNotes' ? '已复制' : '复制'}
                            </button>
                          </div>
                          <div className="p-3 text-sm whitespace-pre-wrap">{scriptRemakeResult.visualNotes}</div>
                        </div>
                      )}

                      <div className="rounded-md border bg-green-500/5 border-green-500/30">
                        <div className="px-3 py-2 border-b bg-green-500/10">
                          <span className="text-xs font-medium text-green-700">合规注意</span>
                        </div>
                        <div className="p-3 text-sm text-muted-foreground">{scriptRemakeResult.complianceNotes}</div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <ProductSelector
        open={showProductSelector}
        onOpenChange={setShowProductSelector}
        onSelect={handleProductSelect}
        title="选择产品"
        description="选择一个产品以生成复刻脚本"
      />

      {/* 管理员预览弹窗 */}
      <Dialog open={showPreview} onOpenChange={(open) => { if (!open) { setShowPreview(false); setPreviewData(null); } }}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>管理员预览 - 确认生成请求</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4">
            {previewData && (
              <>
                <div>
                  <div className="text-sm font-medium text-muted-foreground mb-2">POST 请求体</div>
                  <pre className="text-xs bg-muted p-3 rounded-lg overflow-x-auto whitespace-pre-wrap">
                    {JSON.stringify(previewData, null, 2)}
                  </pre>
                </div>
              </>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setShowPreview(false); setPreviewData(null); }}>
              取消
            </Button>
            <Button onClick={confirmGenerate} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  生成中...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  确认执行
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
