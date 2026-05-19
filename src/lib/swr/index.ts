/**
 * SWR Hooks 统一导出
 */

// Provider
export { SWRProvider } from './provider';

// Fetcher 函数
export { fetcher, fetcherData, postFetcher, putFetcher, deleteFetcher } from './fetcher';

// 通用查询 Hook
export { useQuery, useQueryWithParams, useQueryWithRefresh } from './use-query';

// 项目相关
export { useProjects, useProject } from './use-projects';

// 产品相关
export { useProducts, useProduct } from './use-products';

// 角色图库相关
export { useCharacters } from './use-characters';

// 模板相关
export { useTemplates } from './use-templates';

// 任务队列相关
export { useTaskQueue, useTaskStats } from './use-tasks';
