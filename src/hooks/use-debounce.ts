import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * 防抖值 Hook
 * @param value 需要防抖的值
 * @param delay 延迟时间（毫秒）
 * @returns 防抖后的值
 */
export function useDebouncedValue<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * 防抖回调 Hook
 * @param callback 需要防抖的回调函数
 * @param delay 延迟时间（毫秒）
 * @returns 防抖后的回调函数
 */
export function useDebouncedCallback<T extends (...args: unknown[]) => unknown>(
  callback: T,
  delay: number = 300
): T {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const callbackRef = useRef(callback);

  // 更新 callback ref
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // 清理
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const debouncedCallback = useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args);
      }, delay);
    },
    [delay]
  ) as T;

  return debouncedCallback;
}

/**
 * 搜索输入防抖 Hook
 * 专为搜索场景设计，返回防抖后的搜索词
 * @param initialValue 初始值
 * @param delay 延迟时间（毫秒）
 * @returns [inputValue, debouncedValue, setInputValue]
 */
export function useSearchDebounce<T extends string>(
  initialValue: T,
  delay: number = 300
): [T, T, (value: T) => void] {
  const [inputValue, setInputValue] = useState<T>(initialValue);
  const debouncedValue = useDebouncedValue(inputValue, delay);

  return [inputValue, debouncedValue, setInputValue];
}
