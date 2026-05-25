export function resolveBatchProjectName(metadata: Record<string, string>, index: number): string {
  const base =
    metadata.projectName
    || metadata.name
    || metadata.title
    || metadata['项目名称']
    || metadata['视频名称']
    || metadata['标题']
    || metadata['名称']
    || metadata['内容']
    || `批量导入项目 ${index + 1}`;
  return `[批量] ${base}`;
}
