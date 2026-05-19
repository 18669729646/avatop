'use client';

import { ImageViewer } from '@/components/image-viewer';

interface ImagePreviewOverlayProps {
  images: { url: string; id: string }[];
  currentIndex: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}

export function ImagePreviewOverlay({
  images,
  currentIndex,
  onIndexChange,
  onClose,
}: ImagePreviewOverlayProps) {
  if (images.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/90">
      <ImageViewer
        src={images[currentIndex]?.url || ''}
        alt="生成的图片"
        fileName={`shortfilm-image-${images[currentIndex]?.id || 'preview'}.png`}
        onClose={onClose}
        images={images}
        currentIndex={currentIndex}
        onIndexChange={onIndexChange}
      />
    </div>
  );
}
