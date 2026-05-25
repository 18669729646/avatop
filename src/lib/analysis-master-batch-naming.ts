export function resolveBatchProjectName(metadata: Record<string, string>, index: number): string {
  const base =
    metadata['椤圭洰鍚嶇О']
    || metadata['瑙嗛鍚嶇О']
    || metadata['鏍囬']
    || metadata['鍚嶇О']
    || metadata['鍐呭']
    || `鎵归噺瀵煎叆椤圭洰 ${index + 1}`;
  return `[鎵归噺] ${base}`;
}
