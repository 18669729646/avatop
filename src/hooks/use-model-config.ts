'use client';

import { useState } from 'react';
import { getDefaultImageApi, getDefaultTextApi, getDefaultVideoApi, TextApiConfig, ImageApiConfig, VideoApiConfig } from '@/lib/system-config';

export interface ModelConfigState {
  selectedTextModelId: string;
  selectedTextModelConfig: TextApiConfig | null;
  selectedImageModelId: string;
  selectedImageModelConfig: ImageApiConfig | null;
  selectedVideoModelId: string;
  selectedVideoModelConfig: VideoApiConfig | null;
  setSelectedTextModelId: (id: string) => void;
  setSelectedTextModelConfig: (config: TextApiConfig | null) => void;
  setSelectedImageModelId: (id: string) => void;
  setSelectedImageModelConfig: (config: ImageApiConfig | null) => void;
  setSelectedVideoModelId: (id: string) => void;
  setSelectedVideoModelConfig: (config: VideoApiConfig | null) => void;
}

export function useModelConfig(): ModelConfigState {
  const [selectedTextModelId, setSelectedTextModelId] = useState('');
  const [selectedTextModelConfig, setSelectedTextModelConfig] = useState<TextApiConfig | null>(null);
  const [selectedImageModelId, setSelectedImageModelId] = useState('');
  const [selectedImageModelConfig, setSelectedImageModelConfig] = useState<ImageApiConfig | null>(null);
  const [selectedVideoModelId, setSelectedVideoModelId] = useState('');
  const [selectedVideoModelConfig, setSelectedVideoModelConfig] = useState<VideoApiConfig | null>(null);

  return {
    selectedTextModelId,
    selectedTextModelConfig,
    selectedImageModelId,
    selectedImageModelConfig,
    selectedVideoModelId,
    selectedVideoModelConfig,
    setSelectedTextModelId,
    setSelectedTextModelConfig,
    setSelectedImageModelId,
    setSelectedImageModelConfig,
    setSelectedVideoModelId,
    setSelectedVideoModelConfig,
  };
}
