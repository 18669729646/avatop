import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Upload, X, Loader2, Image as ImageIcon, Film } from 'lucide-react';
import { cn } from '@/lib/utils';

interface UploadZoneProps {
  label: string;
  accept: string;
  fileUrl?: string;
  uploading?: boolean;
  onFileSelect: (file: File) => void;
  onRemove?: () => void;
  hint?: string;
  autoExtract?: boolean; // 是否自动提取缩略图（仅视频）
}

export function UploadZone({
  label,
  accept,
  fileUrl,
  uploading,
  onFileSelect,
  onRemove,
  hint,
  autoExtract = false,
}: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      onFileSelect(files[0]);
    }
  }, [onFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onFileSelect(files[0]);
    }
  };

  const isVideo = fileUrl?.includes('.mp4') || fileUrl?.includes('.webm') || fileUrl?.includes('.mov');
  const isImage = fileUrl?.match(/\.(jpg|jpeg|png|gif|webp)$/i);

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {fileUrl ? (
        <div className="relative group">
          {isVideo ? (
            <video
              src={fileUrl}
              className="w-full max-w-xs h-32 object-cover rounded border"
              controls
            />
          ) : isImage ? (
            <img
              src={fileUrl}
              alt="预览"
              className="w-full max-w-xs h-32 object-cover rounded border"
            />
          ) : (
            <div className="w-full max-w-xs h-32 rounded border flex items-center justify-center bg-muted">
              <span className="text-sm text-muted-foreground">{fileUrl.substring(0, 50)}...</span>
            </div>
          )}
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="absolute top-1 right-1 w-6 h-6 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              // 触发清除逻辑
              const input = document.getElementById(`file-input-${label}`) as HTMLInputElement;
              if (input) {
                input.value = '';
              }
              // 调用父组件的删除回调
              if (onRemove) {
                onRemove();
              }
            }}
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
      ) : (
        <div
          className={cn(
            "border-2 border-dashed rounded-lg p-4 text-center transition-colors cursor-pointer",
            isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-muted-foreground/50",
            uploading && "opacity-50 cursor-not-allowed"
          )}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <input
            id={`file-input-${label}`}
            type="file"
            accept={accept}
            onChange={handleFileChange}
            disabled={uploading}
            className="hidden"
          />
          <label htmlFor={`file-input-${label}`} className="cursor-pointer">
            {uploading ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">上传中...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload className="w-6 h-6 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  拖拽文件到此处或<span className="text-primary font-medium"> 点击上传</span>
                </p>
                {hint && (
                  <p className="text-xs text-muted-foreground">{hint}</p>
                )}
              </div>
            )}
          </label>
        </div>
      )}
    </div>
  );
}
