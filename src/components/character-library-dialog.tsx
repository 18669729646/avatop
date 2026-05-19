'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Upload, Image as ImageIcon, Trash2, Check, Loader2, User, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { authFetch } from '@/lib/auth-context';
import { compressImage } from '@/lib/image-utils';
import { toast } from 'sonner';
import {
  getCharacterLibrary,
  addToCharacterLibrary,
  removeFromCharacterLibrary,
  CharacterItem,
} from '@/lib/history';

interface CharacterLibraryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (characters: CharacterItem[]) => void;
  selectedIds?: string[];
}

export function CharacterLibraryDialog({
  open,
  onOpenChange,
  onSelect,
  selectedIds = [],
}: CharacterLibraryDialogProps) {
  const [characters, setCharacters] = useState<CharacterItem[]>([]);
  const [internalSelectedIds, setInternalSelectedIds] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [newCharacterName, setNewCharacterName] = useState('');
  const prevOpenRef = useRef(false);

  // 迁移 base64 图片到对象存储
  const migrateBase64Images = async (items: CharacterItem[]): Promise<CharacterItem[]> => {
    const migratedItems: CharacterItem[] = [];
    let hasChanges = false;

    for (const item of items) {
      if (item.url.startsWith('data:')) {
        // base64 格式，需要迁移
        try {
          const response = await authFetch('/api/upload-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              image: item.url,
              fileName: `${item.name || 'character'}.jpg`,
              folder: 'shortfilm/characters',
            }),
          });
          const data = await response.json();
          if (data.success && data.url) {
            migratedItems.push({ ...item, url: data.url });
            hasChanges = true;
            console.log('[CharacterLibrary] Migrated base64 image to URL:', item.name);
          } else {
            // 上传失败，跳过该图片
            console.error('[CharacterLibrary] Failed to migrate base64 image:', data.error);
          }
        } catch (error) {
          // 上传异常，跳过该图片
          console.error('[CharacterLibrary] Failed to migrate base64 image:', error);
        }
      } else {
        migratedItems.push(item);
      }
    }

    // 如果有迁移，更新服务器存储（通过删除旧记录、添加新记录的方式）
    if (hasChanges) {
      console.log('[CharacterLibrary] Base64 images migrated to object storage');
    }

    return migratedItems;
  };

  // 加载角色图库
  const loadCharacters = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      console.log('[CharacterLibrary] 开始加载角色图库');
      const result = await getCharacterLibrary();
      const items = Array.isArray(result) ? result : result.data;
      console.log('[CharacterLibrary] 加载完成，角色数量:', items.length);
      
      // 检查是否有 base64 图片需要迁移
      const hasBase64 = items.some(item => item.url.startsWith('data:'));
      if (hasBase64) {
        console.log('[CharacterLibrary] 检测到 base64 图片，开始迁移');
        const migratedItems = await migrateBase64Images(items);
        setCharacters(migratedItems);
      } else {
        setCharacters(items);
      }
      setInternalSelectedIds(selectedIds);
    } catch (error) {
      console.error('[CharacterLibrary] 加载失败:', error);
      setLoadError(error instanceof Error ? error.message : '加载角色图库失败');
      setCharacters([]);
    } finally {
      setIsLoading(false);
    }
  }, [selectedIds]);

  // 加载角色图库 - 只在对话框打开时同步
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      loadCharacters();
    }
    prevOpenRef.current = open;
  }, [open, loadCharacters]);

  // 上传新角色图片到对象存储（优化版：使用 FormData 二进制上传）
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      // 并行上传所有图片
      const uploadPromises = Array.from(files).map(async (file) => {
        // 压缩图片到 2K（2048px）以内，质量 100%
        const compressedBlob = await compressImage(file, {
          maxWidth: 2048,
          maxHeight: 2048,
          quality: 1,
        });
        
        // 使用 FormData 二进制上传
        const formData = new FormData();
        formData.append('file', compressedBlob, file.name);
        formData.append('folder', 'shortfilm/characters');
        formData.append('fileName', `shortfilm/characters/${Date.now()}_${file.name}`);
        
        const response = await authFetch('/api/upload-image', {
          method: 'POST',
          body: formData,
        });

        const data = await response.json();
        if (data.success && data.url) {
          const name = newCharacterName || file.name.replace(/\.[^/.]+$/, '');
          return { name, url: data.url };
        }
        return null;
      });

      const uploadResults = await Promise.all(uploadPromises);
      const successItems = uploadResults.filter((item): item is { name: string; url: string } => item !== null);
      
      // 批量添加到角色库
      if (successItems.length > 0) {
        const response = await authFetch('/api/characters', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ characters: successItems }),
        });
        const data = await response.json();
        if (!data.data) {
          console.error('[CharacterLibrary] 添加到角色库失败:', data.error);
          throw new Error(data.error || '添加到角色库失败');
        }
      }
      
      // 刷新图库（强制刷新缓存）
      const result = await getCharacterLibrary(true); // 强制刷新
      const updatedCharacters = Array.isArray(result) ? result : result.data;
      setCharacters(updatedCharacters);
      setNewCharacterName('');
      
      // 显示成功提示
      toast.success(`成功上传 ${successItems.length} 张达人图`);
    } catch (error) {
      console.error('Upload failed:', error);
      toast.error(error instanceof Error ? error.message : '上传失败，请重试');
    } finally {
      setIsUploading(false);
    }
  };

  // 删除角色图片
  const handleDelete = async (id: string) => {
    await removeFromCharacterLibrary(id);
    const result = await getCharacterLibrary(true); // 强制刷新
    const updatedCharacters = Array.isArray(result) ? result : result.data;
    setCharacters(updatedCharacters);
  };

  // 切换选择
  const toggleSelect = (id: string) => {
    setInternalSelectedIds(prev =>
      prev.includes(id)
        ? prev.filter(i => i !== id)
        : [...prev, id]
    );
  };

  // 确认选择
  const handleConfirm = () => {
    const selectedCharacters = characters.filter(c => internalSelectedIds.includes(c.id));
    onSelect(selectedCharacters);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>角色图库</DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex flex-col gap-4 min-h-0">
          {/* 上传区域 */}
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <Label className="text-xs">角色名称（可选）</Label>
              <Input
                value={newCharacterName}
                onChange={(e) => setNewCharacterName(e.target.value)}
                placeholder="输入角色名称"
                className="mt-1"
              />
            </div>
            <label className="cursor-pointer">
              <Button variant="outline" disabled={isUploading} asChild>
                <span>
                  {isUploading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4 mr-2" />
                  )}
                  上传图片
                </span>
              </Button>
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleUpload}
                disabled={isUploading}
              />
            </label>
          </div>

          {/* 图片列表 */}
          <div className="flex-1 min-h-0">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <Loader2 className="w-12 h-12 mb-2 animate-spin" />
                <p className="text-sm">加载中...</p>
              </div>
            ) : loadError ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <AlertCircle className="w-12 h-12 mb-2 opacity-50 text-red-500" />
                <p className="text-sm text-red-500 mb-2">加载失败</p>
                <p className="text-xs mb-4">{loadError}</p>
                <Button variant="outline" size="sm" onClick={() => {
                  setLoadError(null);
                  loadCharacters();
                }}>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  重试
                </Button>
              </div>
            ) : characters.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <User className="w-12 h-12 mb-2 opacity-50" />
                <p className="text-sm">暂无角色图片</p>
                <p className="text-xs">上传图片以添加到角色图库</p>
              </div>
            ) : (
              <ScrollArea className="h-full">
                <div className="grid grid-cols-4 gap-3 pr-4">
                  {characters.map(character => (
                    <div
                      key={character.id}
                      className={cn(
                        "relative group rounded-lg border-2 overflow-hidden cursor-pointer transition-all",
                        internalSelectedIds.includes(character.id)
                          ? "border-purple-500 ring-2 ring-purple-500/30"
                          : "border-transparent hover:border-slate-200"
                      )}
                      onClick={() => toggleSelect(character.id)}
                    >
                      <img
                        src={character.url}
                        alt={character.name}
                        loading="lazy"
                        className="w-full aspect-square object-cover"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <div className="text-white text-xs text-center px-1 truncate">
                          {character.name}
                        </div>
                      </div>
                      {internalSelectedIds.includes(character.id) && (
                        <div className="absolute top-1 right-1 w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(character.id);
                        }}
                        className="absolute top-1 left-1 w-5 h-5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleConfirm} disabled={internalSelectedIds.length === 0}>
            确认选择 ({internalSelectedIds.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
