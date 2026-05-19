'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  getSystemConfig, 
  getSystemConfigAsync,
  TextApiConfig, 
  ImageApiConfig, 
  VideoApiConfig,
  SystemConfig
} from '@/lib/system-config';

export type ModelType = 'text' | 'image' | 'video';

interface ModelSelectorProps {
  type: ModelType;
  value: string; // 配置ID
  onChange: (configId: string, config: TextApiConfig | ImageApiConfig | VideoApiConfig | null) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function ModelSelector({
  type,
  value,
  onChange,
  placeholder = '选择模型',
  className,
  disabled,
}: ModelSelectorProps) {
  // 使用 state 来管理配置，支持异步加载
  const [config, setConfig] = useState<SystemConfig>(() => getSystemConfig());
  
  // 异步加载配置（确保获取到完整的配置数据）
  useEffect(() => {
    getSystemConfigAsync().then(loadedConfig => {
      setConfig(loadedConfig);
    });
  }, []);
  
  const configs = useMemo(() => {
    switch (type) {
      case 'text':
        return config.textApis;
      case 'image':
        return config.imageApis;
      case 'video':
        return config.videoApis;
      default:
        return [];
    }
  }, [config, type]);

  const defaultId = useMemo(() => {
    switch (type) {
      case 'text':
        return config.defaultTextApiId;
      case 'image':
        return config.defaultImageApiId;
      case 'video':
        return config.defaultVideoApiId;
      default:
        return '';
    }
  }, [config, type]);

  // 找到当前选中的配置
  const selectedConfig = useMemo(() => {
    return configs.find(c => c.id === value) || null;
  }, [configs, value]);

  // 当配置列表变化时，默认选中第一个或默认配置
  useEffect(() => {
    if (!value && configs.length > 0) {
      const defaultConfig = configs.find(c => c.id === defaultId) || configs[0];
      onChange(defaultConfig.id, defaultConfig);
    }
  }, [configs, defaultId, value, onChange]);

  const handleChange = (configId: string) => {
    const selected = configs.find(c => c.id === configId) || null;
    onChange(configId, selected);
  };

  if (configs.length === 0) {
    return (
      <div className={`text-sm text-muted-foreground ${className}`}>
        暂无配置，请先在系统设置中添加
      </div>
    );
  }

  return (
    <Select
      value={value}
      onValueChange={handleChange}
      disabled={disabled}
    >
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder}>
          {selectedConfig ? (
            <div className="flex items-center gap-1.5 overflow-hidden">
              <span className="font-medium truncate">{selectedConfig.name}</span>
              {selectedConfig.isDefault && (
                <Badge 
                  variant="outline" 
                  className="text-[10px] px-1.5 py-0 h-5 bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/50 dark:text-blue-400 dark:border-blue-800 flex-shrink-0"
                >
                  默认
                </Badge>
              )}
            </div>
          ) : (
            placeholder
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {configs.map((cfg) => (
          <SelectItem key={cfg.id} value={cfg.id}>
            <div className="flex items-center gap-1.5">
              <span className="font-medium">{cfg.name}</span>
              {cfg.isDefault && (
                <Badge 
                  variant="outline" 
                  className="text-[10px] px-1.5 py-0 h-5 bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/50 dark:text-blue-400 dark:border-blue-800"
                >
                  默认
                </Badge>
              )}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// 获取默认配置的便捷函数
export function getDefaultConfig(type: ModelType): TextApiConfig | ImageApiConfig | VideoApiConfig | null {
  const config = getSystemConfig();
  
  switch (type) {
    case 'text': {
      const defaultApi = config.textApis.find(api => api.id === config.defaultTextApiId);
      return defaultApi || config.textApis[0] || null;
    }
    case 'image': {
      const defaultApi = config.imageApis.find(api => api.id === config.defaultImageApiId);
      return defaultApi || config.imageApis[0] || null;
    }
    case 'video': {
      const defaultApi = config.videoApis.find(api => api.id === config.defaultVideoApiId);
      return defaultApi || config.videoApis[0] || null;
    }
    default:
      return null;
  }
}
