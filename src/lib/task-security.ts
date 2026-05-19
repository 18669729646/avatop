/**
 * 任务安全模块
 * 
 * 用于过滤任务参数中的敏感信息，保护 API Key、模型配置等敏感数据
 */

// 敏感字段列表（不应暴露给普通用户）
export const SENSITIVE_PARAM_FIELDS = [
  'apiKey',
  'model',
  'baseUrl',
  'apiSecret',
  'secretKey',
  'accessToken',
] as const;

export type SensitiveFieldName = typeof SENSITIVE_PARAM_FIELDS[number];

// 任务参数类型
export type TaskParams = Record<string, unknown>;

/**
 * 过滤敏感字段（用于存储前过滤或返回给普通用户）
 * 
 * @param params 原始参数
 * @param keepModel 是否保留 model 字段（管理员可能需要查看）
 * @returns 过滤后的参数
 */
export function filterSensitiveParams(
  params: TaskParams,
  keepModel = false
): TaskParams {
  if (!params || typeof params !== 'object') {
    return params;
  }

  const filtered = { ...params };
  
  // 总是过滤的字段
  delete filtered.apiKey;
  delete filtered.apiSecret;
  delete filtered.secretKey;
  delete filtered.accessToken;
  delete filtered.baseUrl;
  
  // 根据参数决定是否过滤 model
  if (!keepModel) {
    delete filtered.model;
  }
  
  return filtered;
}

/**
 * 从任务参数中提取 API 配置 ID（如果存在）
 * 用于运行时从系统配置获取真实的 API Key
 */
export function extractApiConfigId(params: TaskParams): {
  apiId?: string;
  apiType?: 'text' | 'image' | 'video';
} {
  const result: { apiId?: string; apiType?: 'text' | 'image' | 'video' } = {};
  
  if (params.apiId && typeof params.apiId === 'string') {
    result.apiId = params.apiId;
  }
  
  // 根据任务参数推断类型
  if (params.shortfilmTaskId) {
    if (typeof params.shortfilmTaskId === 'string') {
      if (params.shortfilmTaskId.startsWith('img-')) {
        result.apiType = 'image';
      } else if (params.shortfilmTaskId.startsWith('vid-')) {
        result.apiType = 'video';
      } else if (params.shortfilmTaskId.startsWith('script-')) {
        result.apiType = 'text';
      }
    }
  }
  
  return result;
}

/**
 * 检查用户是否是管理员
 */
export function isAdmin(role: string | undefined): boolean {
  return role === 'admin';
}

/**
 * 根据用户角色过滤任务列表
 */
export function filterTasksForUser<T extends { params: TaskParams }>(
  tasks: T[],
  userRole: string | undefined
): T[] {
  if (isAdmin(userRole)) {
    return tasks; // 管理员可以看到完整信息
  }
  
  return tasks.map(task => ({
    ...task,
    params: filterSensitiveParams(task.params),
  }));
}

/**
 * 根据用户角色过滤单个任务
 */
export function filterTaskForUser<T extends { params: TaskParams }>(
  task: T,
  userRole: string | undefined
): T {
  if (isAdmin(userRole)) {
    return task;
  }
  
  return {
    ...task,
    params: filterSensitiveParams(task.params),
  };
}
