// 成品案例类型定义

export type ShowcaseType = 'image' | 'video' | 'shortfilm';

export type ShowcaseStatus = 'published' | 'archived';

export interface ShowcaseCase {
  id: string;
  title: string;
  description: string | null;
  type: ShowcaseType;
  category: string | null;
  thumbnailUrl: string;
  mediaUrl: string;
  mediaType: 'image' | 'video';
  prompt: string | null;
  model: string | null;
  duration: number | null;
  isFeatured: boolean;
  displayOrder: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  status: ShowcaseStatus;
}

// 创建案例请求
export interface CreateShowcaseCaseRequest {
  title: string;
  description?: string;
  type: ShowcaseType;
  category?: string;
  thumbnailUrl: string;
  mediaUrl: string;
  mediaType: 'image' | 'video';
  prompt?: string;
  model?: string;
  duration?: number;
  isFeatured?: boolean;
  displayOrder?: number;
}

// 更新案例请求
export interface UpdateShowcaseCaseRequest {
  title?: string;
  description?: string;
  type?: ShowcaseType;
  category?: string;
  thumbnailUrl?: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video';
  prompt?: string;
  model?: string;
  duration?: number;
  isFeatured?: boolean;
  displayOrder?: number;
  status?: ShowcaseStatus;
}

// 获取案例列表查询参数
export interface GetShowcaseCasesParams {
  type?: ShowcaseType;
  category?: string;
  status?: ShowcaseStatus;
  limit?: number;
  offset?: number;
  isFeatured?: boolean;
}
