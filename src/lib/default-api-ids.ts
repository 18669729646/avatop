/**
 * Default API IDs utilities
 * This module is extracted from system-config/route.ts to avoid TypeScript
 * conflicts with Next.js 16 route type inference.
 */

// Default API IDs type
export type DefaultApiIds = {
  defaultTextApiId?: string;
  defaultImageApiId?: string;
  defaultVideoApiId?: string;
  defaultDownloadApiId?: string;
};

/**
 * Merge default API IDs with fallback to empty configs
 */
export function mergeDefaultApiIds(
  existingDefaults: DefaultApiIds | undefined,
  updates: DefaultApiIds
): Required<DefaultApiIds> {
  const fallback: DefaultApiIds = {
    defaultTextApiId: 'default-text-api',
    defaultImageApiId: 'default-image-api',
    defaultVideoApiId: 'default-video-api',
    defaultDownloadApiId: '',
  };
  return {
    defaultTextApiId: updates.defaultTextApiId ?? existingDefaults?.defaultTextApiId ?? fallback.defaultTextApiId!,
    defaultImageApiId: updates.defaultImageApiId ?? existingDefaults?.defaultImageApiId ?? fallback.defaultImageApiId!,
    defaultVideoApiId: updates.defaultVideoApiId ?? existingDefaults?.defaultVideoApiId ?? fallback.defaultVideoApiId!,
    defaultDownloadApiId: updates.defaultDownloadApiId ?? existingDefaults?.defaultDownloadApiId ?? fallback.defaultDownloadApiId!,
  };
}
