export interface AnalysisMasterDraftProject {
  id: string;
  clientRequestId: string;
  name: string;
  sourceUrl: string;
  sourceType: 'link';
  status: 'draft' | 'failed';
  optimisticStatus: 'creating' | 'failed';
  error?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AnalysisMasterListProject {
  id: string;
  name: string;
  sourceType: string;
  sourceUrl?: string;
  videoUrl?: string;
  videoDuration?: number;
  fileSize?: number;
  audioUrl?: string;
  audioDuration?: number;
  audioFileSize?: number;
  status: string;
  result?: unknown | null;
  error?: string | null;
  importMetadata?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
  clientRequestId?: string;
  optimisticStatus?: 'creating' | 'failed';
}

interface DraftStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const STORAGE_PREFIX = 'analysis-master-drafts';

function getStorageKey(userId: string): string {
  return `${STORAGE_PREFIX}:${userId}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function parseDrafts(raw: string | null): AnalysisMasterDraftProject[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is Partial<AnalysisMasterDraftProject> => {
        return Boolean(
          item &&
          typeof item === 'object' &&
          typeof (item as AnalysisMasterDraftProject).clientRequestId === 'string' &&
          typeof (item as AnalysisMasterDraftProject).name === 'string' &&
          typeof (item as AnalysisMasterDraftProject).sourceUrl === 'string'
        );
      })
      .map(item => ({
        id: typeof item.id === 'string' && item.id ? item.id : String(item.clientRequestId || ''),
        clientRequestId: String(item.clientRequestId || ''),
        name: String(item.name || ''),
        sourceUrl: String(item.sourceUrl || ''),
        sourceType: 'link',
        status: item.optimisticStatus === 'failed' ? 'failed' : 'draft',
        optimisticStatus: item.optimisticStatus === 'failed' ? 'failed' : 'creating',
        error: item.error || null,
        createdAt: String(item.createdAt || new Date().toISOString()),
        updatedAt: String(item.updatedAt || item.createdAt || new Date().toISOString()),
      }));
  } catch {
    return [];
  }
}

export function createAnalysisMasterDraftProject(params: {
  clientRequestId: string;
  name: string;
  sourceUrl: string;
  optimisticStatus?: 'creating' | 'failed';
  error?: string | null;
  createdAt?: string;
  updatedAt?: string;
}): AnalysisMasterDraftProject {
  const createdAt = params.createdAt || nowIso();
  const updatedAt = params.updatedAt || createdAt;
  return {
    id: params.clientRequestId,
    clientRequestId: params.clientRequestId,
    name: params.name,
    sourceUrl: params.sourceUrl,
    sourceType: 'link',
    status: params.optimisticStatus === 'failed' ? 'failed' : 'draft',
    optimisticStatus: params.optimisticStatus || 'creating',
    error: params.error || null,
    createdAt,
    updatedAt,
  };
}

export function loadAnalysisMasterDraftProjects(storage: DraftStorageLike, userId: string): AnalysisMasterDraftProject[] {
  return parseDrafts(storage.getItem(getStorageKey(userId)));
}

export function saveAnalysisMasterDraftProjects(
  storage: DraftStorageLike,
  userId: string,
  drafts: AnalysisMasterDraftProject[]
): void {
  if (drafts.length === 0) {
    storage.removeItem(getStorageKey(userId));
    return;
  }
  storage.setItem(getStorageKey(userId), JSON.stringify(drafts));
}

export function mergeAnalysisMasterProjects(
  serverProjects: AnalysisMasterListProject[],
  drafts: AnalysisMasterDraftProject[]
): (AnalysisMasterListProject | AnalysisMasterDraftProject)[] {
  const serverClientRequestIds = new Set(
    serverProjects
      .map(project => project.importMetadata?.clientRequestId)
      .filter((value): value is string => typeof value === 'string' && value.length > 0)
  );

  const pendingDrafts = drafts
    .filter(draft => !serverClientRequestIds.has(draft.clientRequestId))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return [...pendingDrafts, ...serverProjects];
}
