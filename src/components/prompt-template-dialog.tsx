'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { DraggablePanel } from '@/components/ui/draggable-panel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Search, Sparkles, Plus, Heart, Copy, X,
  Flame, Clock, Video, ShoppingBag, Camera, Megaphone, Users, Tag,
  Pencil, Trash2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  PromptTemplate,
  TemplateCategory,
  TemplateType,
  CATEGORY_INFO,
  getTemplates,
  getCategories,
  renderTemplate,
  getHotTemplates,
  getFavoriteTemplatesList,
  getRecentTemplatesList,
  toggleFavorite,
  addToRecentTemplates,
  incrementUsage,
  copyToClipboard,
  deleteCustomTemplate,
} from '@/lib/prompt-templates';
import { TemplateEditor } from './template-editor';

type QuickFilter = 'all' | 'hot' | 'favorites' | 'recent';

const QUICK_FILTERS: { value: QuickFilter; label: string; icon: React.ReactNode }[] = [
  { value: 'all', label: '全部', icon: null },
  { value: 'hot', label: '热门', icon: <Flame className="w-3 h-3" /> },
  { value: 'favorites', label: '收藏', icon: <Heart className="w-3 h-3" /> },
  { value: 'recent', label: '最近', icon: <Clock className="w-3 h-3" /> },
];

// 统一的分类图标映射
const CATEGORY_ICONS: Record<TemplateCategory, React.ReactNode> = {
  product: <ShoppingBag className="w-4 h-4" />,
  video: <Video className="w-4 h-4" />,
  live: <Camera className="w-4 h-4" />,
  ad: <Megaphone className="w-4 h-4" />,
  social: <Users className="w-4 h-4" />,
  promo: <Tag className="w-4 h-4" />,
  custom: <Sparkles className="w-4 h-4" />,
};

interface PromptTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: TemplateType;
  onApply: (prompt: string, defaultParams?: PromptTemplate['defaultParams']) => void;
}

