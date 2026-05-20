import * as XLSX from 'xlsx';

export const ANALYSIS_MASTER_IMPORT_LIMIT = 100;

export interface AnalysisMasterImportItem {
  sourceUrl: string;
  metadata: Record<string, string>;
}

export interface AnalysisMasterExportScene {
  id?: string;
  order?: number;
  startTime?: number;
  endTime?: number;
  duration?: number;
  title?: string;
  description?: string;
  imagePrompt?: string;
  videoPrompt?: string;
  speechText?: string;
  sellingPoint?: string;
  dialogueVoOriginal?: string;
  dialogueVoZh?: string;
  ctaA?: string;
  ctaB?: string;
  ctaC?: string;
  ctaD?: string;
  actionScheduling?: string;
  productDesc?: string;
  mustShow?: string;
  onScreenTextGraphics?: string;
  cameraShotSize?: string;
  cameraAngle?: string;
  cameraMovement?: string;
  compositionNotes?: string;
  lightingAtmosphere?: string;
  colorGrading?: string;
  languageStyle?: string;
  emphasisNotes?: string;
  audioBgm?: string;
  audioSfx?: string;
  ambientSound?: string;
  editingTransition?: string;
  pacingNotes?: string;
  filmingConstraints?: string;
  constraintsCompliance?: string;
  reverseConstraints?: string;
  assetsNeeded?: string;
  sentenceMapping?: string;
  mappingNotes?: string;
  preAnalysis?: unknown;
}

export interface AnalysisMasterExportProject {
  id: string;
  name: string;
  sourceType?: string;
  sourceUrl?: string | null;
  status?: string;
  error?: string | null;
  importMetadata?: Record<string, string> | null;
  result?: {
    summary?: string;
    videoType?: string;
    targetAudience?: string;
    sellingPoints?: string[];
    scenes?: AnalysisMasterExportScene[];
  } | null;
  createdAt?: string;
  updatedAt?: string;
}

export type AnalysisMasterExportRow = Record<string, string | number | boolean | null | undefined>;

const URL_PATTERNS = [
  /(?:https?:\/\/)?(?:www\.)?tiktok\.com\/[^\s"'<>]+/i,
  /(?:https?:\/\/)?(?:www\.)?douyin\.com\/[^\s"'<>]+/i,
];

function cleanCellValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
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

function joinArray(value?: string[]): string {
  return Array.isArray(value) ? value.filter(Boolean).join('，') : '';
}

function stringifyValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

function buildProjectSummaryColumns(project: AnalysisMasterExportProject): AnalysisMasterExportRow {
  return {
    来源类型: project.sourceType || '',
    状态: project.status || '',
    错误信息: project.error || '',
    创建时间: project.createdAt || '',
    更新时间: project.updatedAt || '',
    整体总结: project.result?.summary || '',
    视频类型: project.result?.videoType || '',
    目标人群: project.result?.targetAudience || '',
    卖点汇总: joinArray(project.result?.sellingPoints),
  };
}

export function buildAnalysisMasterExportRows(projects: AnalysisMasterExportProject[]): AnalysisMasterExportRow[] {
  const rows: AnalysisMasterExportRow[] = [];

  for (const project of projects) {
    const base: AnalysisMasterExportRow = {
      椤圭洰ID: project.id,
      椤圭洰鍚嶇О: project.name,
      URL: project.sourceUrl || '',
      ...(project.importMetadata || {}),
    };
    const summaryColumns = buildProjectSummaryColumns(project);

    const scenes = project.result?.scenes || [];
    if (scenes.length === 0) {
      rows.push({
        ...base,
        ...summaryColumns,
      });
      continue;
    }

    for (const [index, scene] of scenes.entries()) {
      rows.push({
        ...base,
        '分镜序号': scene.order || index + 1,
        '开始时间': scene.startTime,
        '结束时间': scene.endTime,
        '时长': scene.duration,
        '分镜名称(name)': scene.title || '',
        '画面描述': scene.description || '',
        '画面提示词(imagePrompt)': scene.imagePrompt || '',
        '视频提示词(videoPrompt)': scene.videoPrompt || '',
        '口播(speechText)': scene.speechText || '',
        '卖点(sellingPoint)': scene.sellingPoint || '',
        '台词原文(dialogue_vo_original)': scene.dialogueVoOriginal || '',
        '台词中文(dialogue_vo_zh)': scene.dialogueVoZh || '',
        cta_a: scene.ctaA || '',
        cta_b: scene.ctaB || '',
        cta_c: scene.ctaC || '',
        cta_d: scene.ctaD || '',
        '动作调度(action_scheduling)': scene.actionScheduling || '',
        '产品描述(product_desc)': scene.productDesc || '',
        '必须展示(must_show)': scene.mustShow || '',
        '屏幕文字图形(on_screen_text_graphics)': scene.onScreenTextGraphics || '',
        '景别(camera_shot_size)': scene.cameraShotSize || '',
        '机位角度(camera_angle)': scene.cameraAngle || '',
        '镜头运动(camera_movement)': scene.cameraMovement || '',
        '构图备注(composition_notes)': scene.compositionNotes || '',
        '灯光氛围(lighting_atmosphere)': scene.lightingAtmosphere || '',
        '色调风格(color_grading)': scene.colorGrading || '',
        '语言风格(language_style)': scene.languageStyle || '',
        '强调备注(emphasis_notes)': scene.emphasisNotes || '',
        '背景音乐(audio_bgm)': scene.audioBgm || '',
        '音效(audio_sfx)': scene.audioSfx || '',
        '环境音(ambient_sound)': scene.ambientSound || '',
        '转场方式(editing_transition)': scene.editingTransition || '',
        '节奏备注(pacing_notes)': scene.pacingNotes || '',
        '拍摄限制(filming_constraints)': scene.filmingConstraints || '',
        '合规性(constraints_compliance)': scene.constraintsCompliance || '',
        '反向限制(reverse_constraints)': scene.reverseConstraints || '',
        '所需素材(assets_needed)': scene.assetsNeeded || '',
        '句子映射(sentence_mapping)': scene.sentenceMapping || '',
        '映射备注(mapping_notes)': scene.mappingNotes || '',
        pre_analysis: stringifyValue(scene.preAnalysis),
        ...summaryColumns,
      });
    }
  }

  return rows;
}

export function createAnalysisMasterWorkbook(rows: AnalysisMasterExportRow[]): Buffer {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, worksheet, '鍒嗘瀽澶у笀');
  return Buffer.from(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
}
