'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DraggablePanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  /** 初始宽度 */
  initialWidth?: number;
  /** 初始高度 */
  initialHeight?: number;
  /** 最小宽度 */
  minWidth?: number;
  /** 最小高度 */
  minHeight?: number;
  /** 最大宽度占视口比例 */
  maxWidthRatio?: number;
  /** 最大高度占视口比例 */
  maxHeightRatio?: number;
  /** 内容区域的 className */
  contentClassName?: string;
}

type ResizeDirection = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

export function DraggablePanel({
  open,
  onOpenChange,
  title,
  children,
  initialWidth = 900,
  initialHeight = 700,
  minWidth = 600,
  minHeight = 400,
  maxWidthRatio = 0.95,
  maxHeightRatio = 0.95,
  contentClassName,
}: DraggablePanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  
  // 面板位置和尺寸
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [size, setSize] = useState({ width: initialWidth, height: initialHeight });
  
  // 拖拽状态
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeDirection, setResizeDirection] = useState<ResizeDirection | null>(null);
  
  // 拖拽起始位置
  const dragStart = useRef({ x: 0, y: 0, panelX: 0, panelY: 0 });
  const resizeStart = useRef({ x: 0, y: 0, width: 0, height: 0, panelX: 0, panelY: 0 });

  // 初始化位置（居中）
  useEffect(() => {
    if (open && typeof window !== 'undefined') {
      const maxX = window.innerWidth * maxWidthRatio;
      const maxY = window.innerHeight * maxHeightRatio;
      const width = Math.min(initialWidth, maxX);
      const height = Math.min(initialHeight, maxY);
      
      // 使用 setTimeout 避免同步 setState
      setTimeout(() => {
        setPosition({
          x: (window.innerWidth - width) / 2,
          y: (window.innerHeight - height) / 2,
        });
        setSize({ width, height });
      }, 0);
    }
  }, [open, initialWidth, initialHeight, maxWidthRatio, maxHeightRatio]);

  // 拖拽移动
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button, input, select, [data-resize-handle]')) return;
    
    e.preventDefault();
    setIsDragging(true);
    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      panelX: position.x,
      panelY: position.y,
    };
  }, [position]);

  // 调整大小
  const handleResizeMouseDown = useCallback((e: React.MouseEvent, direction: ResizeDirection) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    setResizeDirection(direction);
    resizeStart.current = {
      x: e.clientX,
      y: e.clientY,
      width: size.width,
      height: size.height,
      panelX: position.x,
      panelY: position.y,
    };
  }, [size, position]);

  // 全局鼠标事件
  useEffect(() => {
    if (!isDragging && !isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const deltaX = e.clientX - dragStart.current.x;
        const deltaY = e.clientY - dragStart.current.y;
        
        let newX = dragStart.current.panelX + deltaX;
        let newY = dragStart.current.panelY + deltaY;
        
        // 边界限制
        const maxX = window.innerWidth - 100;
        const maxY = window.innerHeight - 100;
        newX = Math.max(-size.width + 100, Math.min(newX, maxX));
        newY = Math.max(0, Math.min(newY, maxY));
        
        setPosition({ x: newX, y: newY });
      }
      
      if (isResizing && resizeDirection) {
        const deltaX = e.clientX - resizeStart.current.x;
        const deltaY = e.clientY - resizeStart.current.y;
        
        const maxWidth = window.innerWidth * maxWidthRatio;
        const maxHeight = window.innerHeight * maxHeightRatio;
        
        let newWidth = resizeStart.current.width;
        let newHeight = resizeStart.current.height;
        let newX = resizeStart.current.panelX;
        let newY = resizeStart.current.panelY;
        
        // 根据方向调整
        if (resizeDirection.includes('e')) {
          newWidth = Math.max(minWidth, Math.min(maxWidth, resizeStart.current.width + deltaX));
        }
        if (resizeDirection.includes('w')) {
          const potentialWidth = resizeStart.current.width - deltaX;
          if (potentialWidth >= minWidth) {
            newWidth = potentialWidth;
            newX = resizeStart.current.panelX + deltaX;
          }
        }
        if (resizeDirection.includes('s')) {
          newHeight = Math.max(minHeight, Math.min(maxHeight, resizeStart.current.height + deltaY));
        }
        if (resizeDirection.includes('n')) {
          const potentialHeight = resizeStart.current.height - deltaY;
          if (potentialHeight >= minHeight) {
            newHeight = potentialHeight;
            newY = resizeStart.current.panelY + deltaY;
          }
        }
        
        setSize({ width: newWidth, height: newHeight });
        setPosition({ x: newX, y: newY });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
      setResizeDirection(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing, resizeDirection, minWidth, minHeight, maxWidthRatio, maxHeightRatio, size.width]);

  // ESC 关闭
  useEffect(() => {
    if (!open) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onOpenChange(false);
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onOpenChange]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-50">
      {/* 遮罩层 - 点击关闭 */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />
      
      {/* 面板 */}
      <div
        ref={panelRef}
        className={cn(
          "absolute bg-background rounded-xl shadow-2xl border overflow-hidden flex flex-col",
          isDragging && "cursor-grabbing select-none",
          isResizing && "select-none"
        )}
        style={{
          left: position.x,
          top: position.y,
          width: size.width,
          height: size.height,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 标题栏 - 拖拽区域 */}
        <div
          onMouseDown={handleMouseDown}
          className={cn(
            "flex items-center justify-between px-4 py-3 border-b bg-muted/30 shrink-0",
            isDragging ? "cursor-grabbing" : "cursor-grab"
          )}
        >
          <div className="flex items-center gap-2 select-none">
            {title}
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="w-7 h-7 rounded-md hover:bg-muted flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        
        {/* 内容区域 */}
        <div className={cn("flex-1 min-h-0", contentClassName)}>
          {children}
        </div>
        
        {/* 调整大小的手柄 */}
        <ResizeHandles onMouseDown={handleResizeMouseDown} />
      </div>
    </div>,
    document.body
  );
}

// 调整大小的手柄组件
function ResizeHandles({ 
  onMouseDown 
}: { 
  onMouseDown: (e: React.MouseEvent, direction: ResizeDirection) => void 
}) {
  const handleClass = "absolute bg-transparent transition-colors z-10";
  
  return (
    <>
      {/* 四个边 */}
      <div
        data-resize-handle
        onMouseDown={(e) => onMouseDown(e, 'n')}
        className={cn(handleClass, "top-0 left-2 right-2 h-1 cursor-n-resize hover:bg-blue-500/20")}
      />
      <div
        data-resize-handle
        onMouseDown={(e) => onMouseDown(e, 's')}
        className={cn(handleClass, "bottom-0 left-2 right-2 h-1 cursor-s-resize hover:bg-blue-500/20")}
      />
      <div
        data-resize-handle
        onMouseDown={(e) => onMouseDown(e, 'w')}
        className={cn(handleClass, "left-0 top-2 bottom-2 w-1 cursor-w-resize hover:bg-blue-500/20")}
      />
      <div
        data-resize-handle
        onMouseDown={(e) => onMouseDown(e, 'e')}
        className={cn(handleClass, "right-0 top-2 bottom-2 w-1 cursor-e-resize hover:bg-blue-500/20")}
      />
      
      {/* 四个角 */}
      <div
        data-resize-handle
        onMouseDown={(e) => onMouseDown(e, 'nw')}
        className={cn(handleClass, "top-0 left-0 w-3 h-3 cursor-nw-resize hover:bg-blue-500/20")}
      />
      <div
        data-resize-handle
        onMouseDown={(e) => onMouseDown(e, 'ne')}
        className={cn(handleClass, "top-0 right-0 w-3 h-3 cursor-ne-resize hover:bg-blue-500/20")}
      />
      <div
        data-resize-handle
        onMouseDown={(e) => onMouseDown(e, 'sw')}
        className={cn(handleClass, "bottom-0 left-0 w-3 h-3 cursor-sw-resize hover:bg-blue-500/20")}
      />
      <div
        data-resize-handle
        onMouseDown={(e) => onMouseDown(e, 'se')}
        className={cn(handleClass, "bottom-0 right-0 w-3 h-3 cursor-se-resize hover:bg-blue-500/20")}
      />
    </>
  );
}
