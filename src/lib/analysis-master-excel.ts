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
  return projects.map((project) => {
    const result = project.result || {};
    const raw = (result.raw || {}) as Record<string, unknown>;
    const preAnalysis = (raw.pre_analysis || {}) as Record<string, unknown>;
    const rawScenes = (raw.scenes || []) as Array<Record<string, unknown>>;
    const topScenes = (result.scenes || []) as Array<Record<string, unknown>>;
    const allScenes = rawScenes.length > 0 ? rawScenes : topScenes;
    const firstScene = allScenes[0] as Record<string, unknown> || {};

    // 提取 raw.name（场景名称）作为整体总结的备用
    const summary = String(result.summary || raw.name || '');
    const videoType = String(result.videoType || preAnalysis.video_type || '');
    const targetAudience = String(result.targetAudience || '');
    const sellingPoints = Array.isArray(result.sellingPoints)
      ? result.sellingPoints.filter(Boolean).join('，')
      : '';

    return {
      项目ID: project.id,
      项目名称: project.name,
      来源类型: project.sourceType || '',
      URL: project.sourceUrl || '',
      状态: project.status || '',
      错误信息: project.error || '',
      创建时间: project.createdAt || '',
      更新时间: project.updatedAt || '',

      // 整体分析结果
      整体总结: summary,
      视频类型: videoType,
      目标人群: targetAudience,
      卖点汇总: sellingPoints,
      CTA钩子: String(result.cta_a || ''),
      CTA痛点: String(result.cta_b || ''),
      CTA卖点: String(result.cta_c || ''),
      CTA转化: String(result.cta_d || ''),
      口播原文: String(result.dialogue_vo_original || ''),
      口播中文: String(result.dialogue_vo_zh || ''),

      // 预分析信息
      画面色调: String(preAnalysis.color_tone || ''),
      能量等级: String(preAnalysis.energy_level || ''),
      整体调性: String(preAnalysis.overall_tone || ''),
      情绪曲线: String(preAnalysis.emotion_curve || ''),
      平台适配: String(preAnalysis.platform_hint || ''),
      光线风格: String(preAnalysis.lighting_style || ''),
      背景音乐: String(preAnalysis.audio_bgm_type || ''),
      BGM音量: String(preAnalysis.audio_vocal_processing || ''),
      视频时长秒: Number(preAnalysis.total_duration_sec) || '',
      画幅: String(preAnalysis.aspect_ratio || ''),
      内容密度: String(preAnalysis.visual_density || ''),
      说服模式: String(preAnalysis.persuasion_mode || ''),
      构图偏好: String(preAnalysis.composition_bias || ''),
      氛围关键词: String(preAnalysis.atmosphere_keywords || ''),
      风险提示: String(preAnalysis.forbidden_claims_risk || ''),

      // 分镜1详情
      分镜1名称: String(firstScene.name || ''),
      分镜1时长秒: Number(firstScene.duration) || '',
      分镜1画面提示词: String(firstScene.imagePrompt || ''),
      分镜1视频提示词: String(firstScene.videoPrompt || ''),
      分镜1口播文本: String(firstScene.speechText || ''),
      分镜1卖点: String(firstScene.sellingPoint || ''),
      分镜1景别: String(firstScene.cameraShotSize || firstScene.camera_shot_size || ''),
      分镜1机位角度: String(firstScene.cameraAngle || firstScene.camera_angle || ''),
      分镜1镜头运动: String(firstScene.cameraMovement || firstScene.camera_movement || ''),
      分镜1构图备注: String(firstScene.compositionNotes || firstScene.composition_notes || ''),
      分镜1灯光氛围: String(firstScene.lightingAtmosphere || firstScene.lighting_atmosphere || ''),
      分镜1色调: String(firstScene.colorGrading || firstScene.color_grading || ''),
      分镜1BGM: String(firstScene.audioBgm || firstScene.audio_bgm || ''),
      分镜1产品描述: String(firstScene.productDesc || firstScene.product_desc || ''),
      分镜1必须展示: String(firstScene.mustShow || firstScene.must_show || ''),
      分镜1动作调度: String(firstScene.actionScheduling || firstScene.action_scheduling || ''),
      分镜1转场: String(firstScene.editingTransition || firstScene.editing_transition || ''),
      分镜1合规性: String(firstScene.constraintsCompliance || firstScene.constraints_compliance || ''),
    };
  });
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
    { wch: 10 }, // 状态
    { wch: 40 }, // 错误信息
    { wch: 20 }, // 创建时间
    { wch: 20 }, // 更新时间
    { wch: 40 }, // 整体总结
    { wch: 15 }, // 视频类型
    { wch: 20 }, // 目标人群
    { wch: 30 }, // 卖点汇总
    { wch: 30 }, // CTA钩子
    { wch: 30 }, // CTA痛点
    { wch: 30 }, // CTA卖点
    { wch: 30 }, // CTA转化
    { wch: 40 }, // 口播原文
    { wch: 40 }, // 口播中文
    { wch: 12 }, // 画面色调
    { wch: 10 }, // 能量等级
    { wch: 15 }, // 整体调性
    { wch: 20 }, // 情绪曲线
    { wch: 20 }, // 平台适配
    { wch: 15 }, // 光线风格
    { wch: 15 }, // 背景音乐
    { wch: 10 }, // BGM音量
    { wch: 10 }, // 视频时长秒
    { wch: 10 }, // 画幅
    { wch: 10 }, // 内容密度
    { wch: 20 }, // 说服模式
    { wch: 20 }, // 构图偏好
    { wch: 20 }, // 氛围关键词
    { wch: 20 }, // 风险提示
    { wch: 20 }, // 分镜1名称
    { wch: 10 }, // 分镜1时长秒
    { wch: 80 }, // 分镜1画面提示词
    { wch: 80 }, // 分镜1视频提示词
    { wch: 40 }, // 分镜1口播文本
    { wch: 30 }, // 分镜1卖点
    { wch: 10 }, // 分镜1景别
    { wch: 12 }, // 分镜1机位角度
    { wch: 15 }, // 分镜1镜头运动
    { wch: 30 }, // 分镜1构图备注
    { wch: 20 }, // 分镜1灯光氛围
    { wch: 15 }, // 分镜1色调
    { wch: 20 }, // 分镜1BGM
    { wch: 30 }, // 分镜1产品描述
    { wch: 30 }, // 分镜1必须展示
    { wch: 60 }, // 分镜1动作调度
    { wch: 20 }, // 分镜1转场
    { wch: 20 }, // 分镜1合规性
  ];

  XLSX.utils.book_append_sheet(workbook, worksheet, '分析大师');
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

  // 添加 UTF-8 BOM 解决中文乱码
  const bom = Buffer.from([0xef, 0xbb, 0xbf]);
  return Buffer.concat([bom, buffer]);
}
