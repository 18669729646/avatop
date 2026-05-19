'use client';

import { useCallback, useRef, useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  PROMPT_TYPE_CONFIGS,
  checkVariablesByType,
  generatePreviewByType,
  type PromptType,
  type VariableCheckResult,
} from '@/lib/prompt-variables';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Eye,
  RotateCcw,
  Save,
  Plus,
  Info,
  Loader2,
  Star,
} from 'lucide-react';

interface PromptEditorProps {
  type: PromptType;
  initialPrompt?: string;
  initialDefaultPrompt?: string;
  onSave: (prompt: string) => Promise<void>;
  onReset?: () => Promise<void>;
  onSetDefault?: () => Promise<void>;
  isSaving?: boolean;
}

export function PromptEditor({
  type,
  initialPrompt,
  initialDefaultPrompt,
  onSave,
  onReset,
  onSetDefault,
  isSaving = false,
}: PromptEditorProps) {
  const config = PROMPT_TYPE_CONFIGS[type];
  const [prompt, setPrompt] = useState(initialPrompt || initialDefaultPrompt || config.getDefaultPrompt());
  const [showPreview, setShowPreview] = useState(false);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [insertVarOpen, setInsertVarOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 实时检查变量（使用 useMemo）
  const checkResult = useMemo(() => checkVariablesByType(prompt, type), [prompt, type]);

  // 保存处理
  const handleSave = useCallback(async () => {
    try {
      await onSave(prompt);
      setShowSaveConfirm(false);
    } catch {
      // Error handled by parent
    }
  }, [prompt, onSave]);

  // 插入变量
  const handleInsertVariable = useCallback((varName: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const insertText = `{{${varName}}}`;
    
    const newPrompt = prompt.slice(0, start) + insertText + prompt.slice(end);
    setPrompt(newPrompt);
    setInsertVarOpen(false);
    
    // 恢复光标位置
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + insertText.length, start + insertText.length);
    }, 0);
  }, [prompt]);

  return (
    <div className="space-y-4">
      {/* 变量检查状态 */}
      {checkResult && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground">变量检查：</span>
          {checkResult.isValid ? (
            <Badge variant="default" className="bg-green-600">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              所有必需变量已包含
            </Badge>
          ) : (
            <>
              {checkResult.missingRequired.length > 0 && (
                <Badge variant="destructive">
                  <XCircle className="w-3 h-3 mr-1" />
                  缺少：{checkResult.missingRequired.map(v => v.label).join('、')}
                </Badge>
              )}
              {checkResult.unknownVariables.length > 0 && (
                <Badge variant="outline" className="border-yellow-500 text-yellow-600">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  未知：{checkResult.unknownVariables.join('、')}
                </Badge>
              )}
            </>
          )}
        </div>
      )}

      {/* 工具栏 */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setInsertVarOpen(!insertVarOpen)}
        >
          <Plus className="w-4 h-4 mr-1" />
          插入变量
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowPreview(!showPreview)}
        >
          <Eye className="w-4 h-4 mr-1" />
          {showPreview ? '编辑' : '预览'}
        </Button>
        <div className="flex-1" />
        {onReset && (
          <Button
            variant="outline"
            size="sm"
            onClick={onReset}
            disabled={isSaving}
          >
            <RotateCcw className="w-4 h-4 mr-1" />
            恢复默认
          </Button>
        )}
        {onSetDefault && (
          <Button
            variant="outline"
            size="sm"
            onClick={onSetDefault}
            disabled={isSaving}
          >
            <Star className="w-4 h-4 mr-1" />
            设为默认
          </Button>
        )}
        <Button
          size="sm"
          onClick={() => {
            if (checkResult && checkResult.isValid) {
              setShowSaveConfirm(true);
            }
          }}
          disabled={isSaving || (checkResult !== null && !checkResult.isValid)}
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              保存中...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-1" />
              保存
            </>
          )}
        </Button>
      </div>

      {/* 变量插入面板 */}
      {insertVarOpen && (
        <Card>
          <CardHeader className="py-2 px-4">
            <CardTitle className="text-sm">选择要插入的变量</CardTitle>
          </CardHeader>
          <CardContent className="py-2 px-4">
            <div className="flex flex-wrap gap-2">
              {config.allVariables.map((variable) => (
                <Button
                  key={variable.name}
                  variant="outline"
                  size="sm"
                  onClick={() => handleInsertVariable(variable.name)}
                  title={variable.description}
                >
                  {variable.label}
                  {variable.required && <span className="text-red-500 ml-1">*</span>}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 编辑区 */}
      {showPreview ? (
        <Card className="p-4">
          <div className="text-sm text-muted-foreground mb-2">预览效果（变量替换为示例值）</div>
          <div className="whitespace-pre-wrap text-sm bg-muted p-4 rounded-md max-h-96 overflow-auto">
            {generatePreviewByType(prompt, type)}
          </div>
        </Card>
      ) : (
        <Textarea
          ref={textareaRef}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className="min-h-96 font-mono text-sm"
          placeholder="在此输入提示词模板..."
        />
      )}

      {/* 变量说明 */}
      <Card>
        <CardHeader className="py-2 px-4">
          <CardTitle className="text-sm flex items-center gap-1">
            <Info className="w-4 h-4" />
            可用变量说明
          </CardTitle>
        </CardHeader>
        <CardContent className="py-2 px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
            {config.allVariables.map((variable) => (
              <div key={variable.name} className="flex items-start gap-2">
                <code className="text-xs bg-muted px-1.5 py-0.5 rounded shrink-0">
                  {`{{${variable.name}}}`}
                </code>
                <span className="text-muted-foreground">
                  {variable.label}
                  {variable.required && <span className="text-red-500 ml-1">*必填</span>}
                  {variable.description && ` - ${variable.description}`}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 保存确认对话框 */}
      <Dialog open={showSaveConfirm} onOpenChange={setShowSaveConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认保存模板</DialogTitle>
            <DialogDescription>
              保存后将影响所有新创建的任务，请确认模板内容正确。
            </DialogDescription>
          </DialogHeader>
          {checkResult && (
            <div className="space-y-2">
              <div className="text-sm">
                <span className="font-medium">模板长度：</span>
                {prompt.length} 字符
              </div>
              <div className="text-sm">
                <span className="font-medium">使用变量：</span>
                {checkResult.usedRequired.length + checkResult.usedOptional.length} 个
              </div>
              {checkResult.unusedOptional.length > 0 && (
                <Alert>
                  <AlertTriangle className="w-4 h-4" />
                  <AlertDescription>
                    以下可选变量未使用：{checkResult.unusedOptional.map(v => v.label).join('、')}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveConfirm(false)}>
              取消
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  保存中...
                </>
              ) : (
                '确认保存'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
