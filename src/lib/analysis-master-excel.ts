import * as XLSX from 'xlsx';

export const ANALYSIS_MASTER_IMPORT_LIMIT = 100;

export interface AnalysisMasterImportItem {
  sourceUrl: string;
  metadata: Record<string, string>;
}

const URL_PATTERNS = [
  /(?:https?:\/\/)?(?:www\.)?tiktok\.com\/[^\s"'<>]+/i,
  /(?:https?:\/\/)?(?:www\.)?douyin\.com\/[^\s"'<>]+/i,
];

export interface AnalysisMasterExportProject {
  id: string;
  name: string;
  sourceType?: string;
  sourceUrl?: string | null;
  status?: string;
  error?: string | null;
  importMetadata?: Record<string, string> | null;
  result?: Record<string, unknown> | null;
  createdAt?: string;
  updatedAt?: string;
}

export type AnalysisMasterExportRow = Record<string, string | number | boolean | null | undefined>;

function cleanCellValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function stringifyValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

export function extractAnalysisMasterImports(buffer: Buffer): AnalysisMasterImportItem[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
    raw: false,
  });
  const imports = new Map<string, AnalysisMasterImportItem>();

  for (const row of rows) {
    let sourceUrl = '';
    let urlColumn = '';
    for (const [column, value] of Object.entries(row)) {
      sourceUrl = findVideoUrl(value);
      if (sourceUrl) {
        urlColumn = column;
        break;
      }
    }

    if (!sourceUrl) continue;

    const metadata: Record<string, string> = {};
    for (const [column, value] of Object.entries(row)) {
      if (column === urlColumn) continue;
      const cleaned = cleanCellValue(value);
      if (cleaned) metadata[column] = cleaned;
    }
    imports.set(sourceUrl, { sourceUrl, metadata });
  }

  return Array.from(imports.values()).slice(0, ANALYSIS_MASTER_IMPORT_LIMIT);
}

function findVideoUrl(value: unknown): string {
  const text = cleanCellValue(value);
  if (!text) return '';
  for (const pattern of URL_PATTERNS) {
    const match = text.match(pattern);
    if (match?.[0]) {
      const normalized = match[0].trim();
      return /^https?:\/\//i.test(normalized) ? normalized : `https://${normalized}`;
    }
  }
  return '';
}

export function buildAnalysisMasterExportRows(projects: AnalysisMasterExportProject[]): AnalysisMasterExportRow[] {
  return projects.map((project) => ({
    项目ID: project.id,
    项目名称: project.name,
    来源类型: project.sourceType || '',
    URL: project.sourceUrl || '',
    状态: project.status || '',
    错误信息: project.error || '',
    创建时间: project.createdAt || '',
    更新时间: project.updatedAt || '',
    完整JSON结果: project.result ? stringifyValue(project.result) : '',
  }));
}

export function createAnalysisMasterWorkbook(rows: AnalysisMasterExportRow[]): Buffer {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(rows);

  // 设置列宽
  worksheet['!cols'] = [
    { wch: 40 }, // 项目ID
    { wch: 30 }, // 项目名称
    { wch: 12 }, // 来源类型
    { wch: 60 }, // URL
    { wch: 12 }, // 状态
    { wch: 40 }, // 错误信息
    { wch: 22 }, // 创建时间
    { wch: 22 }, // 更新时间
    { wch: 100 }, // 完整JSON结果
  ];

  XLSX.utils.book_append_sheet(workbook, worksheet, '分析大师');
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

  // 添加 UTF-8 BOM 解决中文乱码
  const bom = Buffer.from([0xef, 0xbb, 0xbf]);
  return Buffer.concat([bom, buffer]);
}
