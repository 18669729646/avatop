'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { 
  FileText, Search, Check, Clock, User, Trash2, 
  Sparkles, Film, Package
} from 'lucide-react';
import { 
  Template,
  getTemplates,
  deleteTemplate,
  searchTemplates,
} from '@/lib/template-library';
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
import { Loader2 } from 'lucide-react';

interface TemplateSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (template: Template) => void;
  selectedTemplateId?: string;
  title?: string;
  description?: string;
}

export function TemplateSelector({
  open,
  onOpenChange,
  onSelect,
  selectedTemplateId,
  title = '选择模板',
  description = '从模板库中选择一个模板，模板内容将自动带入脚本生成',
}: TemplateSelectorProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [localSelectedId, setLocalSelectedId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Template | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // 加载模板列表
  useEffect(() => {
    if (open) {
      // 使用 setTimeout 避免同步 setState
      setTimeout(() => setIsLoading(true), 0);
      getTemplates()
        .then(data => {
          // 确保返回的是数组
          if (Array.isArray(data)) {
            setTemplates(data);
          } else {
            console.error('[TemplateSelector] getTemplates returned non-array:', data);
            setTemplates([]);
          }
        })
        .catch(error => {
          console.error('[TemplateSelector] Failed to load templates:', error);
          setTemplates([]);
        })
        .finally(() => {
          setTimeout(() => setIsLoading(false), 0);
        });
      setTimeout(() => setLocalSelectedId(selectedTemplateId || null), 0);
    }
  }, [open, selectedTemplateId]);

  // 搜索过滤
  const filteredTemplates = searchQuery.trim() 
    ? templates.filter(t => {
        const lowerQuery = searchQuery.toLowerCase();
        return t.name.toLowerCase().includes(lowerQuery) ||
               t.description.toLowerCase().includes(lowerQuery) ||
               (t.productInfo?.toLowerCase().includes(lowerQuery) ?? false);
      })
    : templates;

  // 选择模板
  const handleSelect = (template: Template) => {
    setLocalSelectedId(template.id);
    onSelect(template);
    onOpenChange(false);
  };

  // 删除模板
  const handleDelete = async (template: Template) => {
    await deleteTemplate(template.id);
    setTemplates(await getTemplates());
    setDeleteConfirm(null);
  };

  // 格式化时间
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            {title}
          </DialogTitle>
          <DialogDescription>
            {description}
          </DialogDescription>
        </DialogHeader>

        {/* 搜索栏 */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="搜索模板名称、产品信息..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* 模板列表 */}
        <ScrollArea className="flex-1 -mx-6">
          <div className="px-6 pb-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">加载中...</span>
              </div>
            ) : filteredTemplates.length > 0 ? (
              <div className="space-y-3">
                {filteredTemplates.map((template) => {
                  const isSelected = localSelectedId === template.id;
                  
                  return (
                    <Card
                      key={template.id}
                      className={`cursor-pointer transition-all hover:border-blue-300 ${
                        isSelected 
                          ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/50 dark:bg-blue-950/20' 
                          : 'border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div 
                            className="flex-1 min-w-0 cursor-pointer"
                            onClick={() => handleSelect(template)}
                          >
                            <div className="flex items-center gap-2 mb-2">
                              <h4 className="font-medium truncate">{template.name}</h4>
                              {isSelected && (
                                <Badge className="bg-blue-500">已选择</Badge>
                              )}
                            </div>
                            
                            <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                              {template.description}
                            </p>
                            
                            <div className="flex flex-wrap gap-2 mb-2">
                              <Badge variant="outline" className="text-xs">
                                <Film className="w-3 h-3 mr-1" />
                                {template.duration}s
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {template.segments.length}段
                              </Badge>
                              {template.useCreator && (
                                <Badge variant="secondary" className="text-xs">
                                  <User className="w-3 h-3 mr-1" />
                                  {template.creatorGender === 'female' ? '女性达人' : 
                                   template.creatorGender === 'male' ? '男性达人' : '达人出境'}
                                </Badge>
                              )}
                              {template.usageCount > 0 && (
                                <Badge variant="outline" className="text-xs">
                                  使用{template.usageCount}次
                                </Badge>
                              )}
                            </div>
                            
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {formatDate(template.createdAt)}
                              </span>
                              {template.productInfo && (
                                <span className="flex items-center gap-1 truncate max-w-[200px]">
                                  <Package className="w-3 h-3" />
                                  {template.productInfo.substring(0, 30)}...
                                </span>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex flex-col gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleSelect(template)}
                            >
                              <Check className="w-4 h-4 mr-1" />
                              使用
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-500 hover:text-red-600 hover:bg-red-50"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteConfirm(template);
                              }}
                            >
                              <Trash2 className="w-4 h-4 mr-1" />
                              删除
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Sparkles className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">暂无模板</p>
                <p className="text-xs mt-1">使用AI生成模板后会自动保存在这里</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>

      {/* 删除确认对话框 */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除模板？</AlertDialogTitle>
            <AlertDialogDescription>
              即将删除模板「{deleteConfirm?.name}」，此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction 
              className="bg-red-500 hover:bg-red-600"
              onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
            >
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
