'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Plus, Trash2, Save, X, GripVertical, HelpCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  PromptTemplate,
  TemplateCategory,
  TemplateType,
  TemplateVariable,
  CATEGORY_INFO,
  addCustomTemplate,
  updateCustomTemplate,
} from '@/lib/prompt-templates';

const CATEGORY_ICONS: Record<TemplateCategory, string> = {
  product: '📦',
  video: '🎬',
  live: '📺',
  ad: '📢',
  social: '📱',
  promo: '🎉',
  custom: '⭐',
};

interface TemplateEditorProps {
  template?: PromptTemplate | null;
  type: TemplateType;
  onSave: (template: PromptTemplate) => void;
  onCancel: () => void;
}

export function TemplateEditor({ template, type, onSave, onCancel }: TemplateEditorProps) {
  const isEditing = !!template && !template.isSystem;
  
  // 表单状态
  const [name, setName] = useState(template?.name || '');
  const [description, setDescription] = useState(template?.description || '');
  const [category, setCategory] = useState<TemplateCategory>(template?.category || 'custom');
  const [templateType, setTemplateType] = useState<TemplateType>(template?.type || type);
  const [prompt, setPrompt] = useState(template?.prompt || '');
  const [variables, setVariables] = useState<TemplateVariable[]>(template?.variables || []);
  const [tags, setTags] = useState<string[]>(template?.tags || []);
  const [tagInput, setTagInput] = useState('');
  
  // 默认参数
  const [aspectRatio, setAspectRatio] = useState(template?.defaultParams?.aspectRatio || 'auto');
  const [resolution, setResolution] = useState(template?.defaultParams?.resolution || 'auto');
  
  // 错误提示
  const [errors, setErrors] = useState<Record<string, string>>({});

  // 添加变量
  const addVariable = () => {
    setVariables([
      ...variables,
      {
        key: `var_${Date.now()}`,
        label: '',
        placeholder: '',
        required: false,
      },
    ]);
  };

  // 更新变量
  const updateVariable = (
    index: number, 
    field: keyof TemplateVariable, 
    value: string | boolean | string[] | undefined
  ) => {
    const newVariables = [...variables];
    newVariables[index] = { ...newVariables[index], [field]: value };
    setVariables(newVariables);
  };

  // 删除变量
  const removeVariable = (index: number) => {
    setVariables(variables.filter((_, i) => i !== index));
  };

  // 添加标签
  const addTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  // 删除标签
  const removeTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  // 验证表单
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!name.trim()) newErrors.name = '请输入模板名称';
    if (!description.trim()) newErrors.description = '请输入模板描述';
    if (!prompt.trim()) newErrors.prompt = '请输入提示词模板';
    
    // 验证变量
    variables.forEach((v, i) => {
      if (!v.key.trim()) newErrors[`var_key_${i}`] = '变量名不能为空';
      if (!v.label.trim()) newErrors[`var_label_${i}`] = '标签不能为空';
    });
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 保存模板
  const handleSave = () => {
    if (!validate()) return;
    
    const templateData = {
      name: name.trim(),
      description: description.trim(),
      category,
      type: templateType,
      prompt: prompt.trim(),
      variables: variables.length > 0 ? variables : undefined,
      tags: tags.length > 0 ? tags : undefined,
      defaultParams: (aspectRatio !== 'auto' || resolution !== 'auto') ? {
        aspectRatio: aspectRatio !== 'auto' ? aspectRatio : undefined,
        resolution: resolution !== 'auto' ? resolution : undefined,
      } : undefined,
    };
    
    let savedTemplate: PromptTemplate;
    
    if (isEditing && template) {
      savedTemplate = updateCustomTemplate(template.id, templateData) || template;
    } else {
      savedTemplate = addCustomTemplate(templateData);
    }
    
    onSave(savedTemplate);
  };

  // 预览提示词
  const previewPrompt = () => {
    let result = prompt;
    variables.forEach(v => {
      result = result.replace(new RegExp(`\\{\\{${v.key}\\}\\}`, 'g'), `[${v.label}]`);
    });
    return result;
  };

  return (
    <div className="flex flex-col h-full">
      {/* 头部 */}
      <div className="px-5 py-3 border-b shrink-0 flex items-center justify-between bg-slate-50/50">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold">{isEditing ? '编辑模板' : '新建模板'}</h3>
          {template?.isSystem && <Badge variant="secondary" className="text-[10px]">系统模板不可编辑</Badge>}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onCancel}>
            <X className="w-4 h-4 mr-1" />
            取消
          </Button>
          <Button size="sm" onClick={handleSave} disabled={template?.isSystem}>
            <Save className="w-4 h-4 mr-1" />
            保存
          </Button>
        </div>
      </div>

      {/* 内容 */}
      <ScrollArea className="flex-1 h-0">
        <div className="p-5 space-y-5">
          {/* 基本信息 */}
          <div className="space-y-4">
            <h4 className="font-medium text-sm flex items-center gap-1.5">
              <span className="w-5 h-5 rounded bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-xs">1</span>
              基本信息
            </h4>
            
            <div className="grid grid-cols-2 gap-4 pl-7">
              <div className="space-y-2">
                <Label className="text-sm">模板名称 *</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="例如：产品主图白底"
                  className={cn(errors.name && "border-red-500")}
                />
                {errors.name && <p className="text-xs text-red-500">{errors.name}</p>}
              </div>
              
              <div className="space-y-2">
                <Label className="text-sm">分类</Label>
                <Select value={category} onValueChange={(v) => setCategory(v as TemplateCategory)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORY_INFO).map(([key, info]) => (
                      <SelectItem key={key} value={key}>
                        {CATEGORY_ICONS[key as TemplateCategory]} {info.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="col-span-2 space-y-2">
                <Label className="text-sm">描述 *</Label>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="简要描述模板用途"
                  className={cn(errors.description && "border-red-500")}
                />
                {errors.description && <p className="text-xs text-red-500">{errors.description}</p>}
              </div>
              
              <div className="space-y-2">
                <Label className="text-sm">适用类型</Label>
                <Select value={templateType} onValueChange={(v) => setTemplateType(v as TemplateType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="image">仅图片</SelectItem>
                    <SelectItem value="video">仅视频</SelectItem>
                    <SelectItem value="both">图片和视频</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label className="text-sm">标签</Label>
                <div className="flex gap-1.5 flex-wrap mb-1.5">
                  {tags.map(tag => (
                    <Badge key={tag} variant="secondary" className="text-[10px] gap-1">
                      {tag}
                      <button onClick={() => removeTag(tag)} className="hover:text-red-500">
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-1">
                  <Input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    placeholder="添加标签"
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                    className="h-8 text-sm"
                  />
                  <Button size="sm" variant="outline" onClick={addTag} className="h-8 px-2">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* 提示词模板 */}
          <div className="space-y-4">
            <h4 className="font-medium text-sm flex items-center gap-1.5">
              <span className="w-5 h-5 rounded bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-xs">2</span>
              提示词模板
              <span title="使用 {{变量名}} 定义变量">
                <HelpCircle className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
              </span>
            </h4>
            
            <div className="pl-7 space-y-3">
              <div className="space-y-2">
                <Label className="text-sm">提示词 *</Label>
                <Textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="输入提示词模板，使用 {{变量名}} 定义变量&#10;例如：{{product_name}}产品主图，纯白背景，专业摄影"
                  rows={4}
                  className={cn("resize-none", errors.prompt && "border-red-500")}
                />
                {errors.prompt && <p className="text-xs text-red-500">{errors.prompt}</p>}
              </div>
              
              {/* 预览 */}
              {prompt && (
                <div className="space-y-1.5">
                  <Label className="text-sm text-muted-foreground">预览效果</Label>
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg text-sm">
                    {previewPrompt()}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 变量定义 */}
          <div className="space-y-4">
            <div className="flex items-center justify-between pl-7">
              <h4 className="font-medium text-sm flex items-center gap-1.5">
                <span className="w-5 h-5 rounded bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-xs">3</span>
                变量定义
                <span className="text-xs text-muted-foreground font-normal">（可选）</span>
              </h4>
              <Button size="sm" variant="outline" onClick={addVariable} className="h-7 text-xs">
                <Plus className="w-3.5 h-3.5 mr-1" />
                添加变量
              </Button>
            </div>
            
            {variables.length > 0 && (
              <div className="pl-7 space-y-3">
                {variables.map((v, i) => (
                  <div key={i} className="p-3 border rounded-lg space-y-3 bg-slate-50/50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <GripVertical className="w-4 h-4 cursor-grab" />
                        变量 {i + 1}
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeVariable(i)}
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-red-500"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">变量名 *</Label>
                        <Input
                          value={v.key}
                          onChange={(e) => updateVariable(i, 'key', e.target.value)}
                          placeholder="product_name"
                          className={cn("h-8 text-sm", errors[`var_key_${i}`] && "border-red-500")}
                        />
                        {errors[`var_key_${i}`] && <p className="text-[10px] text-red-500">{errors[`var_key_${i}`]}</p>}
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">显示标签 *</Label>
                        <Input
                          value={v.label}
                          onChange={(e) => updateVariable(i, 'label', e.target.value)}
                          placeholder="产品名称"
                          className={cn("h-8 text-sm", errors[`var_label_${i}`] && "border-red-500")}
                        />
                        {errors[`var_label_${i}`] && <p className="text-[10px] text-red-500">{errors[`var_label_${i}`]}</p>}
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">输入提示</Label>
                        <Input
                          value={v.placeholder}
                          onChange={(e) => updateVariable(i, 'placeholder', e.target.value)}
                          placeholder="请输入产品名称"
                          className="h-8 text-sm"
                        />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">默认值</Label>
                        <Input
                          value={v.defaultValue || ''}
                          onChange={(e) => updateVariable(i, 'defaultValue', e.target.value)}
                          placeholder="可选"
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">预设选项</Label>
                        <Input
                          value={v.options?.join(', ') || ''}
                          onChange={(e) => updateVariable(i, 'options', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                          placeholder="选项1, 选项2, ..."
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="flex items-end pb-1">
                        <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                          <input
                            type="checkbox"
                            checked={v.required}
                            onChange={(e) => updateVariable(i, 'required', e.target.checked)}
                            className="rounded"
                          />
                          必填
                        </label>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 默认参数 */}
          <div className="space-y-4">
            <h4 className="font-medium text-sm flex items-center gap-1.5">
              <span className="w-5 h-5 rounded bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-xs">4</span>
              默认参数
              <span className="text-xs text-muted-foreground font-normal">（可选）</span>
            </h4>
            
            <div className="grid grid-cols-2 gap-4 pl-7">
              <div className="space-y-2">
                <Label className="text-sm">推荐比例</Label>
                <Select value={aspectRatio} onValueChange={setAspectRatio}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择比例" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">不指定</SelectItem>
                    <SelectItem value="1:1">1:1 正方形</SelectItem>
                    <SelectItem value="4:5">4:5 竖图</SelectItem>
                    <SelectItem value="9:16">9:16 全屏竖图</SelectItem>
                    <SelectItem value="16:9">16:9 横图</SelectItem>
                    <SelectItem value="3:4">3:4 竖图</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label className="text-sm">推荐分辨率</Label>
                <Select value={resolution} onValueChange={setResolution}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择分辨率" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">不指定</SelectItem>
                    <SelectItem value="1K">1K</SelectItem>
                    <SelectItem value="2K">2K</SelectItem>
                    <SelectItem value="4K">4K</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
