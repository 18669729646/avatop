'use client';

import { useState } from 'react';
import { getAuthToken } from '@/lib/auth-context';
import { ScriptSegment } from '@/lib/shortfilm';

export interface RemakeModeState {
  remakeMode: boolean;
  setRemakeMode: (v: boolean) => void;
  remakeVideoKey: string | null;
  setRemakeVideoKey: (v: string | null) => void;
  remakeVideoUrl: string | null;
  setRemakeVideoUrl: (v: string | null) => void;
  remakeVideoDuration: number;
  setRemakeVideoDuration: (v: number) => void;
  remakeUploading: boolean;
  remakeUploadProgress: number;
  remakeSelectedFile: File | null;
  setRemakeSelectedFile: (v: File | null) => void;
  remakeVideoUrlInput: string;
  setRemakeVideoUrlInput: (v: string) => void;
  isRemakeParsing: boolean;
  remakeParseError: string | null;
  setRemakeParseError: (v: string | null) => void;
  handleRemakeFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleRemakeUpload: (projectId: string, updateProject: (data: Record<string, unknown>, immediate?: boolean) => void) => Promise<void>;
  handleRemakeLinkSubmit: (projectId: string, updateProject: (data: Record<string, unknown>, immediate?: boolean) => void) => Promise<void>;
  handleRemakeParse: (
    projectId: string,
    callbacks: {
      setScriptSegments: (segments: ScriptSegment[]) => void;
      setDuration: (duration: number) => void;
      setCurrentStep: (step: number) => void;
      setScriptGenerationMode: (mode: 'ai' | 'manual') => void;
      updateMaxCompletedStep: (step: number) => void;
      updateProject: (data: Record<string, unknown>, immediate?: boolean) => void;
    }
  ) => Promise<void>;
}

