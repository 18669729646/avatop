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

    return {
      // 基础信息
      项目ID: project.id,
      项目名称: project.name,
      来源类型: project.sourceType || '',
      URL: project.sourceUrl || '',
      状态: project.status || '',
      错误信息: project.error || '',
      创建时间: project.createdAt || '',
      更新时间: project.updatedAt || '',

      // 视频基础信息
      场景名称: cleanCellValue(raw.name),
      主要语言: cleanCellValue(raw.primary_language),
      画幅: cleanCellValue(raw.aspect_ratio),
      视频类型: cleanCellValue(raw.video_type),
      平台适配: cleanCellValue(raw.platform_hint),
      总时长秒: cleanCellValue(raw.total_duration_sec),

      // 表达与节奏
      整体调性: cleanCellValue(raw.overall_tone),
      能量等级: cleanCellValue(raw.energy_level),
      说话风格: cleanCellValue(raw.speaking_style),
      语速: cleanCellValue(raw.speech_rate),
      说服模式: cleanCellValue(raw.persuasion_mode),
      情绪曲线: cleanCellValue(raw.emotion_curve),

      // 视觉规范
      色调: cleanCellValue(raw.color_tone),
      光线风格: cleanCellValue(raw.lighting_style),
      氛围关键词: cleanCellValue(raw.atmosphere_keywords),
      内容密度: cleanCellValue(raw.visual_density),
      构图偏好: cleanCellValue(raw.composition_bias),
      景别: cleanCellValue(raw.camera_shot_size),
      机位角度: cleanCellValue(raw.camera_angle),
      镜头运动: cleanCellValue(raw.camera_movement),
      构图备注: cleanCellValue(raw.composition_notes),
      灯光氛围: cleanCellValue(raw.lighting_atmosphere),
      调色: cleanCellValue(raw.color_grading),

      // 音频规范
      BGM类型: cleanCellValue(raw.audio_bgm_type),
      人声处理: cleanCellValue(raw.audio_vocal_processing),
      音效密度: cleanCellValue(raw.audio_sfx_density),
      BGM描述: cleanCellValue(raw.audio_bgm),
      音效描述: cleanCellValue(raw.audio_sfx),
      环境音: cleanCellValue(raw.ambient_sound),

      // 内容素材
      画面提示词: cleanCellValue(raw.imagePrompt),
      视频提示词: cleanCellValue(raw.videoPrompt),
      动作调度: cleanCellValue(raw.action_scheduling),
      产品描述: cleanCellValue(raw.product_desc),
      必须展示: cleanCellValue(raw.must_show),
      屏幕元素: cleanCellValue(raw.on_screen_text_graphics),

      // 口播
      口播原文: cleanCellValue(raw.dialogue_vo_original),
      口播中文: cleanCellValue(raw.dialogue_vo_zh),
      语言风格: cleanCellValue(raw.language_style),
      强调备注: cleanCellValue(raw.emphasis_notes),

      // 制作规范
      转场: cleanCellValue(raw.editing_transition),
      节奏备注: cleanCellValue(raw.pacing_notes),
      拍摄约束: cleanCellValue(raw.filming_constraints),
      合规性: cleanCellValue(raw.constraints_compliance),
      反向约束: cleanCellValue(raw.reverse_constraints),
      素材需求: cleanCellValue(raw.assets_needed),
      句子映射: cleanCellValue(raw.sentence_mapping),
      映射备注: cleanCellValue(raw.mapping_notes),

      // 合规
      合规风险: cleanCellValue(raw.forbidden_claims_risk),
      强制披露: cleanCellValue(raw.must_disclose),

      // CTA
      CTA钩子: cleanCellValue(raw.cta_a),
      CTA痛点: cleanCellValue(raw.cta_b),
      CTA卖点: cleanCellValue(raw.cta_c),
      CTA转化: cleanCellValue(raw.cta_d),
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
    { wch: 40 }, // 场景名称
    { wch: 12 }, // 主要语言
    { wch: 8 },  // 画幅
    { wch: 20 }, // 视频类型
    { wch: 30 }, // 平台适配
    { wch: 8 },  // 总时长秒
    { wch: 20 }, // 整体调性
    { wch: 8 },  // 能量等级
    { wch: 15 }, // 说话风格
    { wch: 8 },  // 语速
    { wch: 25 }, // 说服模式
    { wch: 20 }, // 情绪曲线
    { wch: 15 }, // 色调
    { wch: 15 }, // 光线风格
    { wch: 20 }, // 氛围关键词
    { wch: 10 }, // 内容密度
    { wch: 25 }, // 构图偏好
    { wch: 12 }, // 景别
    { wch: 10 }, // 机位角度
    { wch: 12 }, // 镜头运动
    { wch: 30 }, // 构图备注
    { wch: 20 }, // 灯光氛围
    { wch: 15 }, // 调色
    { wch: 15 }, // BGM类型
    { wch: 12 }, // 人声处理
    { wch: 10 }, // 音效密度
    { wch: 20 }, // BGM描述
    { wch: 15 }, // 音效描述
    { wch: 15 }, // 环境音
    { wch: 80 }, // 画面提示词
    { wch: 80 }, // 视频提示词
    { wch: 60 }, // 动作调度
    { wch: 30 }, // 产品描述
    { wch: 40 }, // 必须展示
    { wch: 20 }, // 屏幕元素
    { wch: 60 }, // 口播原文
    { wch: 60 }, // 口播中文
    { wch: 15 }, // 语言风格
    { wch: 20 }, // 强调备注
    { wch: 20 }, // 转场
    { wch: 20 }, // 节奏备注
    { wch: 40 }, // 拍摄约束
    { wch: 30 }, // 合规性
    { wch: 30 }, // 反向约束
    { wch: 30 }, // 素材需求
    { wch: 15 }, // 句子映射
    { wch: 20 }, // 映射备注
    { wch: 20 }, // 合规风险
    { wch: 30 }, // 强制披露
    { wch: 40 }, // CTA钩子
    { wch: 40 }, // CTA痛点
    { wch: 40 }, // CTA卖点
    { wch: 40 }, // CTA转化
  ];

  XLSX.utils.book_append_sheet(workbook, worksheet, '分析大师');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}
