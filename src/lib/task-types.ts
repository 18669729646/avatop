export const ANALYSIS_MASTER_TASK_TYPES = ['analysis', 'analysis_batch_import', 'analysis_script_remake'] as const;

export type AnalysisMasterTaskType = (typeof ANALYSIS_MASTER_TASK_TYPES)[number];

export function isAnalysisMasterTaskType(type: string | null | undefined): type is AnalysisMasterTaskType {
  return type === 'analysis' || type === 'analysis_batch_import' || type === 'analysis_script_remake';
}
