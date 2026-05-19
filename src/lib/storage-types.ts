/**
 * 统一的图片/文件存储类型
 * 支持 key + url 混合方案：
 * - key: S3 对象存储的 key（永久有效）
 * - url: 签名 URL（有效期1年，过期后可刷新）
 */

/**
 * 基础存储项 - 包含 key 和 url
 */
export interface StorageItem {
  /** S3 对象存储的 key（永久有效） */
  key: string;
  /** 签名 URL（有效期1年） */
  url: string;
  /** URL 生成时间（时间戳，用于判断是否需要刷新） */
  urlGeneratedAt?: number;
}

/**
 * 图片存储项 - 扩展自 StorageItem
 */
export interface ImageStorageItem extends StorageItem {
  /** 图片ID */
  id: string;
  /** 是否为主图 */
  isPrimary?: boolean;
  /** 图片描述 */
  description?: string;
  /** 创建时间 */
  createdAt?: number;
  /** 文件大小（字节） */
  fileSize?: number;
}

/**
 * 视频存储项 - 扩展自 StorageItem
 */
export interface VideoStorageItem extends StorageItem {
  /** 视频ID */
  id: string;
  /** 关联的任务ID */
  taskId?: string;
  /** 时长（秒） */
  duration?: number;
  /** 创建时间 */
  createdAt?: number;
  /** 文件大小（字节） */
  fileSize?: number;
}

/**
 * URL 有效期（1年，单位：秒）
 */
export const URL_EXPIRE_TIME = 365 * 24 * 60 * 60;

/**
 * URL 刷新阈值（提前30天刷新，单位：毫秒）
 */
export const URL_REFRESH_THRESHOLD = 30 * 24 * 60 * 60 * 1000;

/**
 * 判断 URL 是否需要刷新
 * @param urlGeneratedAt URL 生成时间
 * @returns 是否需要刷新
 */
export function needsRefresh(urlGeneratedAt?: number): boolean {
  if (!urlGeneratedAt) return true;
  const age = Date.now() - urlGeneratedAt;
  return age > URL_REFRESH_THRESHOLD;
}

/**
 * 兼容旧数据：将纯 URL 字符串转换为 StorageItem
 * @param urlOrItem URL 字符串或 StorageItem
 * @returns StorageItem
 */
export function toStorageItem(urlOrItem: string | StorageItem): StorageItem {
  if (typeof urlOrItem === 'string') {
    // 旧数据格式：纯 URL 字符串
    // 尝试从 URL 中提取 key
    const key = extractKeyFromUrl(urlOrItem);
    return { key, url: urlOrItem };
  }
  return urlOrItem;
}

/**
 * 从签名 URL 中提取 key
 * @param url 签名 URL
 * @returns S3 key
 */
export function extractKeyFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    // 移除开头的 / 得到 key
    return urlObj.pathname.substring(1);
  } catch {
    // 如果解析失败，返回原始 URL 作为 key
    return url;
  }
}

/**
 * 批量转换 URL 数组为 StorageItem 数组
 * @param urls URL 数组（可能包含字符串或对象）
 * @returns StorageItem 数组
 */
export function toStorageItems(urls: (string | StorageItem)[]): StorageItem[] {
  return urls.map(toStorageItem);
}

/**
 * 获取图片的显示 URL（处理刷新逻辑）
 * @param item StorageItem
 * @returns 显示用的 URL
 */
export function getDisplayUrl(item: StorageItem): string {
  return item.url;
}