export function useRemakeMode(): RemakeModeState {
  const [remakeMode, setRemakeMode] = useState(false);
  const [remakeVideoKey, setRemakeVideoKey] = useState<string | null>(null);
  const [remakeVideoUrl, setRemakeVideoUrl] = useState<string | null>(null);
  const [remakeVideoDuration, setRemakeVideoDuration] = useState(0);
  const [remakeUploading, setRemakeUploading] = useState(false);
  const [remakeUploadProgress, setRemakeUploadProgress] = useState(0);
  const [remakeSelectedFile, setRemakeSelectedFile] = useState<File | null>(null);
  const [remakeVideoUrlInput, setRemakeVideoUrlInput] = useState('');
  const [isRemakeParsing, setIsRemakeParsing] = useState(false);
  const [remakeParseError, setRemakeParseError] = useState<string | null>(null);

  const handleRemakeFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowedTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm'];
    if (!allowedTypes.includes(file.type)) {
      setRemakeParseError('不支持的视频格式，请上传 MP4、MOV、AVI 或 WebM 格式');
      return;
    }
    if (file.size > 500 * 1024 * 1024) {
      setRemakeParseError('视频文件不能超过 500MB');
      return;
    }
    setRemakeSelectedFile(file);
    setRemakeParseError(null);
  };

  const handleRemakeUpload = async (
    projectId: string,
    updateProject: (data: Record<string, unknown>, immediate?: boolean) => void
  ) => {
    if (!remakeSelectedFile) return;

    const token = getAuthToken();
    if (!token) return;

    setRemakeUploading(true);
    setRemakeUploadProgress(0);

    try {
      const CHUNK_SIZE = 5 * 1024 * 1024;
      const totalChunks = Math.ceil(remakeSelectedFile.size / CHUNK_SIZE);

      const initResponse = await fetch('/api/shortfilm/remake-chunk-init', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          projectId,
          fileName: remakeSelectedFile.name,
          fileSize: remakeSelectedFile.size,
          chunkSize: CHUNK_SIZE,
          totalChunks,
        }),
      });

      const initResult = await initResponse.json();
      if (!initResult.success) {
        throw new Error(initResult.error || '初始化上传失败');
      }

      const { uploadId, key } = initResult;

      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, remakeSelectedFile.size);
        const chunk = remakeSelectedFile.slice(start, end);

        const formData = new FormData();
        formData.append('chunk', chunk);
        formData.append('uploadId', uploadId);
        formData.append('chunkIndex', String(i));

        const chunkResponse = await fetch('/api/shortfilm/remake-chunk-upload', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData,
        });

        if (!chunkResponse.ok) {
          throw new Error(`上传分片 ${i + 1} 失败`);
        }

        setRemakeUploadProgress(Math.round(((i + 1) / totalChunks) * 100));
      }

      const completeResponse = await fetch('/api/shortfilm/remake-chunk-complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ uploadId, key }),
      });

      const completeResult = await completeResponse.json();
      if (!completeResult.success) {
        throw new Error(completeResult.error || '完成上传失败');
      }

      setRemakeVideoKey(completeResult.key);
      setRemakeVideoUrl(completeResult.url);
      updateProject({
        sourceType: 'remake',
        sourceVideoKey: completeResult.key,
        sourceVideoUrl: completeResult.url,
      }, true);

      setRemakeSelectedFile(null);
    } catch (error) {
      console.error('[Remake Upload] error:', error);
      setRemakeParseError(error instanceof Error ? error.message : '上传失败');
    } finally {
      setRemakeUploading(false);
      setRemakeUploadProgress(0);
    }
  };

  const handleRemakeLinkSubmit = async (
    projectId: string,
    updateProject: (data: Record<string, unknown>, immediate?: boolean) => void
  ) => {
    if (!remakeVideoUrlInput.trim()) return;

    const token = getAuthToken();
    if (!token) return;

    setRemakeUploading(true);
    setRemakeParseError(null);

    try {
      const response = await fetch('/api/shortfilm/remake-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          url: remakeVideoUrlInput.trim(),
          projectId,
        }),
      });

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || '解析链接失败');
      }

      setRemakeVideoKey(result.data.videoKey);
      setRemakeVideoUrl(result.data.videoUrl);
      setRemakeVideoDuration(result.data.duration || 0);
      updateProject({
        sourceType: 'remake',
        sourceVideoKey: result.data.videoKey,
        sourceVideoUrl: result.data.videoUrl,
        videoDuration: result.data.duration || 0,
      }, true);

      setRemakeVideoUrlInput('');
    } catch (error) {
      console.error('[Remake Link] error:', error);
      setRemakeParseError(error instanceof Error ? error.message : '解析链接失败');
    } finally {
      setRemakeUploading(false);
    }
  };

  const handleRemakeParse = async (
    projectId: string,
    callbacks: {
      setScriptSegments: (segments: ScriptSegment[]) => void;
      setDuration: (duration: number) => void;
      setCurrentStep: (step: number) => void;
      setScriptGenerationMode: (mode: 'ai' | 'manual') => void;
      updateMaxCompletedStep: (step: number) => void;
      updateProject: (data: Record<string, unknown>, immediate?: boolean) => void;
    }
  ) => {
    const token = getAuthToken();
    if (!token) return;

    setIsRemakeParsing(true);
    setRemakeParseError(null);

    try {
      const response = await fetch(`/api/shortfilm/remake-parse/${projectId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        signal: AbortSignal.timeout(10 * 60 * 1000),
      });

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || '解析失败');
      }

      const segments: ScriptSegment[] = result.data.scriptSegments || [];
      const totalDuration = result.data.totalDuration || segments.reduce((sum: number, s: ScriptSegment) => sum + s.duration, 0);

      callbacks.setScriptSegments(segments);
      callbacks.setDuration(totalDuration);

      callbacks.updateProject({
        scriptSegments: segments,
        totalDuration,
        currentStep: 2,
        scriptGenerationMode: 'ai',
      }, true);

      callbacks.setScriptGenerationMode('ai');
      callbacks.setCurrentStep(2);
      callbacks.updateMaxCompletedStep(1);
    } catch (error) {
      console.error('[Remake Parse] error:', error);
      setRemakeParseError(error instanceof Error ? error.message : '解析失败');
    } finally {
      setIsRemakeParsing(false);
    }
  };

  return {
    remakeMode,
    setRemakeMode,
    remakeVideoKey,
    setRemakeVideoKey,
    remakeVideoUrl,
    setRemakeVideoUrl,
    remakeVideoDuration,
    setRemakeVideoDuration,
    remakeUploading,
    remakeUploadProgress,
    remakeSelectedFile,
    setRemakeSelectedFile,
    remakeVideoUrlInput,
    setRemakeVideoUrlInput,
    isRemakeParsing,
    remakeParseError,
    setRemakeParseError,
    handleRemakeFileSelect,
    handleRemakeUpload,
    handleRemakeLinkSubmit,
    handleRemakeParse,
  };
}