export function PromptTemplateDialog({
  open,
  onOpenChange,
  type,
  onApply,
}: PromptTemplateDialogProps) {
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all');
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory | 'all'>('all');
  const [selectedTemplate, setSelectedTemplate] = useState<PromptTemplate | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const [favorites, setFavorites] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  
  // 编辑器状态
  const [showEditor, setShowEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<PromptTemplate | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (open) {
      import('@/lib/prompt-templates').then(mod => {
        setFavorites(mod.getFavoriteTemplates());
      });
    }
  }, [open, refreshKey]);

  const categories = useMemo(() => getCategories(), []);
  const recentTemplates = useMemo(() => getRecentTemplatesList(type), [type, refreshKey]);

  const filteredTemplates = useMemo(() => {
    let templates: PromptTemplate[] = [];
    
    switch (quickFilter) {
      case 'hot': templates = getHotTemplates(type); break;
      case 'favorites': templates = getFavoriteTemplatesList(type); break;
      case 'recent': templates = recentTemplates.map(r => r.template).filter(Boolean); break;
      default: templates = getTemplates(type);
    }
    
    if (quickFilter === 'all' && selectedCategory !== 'all') {
      templates = templates.filter(t => t.category === selectedCategory);
    }
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      templates = templates.filter(t => 
        t.name.toLowerCase().includes(query) ||
        t.description.toLowerCase().includes(query) ||
        t.tags?.some(tag => tag.toLowerCase().includes(query))
      );
    }
    
    return templates;
  }, [type, quickFilter, selectedCategory, searchQuery, recentTemplates, refreshKey]);

  const handleSelectTemplate = useCallback((template: PromptTemplate) => {
    setSelectedTemplate(template);
    const values: Record<string, string> = {};
    if (template.variables) {
      template.variables.forEach(v => { values[v.key] = v.defaultValue || ''; });
    }
    setVariableValues(values);
  }, []);

  const handleVariableChange = useCallback((key: string, value: string) => {
    setVariableValues(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleToggleFavorite = useCallback((id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const isNowFavorite = toggleFavorite(id);
    setFavorites(prev => 
      isNowFavorite ? [id, ...prev.filter(f => f !== id)] : prev.filter(f => f !== id)
    );
  }, []);

  const handleCopy = useCallback(async () => {
    if (!selectedTemplate) return;
    const success = await copyToClipboard(renderTemplate(selectedTemplate, variableValues));
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [selectedTemplate, variableValues]);

  const handleApply = useCallback(() => {
    if (!selectedTemplate) return;
    const renderedPrompt = renderTemplate(selectedTemplate, variableValues);
    addToRecentTemplates(selectedTemplate.id, variableValues);
    incrementUsage(selectedTemplate.id);
    onApply(renderedPrompt, selectedTemplate.defaultParams);
    onOpenChange(false);
  }, [selectedTemplate, variableValues, onApply, onOpenChange]);

  const previewPrompt = useMemo(() => 
    selectedTemplate ? renderTemplate(selectedTemplate, variableValues) : '', 
    [selectedTemplate, variableValues]
  );

  const handleOpenChange = useCallback((newOpen: boolean) => {
    if (!newOpen) {
      setSelectedTemplate(null);
      setSearchQuery('');
      setSelectedCategory('all');
      setQuickFilter('all');
      setVariableValues({});
      setShowEditor(false);
      setEditingTemplate(null);
    }
    onOpenChange(newOpen);
  }, [onOpenChange]);

  // 新增模板
  const handleAddTemplate = useCallback(() => {
    setEditingTemplate(null);
    setShowEditor(true);
    setSelectedTemplate(null);
  }, []);

  // 编辑模板
  const handleEditTemplate = useCallback((template: PromptTemplate, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (template.isSystem) return;
    setEditingTemplate(template);
    setShowEditor(true);
  }, []);

  // 删除模板
  const handleDeleteTemplate = useCallback((template: PromptTemplate, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (template.isSystem) return;
    if (confirm(`确定要删除模板「${template.name}」吗？`)) {
      deleteCustomTemplate(template.id);
      if (selectedTemplate?.id === template.id) {
        setSelectedTemplate(null);
      }
      setRefreshKey(k => k + 1);
    }
  }, [selectedTemplate]);

  // 保存模板后
  const handleSaveTemplate = useCallback((template: PromptTemplate) => {
    setShowEditor(false);
    setEditingTemplate(null);
    setRefreshKey(k => k + 1);
    // 选中新保存的模板
    setTimeout(() => {
      handleSelectTemplate(template);
    }, 100);
  }, [handleSelectTemplate]);

  return (
    <DraggablePanel
      open={open}
      onOpenChange={handleOpenChange}
      initialWidth={950}
      initialHeight={700}
      minWidth={700}
      minHeight={500}
      title={
        <>
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold">提示词模板库</span>
          <Badge variant="secondary" className="text-[10px] ml-1">TK电商</Badge>
          <Badge variant="outline" className="text-[10px] ml-2">{filteredTemplates.length} 个模板</Badge>
        </>
      }
      contentClassName="flex"
    >
      {/* 编辑器模式 */}
      {showEditor ? (
        <div className="flex-1 flex flex-col">
          <TemplateEditor
            template={editingTemplate}
            type={type}
            onSave={handleSaveTemplate}
            onCancel={() => {
              setShowEditor(false);
              setEditingTemplate(null);
            }}
          />
        </div>
      ) : (
        <>
          {/* 左侧：模板列表 */}
          <div className="w-[280px] border-r flex flex-col shrink-0 bg-slate-50/50 dark:bg-slate-900/30">
            {/* 搜索筛选区 */}
            <div className="p-3 space-y-2.5 border-b shrink-0">
              {/* 新增按钮 */}
              <Button 
                size="sm" 
                className="w-full h-8 gap-1.5 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
                onClick={handleAddTemplate}
              >
                <Plus className="w-4 h-4" />
                新建模板
              </Button>
              
              {/* 搜索框 */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="搜索模板名称..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9 text-sm bg-white dark:bg-slate-800"
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')} 
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded p-0.5"
                  >
                    <X className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                )}
              </div>
              
              {/* 快捷筛选 */}
              <div className="flex gap-1.5">
                {QUICK_FILTERS.map(filter => (
                  <Button
                    key={filter.value}
                    variant={quickFilter === filter.value ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => { setQuickFilter(filter.value); setSelectedCategory('all'); }}
                    className={cn(
                      "flex-1 h-8 text-xs",
                      quickFilter === filter.value ? "shadow-sm" : "bg-white dark:bg-slate-800"
                    )}
                  >
                    {filter.icon && <span className="mr-1">{filter.icon}</span>}
                    {filter.label}
                  </Button>
                ))}
              </div>

              {/* 分类筛选 */}
              {quickFilter === 'all' && (
                <Select value={selectedCategory} onValueChange={(v) => setSelectedCategory(v as TemplateCategory | 'all')}>
                  <SelectTrigger className="h-8 text-xs bg-white dark:bg-slate-800">
                    <SelectValue placeholder="全部分类" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部分类</SelectItem>
                    {categories.map(cat => (
                      <SelectItem key={cat} value={cat}>
                        <span className="flex items-center gap-1.5">
                          {CATEGORY_ICONS[cat]}
                          {CATEGORY_INFO[cat].label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* 模板列表 */}
            <ScrollArea className="flex-1 h-0">
              <div className="p-2 space-y-1">
                {filteredTemplates.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-3">
                      <Search className="w-5 h-5" />
                    </div>
                    <p className="text-sm">
                      {quickFilter === 'favorites' ? '暂无收藏模板' : 
                       quickFilter === 'recent' ? '暂无使用记录' : '未找到匹配模板'}
                    </p>
                  </div>
                ) : (
                  filteredTemplates.map(template => (
                    <div
                      key={template.id}
                      onClick={() => handleSelectTemplate(template)}
                      className={cn(
                        "group p-3 rounded-lg cursor-pointer transition-all border-2",
                        selectedTemplate?.id === template.id
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-950/40 shadow-sm"
                          : "border-transparent hover:bg-white dark:hover:bg-slate-800 hover:shadow-sm"
                      )}
                    >
                      <div className="flex items-start gap-2.5">
                        <div className={cn(
                          "w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
                          selectedTemplate?.id === template.id 
                            ? "bg-blue-500 text-white" 
                            : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                        )}>
                          {CATEGORY_ICONS[template.category]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-sm truncate">{template.name}</span>
                            {template.isHot && (
                              <Flame className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                            )}
                            {!template.isSystem && (
                              <Badge variant="outline" className="text-[9px] px-1 py-0 shrink-0">自定义</Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {CATEGORY_INFO[template.category].label}
                          </p>
                        </div>
                        {/* 操作按钮 */}
                        <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          {!template.isSystem && (
                            <>
                              <button
                                type="button"
                                onClick={(e) => handleEditTemplate(template, e)}
                                className="p-1.5 rounded-md text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => handleDeleteTemplate(template, e)}
                                className="p-1.5 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            onClick={(e) => handleToggleFavorite(template.id, e)}
                            className={cn(
                              "p-1.5 rounded-md transition-all",
                              favorites.includes(template.id) 
                                ? "text-red-500 bg-red-50 dark:bg-red-950/40" 
                                : "text-slate-400 hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40"
                            )}
                          >
                            <Heart className={cn("w-3.5 h-3.5", favorites.includes(template.id) && "fill-current")} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>

          {/* 右侧：模板详情 */}
          <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-slate-900">
            {selectedTemplate ? (
              <>
                {/* 模板信息头部 */}
                <div className="p-5 border-b shrink-0 bg-gradient-to-r from-slate-50 to-white dark:from-slate-900 dark:to-slate-900">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white shrink-0">
                      {CATEGORY_ICONS[selectedTemplate.category]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-xl font-bold truncate">{selectedTemplate.name}</h3>
                        {selectedTemplate.isHot && (
                          <Badge className="bg-orange-500 hover:bg-orange-500 text-white text-[10px] px-2 py-0.5">
                            <Flame className="w-3 h-3 mr-0.5" />热门
                          </Badge>
                        )}
                        {!selectedTemplate.isSystem && (
                          <Badge variant="outline" className="text-[10px] px-2 py-0.5">自定义</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1.5">
                        <Badge variant="outline" className="text-xs">
                          {CATEGORY_INFO[selectedTemplate.category].label}
                        </Badge>
                        {selectedTemplate.tags?.slice(0, 3).map(tag => (
                          <Badge key={tag} variant="secondary" className="text-[10px]">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {!selectedTemplate.isSystem && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => handleEditTemplate(selectedTemplate, e)}
                          className="gap-1.5"
                        >
                          <Pencil className="w-4 h-4" />
                          编辑
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => handleToggleFavorite(selectedTemplate.id, e)}
                        className={cn("gap-1.5", favorites.includes(selectedTemplate.id) && "text-red-500 border-red-200 hover:bg-red-50")}
                      >
                        <Heart className={cn("w-4 h-4", favorites.includes(selectedTemplate.id) && "fill-current")} />
                        {favorites.includes(selectedTemplate.id) ? '已收藏' : '收藏'}
                      </Button>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
                    {selectedTemplate.description}
                  </p>
                </div>

                {/* 参数配置区域 - 可滚动 */}
                <ScrollArea className="flex-1 h-0">
                  <div className="p-5 space-y-6">
                    {/* 参数输入 */}
                    {selectedTemplate.variables && selectedTemplate.variables.length > 0 && (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-md bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                            <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                          </div>
                          <span className="font-semibold text-sm">填写参数</span>
                          <span className="text-xs text-muted-foreground">* 为必填项</span>
                        </div>
                        
                        <div className="space-y-4 pl-8">
                          {selectedTemplate.variables.map((variable) => (
                            <div key={variable.key} className="space-y-2">
                              <Label className="text-sm font-medium flex items-center gap-1">
                                {variable.label}
                                {variable.required && <span className="text-red-500">*</span>}
                              </Label>
                              {variable.options && variable.options.length > 0 ? (
                                <Select 
                                  value={variableValues[variable.key] || ''} 
                                  onValueChange={(v) => handleVariableChange(variable.key, v)}
                                >
                                  <SelectTrigger className="h-10 bg-slate-50 dark:bg-slate-800">
                                    <SelectValue placeholder={variable.placeholder} />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {variable.options.map(option => (
                                      <SelectItem key={option} value={option}>{option}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : (
                                <Input
                                  value={variableValues[variable.key] || ''}
                                  onChange={(e) => handleVariableChange(variable.key, e.target.value)}
                                  placeholder={variable.placeholder}
                                  className="h-10 bg-slate-50 dark:bg-slate-800"
                                />
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 提示词预览 */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-md bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center">
                            <Copy className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                          </div>
                          <span className="font-semibold text-sm">提示词预览</span>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={handleCopy} 
                          className="h-8 text-xs gap-1.5"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          {copied ? '已复制' : '复制'}
                        </Button>
                      </div>
                      
                      <div className="relative rounded-xl border bg-slate-50 dark:bg-slate-800/50 p-4 overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5" />
                        <p className="text-sm whitespace-pre-wrap leading-relaxed relative z-10">
                          {previewPrompt || <span className="text-muted-foreground italic">填写参数后查看预览</span>}
                        </p>
                      </div>

                      {/* 推荐参数 */}
                      {selectedTemplate.defaultParams && (
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-muted-foreground">推荐设置：</span>
                          {selectedTemplate.defaultParams.aspectRatio && (
                            <Badge variant="secondary" className="text-[10px]">
                              {selectedTemplate.defaultParams.aspectRatio}
                            </Badge>
                          )}
                          {selectedTemplate.defaultParams.resolution && (
                            <Badge variant="secondary" className="text-[10px]">
                              {selectedTemplate.defaultParams.resolution}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </ScrollArea>

                {/* 底部操作按钮 */}
                <div className="px-5 py-4 border-t shrink-0 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-sm">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      点击应用后将自动填充到输入框
                    </p>
                    <div className="flex items-center gap-2.5">
                      <Button 
                        variant="outline" 
                        size="default" 
                        onClick={() => handleOpenChange(false)}
                        className="px-5"
                      >
                        取消
                      </Button>
                      <Button 
                        size="default" 
                        onClick={handleApply}
                        className="px-5 gap-2 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
                      >
                        <Plus className="w-4 h-4" />
                        应用模板
                      </Button>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              /* 空状态 */
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center max-w-xs">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 flex items-center justify-center mx-auto mb-4">
                    <Sparkles className="w-8 h-8 text-slate-400" />
                  </div>
                  <h4 className="font-medium text-base mb-1">选择模板开始</h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    从左侧列表选择一个模板，或点击"新建模板"创建自定义模板
                  </p>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </DraggablePanel>
  );
}
