'use client';

import { useState, useCallback } from 'react';
import { Copy, Download, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { authFetch } from '@/lib/auth-context';

interface ScriptRemakeDetail {
  id: string;
  project_id?: string;
  product_id?: string;
  status: string;
  title?: string;
  hook?: string;
  pain_point?: string;
  selling_point_script?: string;
  cta?: string;
  full_script?: string;
  segments?: Array<{
    order: number;
    durationSec: number;
    scene: string;
    voiceover: string;
    action: string;
    productPlacement: string;
    camera: string;
    onScreenText: string;
  }>;
  product_analysis?: {
    productCategory: string;
    visualFeatures: string;
    coreSellingPoints: string;
    targetAudienceFit: string;
    usageScenarioFit: string;
    visualSellingPoints: string;
    rewriteStrategy: string;
  };
  shooting_notes?: string;
  visual_notes?: string;
  compliance_notes?: string;
  error?: string;
  created_at: string;
}

interface ScriptRemakeDetailModalProps {
  scriptRemake: ScriptRemakeDetail | null;
  open: boolean;
  onClose: () => void;
}

export function ScriptRemakeDetailModal({ scriptRemake, open, onClose }: ScriptRemakeDetailModalProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const handleCopy = useCallback(async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text || '');
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error('复制失败:', err);
    }
  }, []);

  const handleExport = useCallback(async () => {
    if (!scriptRemake?.id) return;
    setExporting(true);
    try {
      const response = await authFetch('/api/analysis-master/script-remake/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scriptId: scriptRemake.id }),
      });

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `script-remake-${scriptRemake.id.slice(-8)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('导出失败:', err);
    } finally {
      setExporting(false);
    }
  }, [scriptRemake]);

  const getCopyAllText = useCallback(() => {
    if (!scriptRemake) return '';
    const { product_analysis } = scriptRemake;
    return [
      '【标题】',
      scriptRemake.title,
      '',
      '【开头钩子】',
      scriptRemake.hook,
      '',
      '【痛点场景】',
      scriptRemake.pain_point,
      '',
      '【核心卖点】',
      scriptRemake.selling_point_script,
      '',
      '【CTA】',
      scriptRemake.cta,
      '',
      '【完整口播】',
      scriptRemake.full_script,
      '',
      '【产品分析】',
      product_analysis ? [
        `品类: ${product_analysis.productCategory}`,
        `视觉特征: ${product_analysis.visualFeatures}`,
        `核心卖点: ${product_analysis.coreSellingPoints}`,
        `受众匹配: ${product_analysis.targetAudienceFit}`,
        `使用场景: ${product_analysis.usageScenarioFit}`,
        `视觉卖点: ${product_analysis.visualSellingPoints}`,
        `复刻策略: ${product_analysis.rewriteStrategy}`,
      ].filter(line => !line.endsWith(': ')).join('\n') : '',
      '',
      '【分镜脚本】',
      (scriptRemake.segments || []).map(seg =>
        `${seg.order}. ${seg.durationSec}秒｜画面：${seg.scene}｜口播：${seg.voiceover}｜动作：${seg.action}`
      ).join('\n'),
      '',
      '【拍摄建议】',
      scriptRemake.shooting_notes,
      '',
      '【视觉展示建议】',
      scriptRemake.visual_notes,
      '',
      '【合规注意】',
      scriptRemake.compliance_notes,
    ].filter(Boolean).join('\n');
  }, [scriptRemake]);

  if (!scriptRemake) return null;

  const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    pending: { label: '排队中', color: 'text-yellow-600', icon: <Loader2 className="w-4 h-4 animate-spin" /> },
    running: { label: '生成中', color: 'text-blue-600', icon: <Loader2 className="w-4 h-4 animate-spin" /> },
    completed: { label: '已完成', color: 'text-green-600', icon: <CheckCircle2 className="w-4 h-4" /> },
    failed: { label: '失败', color: 'text-red-600', icon: <AlertCircle className="w-4 h-4" /> },
  };

  const status = statusConfig[scriptRemake.status] || statusConfig.pending;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
              <span>脚本复刻详情</span>
              <span className={`flex items-center gap-1 text-sm font-normal ${status.color}`}>
                {status.icon}
                {status.label}
              </span>
            </DialogTitle>
          <p className="text-xs text-muted-foreground">
            创建时间：{new Date(scriptRemake.created_at).toLocaleString('zh-CN')}
          </p>
        </DialogHeader>

        {scriptRemake.status === 'failed' ? (
          <div className="flex-1 flex items-center justify-center text-destructive">
            <AlertCircle className="w-8 h-8 mr-2" />
            <span>脚本生成失败，请重试</span>
          </div>
        ) : scriptRemake.status === 'pending' || scriptRemake.status === 'running' ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground mr-2" />
            <span className="text-muted-foreground">{status.label}...</span>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto -mx-6 px-6">
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-md border p-3 bg-muted/30">
                  <div className="text-xs text-muted-foreground mb-1">标题</div>
                  <div className="font-medium">{scriptRemake.title}</div>
                </div>
                <div className="rounded-md border p-3 bg-muted/30">
                  <div className="text-xs text-muted-foreground mb-1">开头钩子</div>
                  <div className="font-medium">{scriptRemake.hook}</div>
                </div>
                <div className="rounded-md border p-3 bg-muted/30">
                  <div className="text-xs text-muted-foreground mb-1">痛点场景</div>
                  <div>{scriptRemake.pain_point}</div>
                </div>
                <div className="rounded-md border p-3 bg-muted/30">
                  <div className="text-xs text-muted-foreground mb-1">核心卖点</div>
                  <div>{scriptRemake.selling_point_script}</div>
                </div>
                <div className="rounded-md border p-3 bg-muted/30">
                  <div className="text-xs text-muted-foreground mb-1">CTA</div>
                  <div>{scriptRemake.cta}</div>
                </div>
              </div>

              {scriptRemake.product_analysis && Object.values(scriptRemake.product_analysis).some(v => v) && (
                <div className="rounded-md border">
                  <div className="px-3 py-2 border-b bg-muted/50">
                    <span className="text-xs font-medium text-muted-foreground">产品分析</span>
                  </div>
                  <div className="p-3 space-y-2 text-sm">
                    {scriptRemake.product_analysis.productCategory && (
                      <div><span className="text-muted-foreground">品类：</span>{scriptRemake.product_analysis.productCategory}</div>
                    )}
                    {scriptRemake.product_analysis.visualFeatures && (
                      <div><span className="text-muted-foreground">视觉特征：</span>{scriptRemake.product_analysis.visualFeatures}</div>
                    )}
                    {scriptRemake.product_analysis.coreSellingPoints && (
                      <div><span className="text-muted-foreground">核心卖点：</span>{scriptRemake.product_analysis.coreSellingPoints}</div>
                    )}
                    {scriptRemake.product_analysis.usageScenarioFit && (
                      <div><span className="text-muted-foreground">使用场景：</span>{scriptRemake.product_analysis.usageScenarioFit}</div>
                    )}
                  </div>
                </div>
              )}

              <div className="rounded-md border">
                <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/50">
                  <span className="text-xs font-medium text-muted-foreground">完整口播</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs"
                    onClick={() => handleCopy(scriptRemake.full_script || '', 'fullScript')}
                  >
                    {copiedField === 'fullScript' ? <CheckCircle2 className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
                    {copiedField === 'fullScript' ? '已复制' : '复制'}
                  </Button>
                </div>
                <div className="p-3 text-sm whitespace-pre-wrap">{scriptRemake.full_script}</div>
              </div>

              {(scriptRemake.segments || []).length > 0 && (
                <div className="rounded-md border">
                  <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/50">
                    <span className="text-xs font-medium text-muted-foreground">分镜脚本</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs"
                      onClick={() => {
                        const text = (scriptRemake.segments || []).map(seg =>
                          `${seg.order}. ${seg.durationSec}秒｜画面：${seg.scene}｜口播：${seg.voiceover}｜动作：${seg.action}`
                        ).join('\n');
                        handleCopy(text, 'segments');
                      }}
                    >
                      {copiedField === 'segments' ? <CheckCircle2 className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
                      {copiedField === 'segments' ? '已复制' : '复制'}
                    </Button>
                  </div>
                  <div className="p-3 space-y-3">
                    {(scriptRemake.segments || []).map((seg) => (
                      <div key={seg.order} className="rounded-md bg-muted/30 p-3">
                        <div className="text-xs font-medium mb-2">#{seg.order} {seg.durationSec}秒</div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div><span className="text-muted-foreground">画面：</span>{seg.scene}</div>
                          <div><span className="text-muted-foreground">口播：</span>{seg.voiceover}</div>
                          <div><span className="text-muted-foreground">动作：</span>{seg.action}</div>
                          <div><span className="text-muted-foreground">镜头：</span>{seg.camera}</div>
                          {seg.onScreenText && (
                            <div className="col-span-2"><span className="text-muted-foreground">屏幕文字：</span>{seg.onScreenText}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {scriptRemake.shooting_notes && (
                <div className="rounded-md border">
                  <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/50">
                    <span className="text-xs font-medium text-muted-foreground">拍摄建议</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs"
                      onClick={() => handleCopy(scriptRemake.shooting_notes || '', 'shootingNotes')}
                    >
                      {copiedField === 'shootingNotes' ? <CheckCircle2 className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
                      {copiedField === 'shootingNotes' ? '已复制' : '复制'}
                    </Button>
                  </div>
                  <div className="p-3 text-sm whitespace-pre-wrap">{scriptRemake.shooting_notes}</div>
                </div>
              )}

              {scriptRemake.visual_notes && (
                <div className="rounded-md border">
                  <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/50">
                    <span className="text-xs font-medium text-muted-foreground">视觉展示建议</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs"
                      onClick={() => handleCopy(scriptRemake.visual_notes || '', 'visualNotes')}
                    >
                      {copiedField === 'visualNotes' ? <CheckCircle2 className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
                      {copiedField === 'visualNotes' ? '已复制' : '复制'}
                    </Button>
                  </div>
                  <div className="p-3 text-sm whitespace-pre-wrap">{scriptRemake.visual_notes}</div>
                </div>
              )}

              <div className="rounded-md border bg-green-500/5 border-green-500/30">
                <div className="px-3 py-2 border-b bg-green-500/10">
                  <span className="text-xs font-medium text-green-600">合规注意</span>
                </div>
                <div className="p-3 text-sm whitespace-pre-wrap">{scriptRemake.compliance_notes || '无'}</div>
              </div>
            </div>
          </div>
        )}

        {scriptRemake.status === 'completed' && (
          <div className="flex-shrink-0 flex items-center justify-end gap-2 pt-4 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleCopy(getCopyAllText(), 'all')}
            >
              {copiedField === 'all' ? <CheckCircle2 className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
              {copiedField === 'all' ? '已复制' : '复制全部'}
            </Button>
            <Button
              size="sm"
              onClick={handleExport}
              disabled={exporting}
            >
              {exporting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Download className="w-4 h-4 mr-1" />}
              导出Excel
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
