import { pgTable, serial, timestamp, varchar, text, jsonb, integer, index, boolean, uniqueIndex } from "drizzle-orm/pg-core"

// ============================================================
// 用户认证与积分系统
// ============================================================

// 用户表
export const users = pgTable(
  "users",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    phone: varchar("phone", { length: 32 }).unique().notNull(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    nickname: varchar("nickname", { length: 64 }),
    avatarUrl: text("avatar_url"),
    role: varchar("role", { length: 32 }).default('user'), // admin/user
    status: varchar("status", { length: 32 }).default('active'), // active/suspended/deleted
    createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true, mode: 'string' }),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: 'string' }),
  },
  (table) => [
    uniqueIndex("users_phone_unique").on(table.phone),
    index("users_status_idx").on(table.status),
  ]
);

// 用户积分表
export const userCredits = pgTable(
  "user_credits",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: varchar("user_id", { length: 64 }).unique().notNull().references(() => users.id, { onDelete: 'cascade' }),
    balance: integer("balance").default(0).notNull(), // 当前积分余额
    totalPurchased: integer("total_purchased").default(0).notNull(), // 累计购买积分
    totalUsed: integer("total_used").default(0).notNull(), // 累计消耗积分
    createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("user_credits_user_unique").on(table.userId),
  ]
);

// 积分套餐表（后台配置）
export const creditPackages = pgTable(
  "credit_packages",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    name: varchar("name", { length: 128 }).notNull(), // 套餐名称
    credits: integer("credits").notNull(), // 积分数量
    price: integer("price").notNull(), // 价格（分）
    bonusCredits: integer("bonus_credits").default(0), // 赠送积分
    description: text("description"),
    isActive: boolean("is_active").default(true),
    sortOrder: integer("sort_order").default(0),
    createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    index("credit_packages_active_idx").on(table.isActive, table.sortOrder),
  ]
);

// 积分订单表
export const creditOrders = pgTable(
  "credit_orders",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: varchar("user_id", { length: 64 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
    packageId: varchar("package_id", { length: 64 }).references(() => creditPackages.id),
    credits: integer("credits").notNull(), // 获得积分数量（含赠送）
    amount: integer("amount").notNull(), // 支付金额（分）
    paymentMethod: varchar("payment_method", { length: 32 }), // alipay/wechat/manual
    paymentStatus: varchar("payment_status", { length: 32 }).default('pending'), // pending/paid/failed/refunded
    paymentTransactionId: varchar("payment_transaction_id", { length: 128 }),
    adminNote: text("admin_note"), // 管理员备注
    paidAt: timestamp("paid_at", { withTimezone: true, mode: 'string' }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    index("credit_orders_user_idx").on(table.userId, table.createdAt),
    index("credit_orders_status_idx").on(table.paymentStatus, table.createdAt),
  ]
);

// 系统积分价格表（后台配置每次操作消耗）
export const systemCreditPrices = pgTable(
  "system_credit_prices",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    actionType: varchar("action_type", { length: 64 }).unique().notNull(), // image_generate/video_generate/video_trim...
    creditsRequired: integer("credits_required").notNull(), // 消耗积分
    description: text("description"),
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("system_credit_prices_action_unique").on(table.actionType),
  ]
);

// 使用记录表
export const usageRecords = pgTable(
  "usage_records",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: varchar("user_id", { length: 64 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
    actionType: varchar("action_type", { length: 64 }).notNull(),
    creditsUsed: integer("credits_used").notNull(),
    resourceId: varchar("resource_id", { length: 64 }),
    resourceType: varchar("resource_type", { length: 32 }),
    balanceBefore: integer("balance_before"),
    balanceAfter: integer("balance_after"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    index("usage_records_user_type_idx").on(table.userId, table.actionType, table.createdAt),
    index("usage_records_resource_idx").on(table.resourceType, table.resourceId),
  ]
);

// 登录日志表
export const authLogs = pgTable(
  "auth_logs",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: varchar("user_id", { length: 64 }).references(() => users.id, { onDelete: 'set null' }),
    action: varchar("action", { length: 32 }).notNull(), // login/logout/register
    ipAddress: varchar("ip_address", { length: 64 }),
    userAgent: text("user_agent"),
    success: boolean("success").default(true),
    failReason: text("fail_reason"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    index("auth_logs_user_idx").on(table.userId, table.createdAt),
    index("auth_logs_created_idx").on(table.createdAt),
  ]
);

// 用户设置表
export const userSettings = pgTable(
  "user_settings",
  {
    userId: varchar("user_id", { length: 64 }).primaryKey().references(() => users.id, { onDelete: 'cascade' }),
    language: varchar("language", { length: 16 }).default('zh-CN'),
    timezone: varchar("timezone", { length: 64 }).default('Asia/Shanghai'),
    createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  }
);

// 系统配置表（新用户注册赠送积分等）
export const systemSettings = pgTable(
  "system_settings",
  {
    key: varchar("key", { length: 64 }).primaryKey(),
    value: text("value").notNull(),
    description: text("description"),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  }
);

// ============================================================
// 系统健康检查表（Supabase 系统表，禁止删除）
// ============================================================

export const healthCheck = pgTable("health_check", {
	id: serial().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

// ============================================================
// 业务表（已添加 user_id 实现数据隔离）
// ============================================================

// 任务队列表
export const taskQueue = pgTable(
  "task_queue",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: varchar("user_id", { length: 64 }).references(() => users.id, { onDelete: 'cascade' }),
    type: varchar("type", { length: 20 }).notNull(),
    status: varchar("status", { length: 20 }).notNull(),
    params: jsonb("params").notNull().$type<Record<string, unknown>>(),
    result: jsonb("result").$type<Record<string, unknown> | null>(),
    results: jsonb("results").$type<Record<string, unknown>[] | null>(),
    error: text("error"),
    projectId: varchar("project_id", { length: 64 }), // 所属短片项目ID
    createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    startedAt: timestamp("started_at", { withTimezone: true, mode: 'string' }),
    completedAt: timestamp("completed_at", { withTimezone: true, mode: 'string' }),
    heartbeatAt: timestamp("heartbeat_at", { withTimezone: true, mode: 'string' }),
    retryCount: integer("retry_count").default(0).notNull(),
    maxRetry: integer("max_retry").default(5).notNull(),
  },
  (table) => [
    index("task_queue_user_idx").on(table.userId),
    index("task_queue_status_idx").on(table.status),
    index("task_queue_type_idx").on(table.type),
    index("task_queue_created_at_idx").on(table.createdAt),
    index("task_queue_project_id_idx").on(table.projectId),
    index("task_queue_status_heartbeat_idx").on(table.status, table.heartbeatAt),
  ]
);

// 图片历史记录表
export const imageHistory = pgTable(
  "image_history",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: varchar("user_id", { length: 64 }).references(() => users.id, { onDelete: 'cascade' }),
    url: text("url").notNull(),
    key: text("key"),
    prompt: text("prompt").notNull(),
    aspectRatio: varchar("aspect_ratio", { length: 10 }),
    resolution: varchar("resolution", { length: 10 }),
    fileSize: integer("file_size"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    index("image_history_user_idx").on(table.userId),
    index("image_history_created_at_idx").on(table.createdAt),
  ]
);

// 视频历史记录表
export const videoHistory = pgTable(
  "video_history",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: varchar("user_id", { length: 64 }).references(() => users.id, { onDelete: 'cascade' }),
    url: text("url"),
    key: text("key"),
    prompt: text("prompt").notNull(),
    aspectRatio: varchar("aspect_ratio", { length: 10 }),
    duration: integer("duration"),
    fileSize: integer("file_size"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    index("video_history_user_idx").on(table.userId),
    index("video_history_created_at_idx").on(table.createdAt),
  ]
);

// 角色图库表
export const characterLibrary = pgTable(
  "character_library",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: varchar("user_id", { length: 64 }).references(() => users.id, { onDelete: 'cascade' }),
    name: varchar("name", { length: 128 }).notNull(),
    url: text("url").notNull(),
    key: text("key"),
    description: text("description"),
    tags: jsonb("tags").$type<string[]>().default([]),
    fileSize: integer("file_size"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    index("character_library_user_idx").on(table.userId),
    index("character_library_created_at_idx").on(table.createdAt),
  ]
);

// 产品管理表（完整版）
export const products = pgTable(
  "products",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: varchar("user_id", { length: 64 }).references(() => users.id, { onDelete: 'cascade' }),
    name: varchar("name", { length: 256 }).notNull(),
    description: text("description"),
    sellingPoints: jsonb("selling_points").$type<string[]>().default([]),
    targetAudience: text("target_audience"),
    usageScenarios: text("usage_scenarios"),
    brandInfo: text("brand_info"),
    priceRange: varchar("price_range", { length: 64 }),
    keywords: jsonb("keywords").$type<string[]>().default([]),
    images: jsonb("images").$type<Array<{
      id: string;
      key: string;
      url: string;
      isPrimary: boolean;
      description?: string;
      createdAt: number;
    }>>().default([]),
    createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    index("products_user_idx").on(table.userId),
    index("products_created_at_idx").on(table.createdAt),
  ]
);

// 短片项目表
export const shortfilmProjects = pgTable(
  "shortfilm_projects",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: varchar("user_id", { length: 64 }).references(() => users.id, { onDelete: 'cascade' }),
    name: varchar("name", { length: 256 }).notNull(),
    sourceType: varchar("source_type", { length: 16 }).default('original'),
    sourceVideoKey: text("source_video_key"),
    sourceVideoUrl: text("source_video_url"),
    videoDuration: integer("video_duration"),
    productId: varchar("product_id", { length: 64 }),
    productName: varchar("product_name", { length: 256 }),
    productImages: jsonb("product_images").$type<Array<{
      key: string;
      url: string;
    }>>().default([]),
    productDescription: text("product_description"),
    scriptPrompt: text("script_prompt"),
    scriptGenerationMode: varchar("script_generation_mode", { length: 16 }).default('ai'),
    totalDuration: integer("total_duration").default(0),
    scriptSegments: jsonb("script_segments").$type<Array<{
      id: string;
      order: number;
      duration: number;
      imagePrompt: string;
      videoPrompt: string;
      description: string;
      hookType?: string;
      sellingPoint?: string;
    }>>().default([]),
    imageTasks: jsonb("image_tasks").$type<Array<{
      id: string;
      segmentId: string;
      order: number;
      prompt: string;
      referenceImages?: string[];
      characterImages?: Array<{ id: string; url: string; name?: string }>;
      generatedImages: Array<{ id: string; key: string; url: string; createdAt: number }>;
      status: string;
      selectedImageId?: string;
    }>>().default([]),
    videoTasks: jsonb("video_tasks").$type<Array<{
      id: string;
      segmentId: string;
      order: number;
      prompt: string;
      startFrameImageId: string;
      endFrameImageId: string;
      startFrameUrl?: string;
      endFrameUrl?: string;
      model: string;
      aspectRatio: string;
      duration: number;
      status: string;
      apiTaskId?: string;
      generatedVideos: Array<{ id: string; key: string; url: string; taskId: string; createdAt: number }>;
      selectedVideoId?: string;
    }>>().default([]),
    mergedVideos: jsonb("merged_videos").$type<Array<{
      id: string;
      key: string;
      url: string;
      projectName: string;
      videoCount: number;
      duration: number;
      size: number;
      createdAt: number;
    }>>().default([]),
    selectedCharacters: jsonb("selected_characters").$type<Array<{
      id: string;
      url: string;
      name?: string;
    }>>().default([]),
    currentStep: integer("current_step").default(1),
    status: varchar("status", { length: 32 }).default('draft'),
    createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    index("shortfilm_projects_user_idx").on(table.userId),
    index("shortfilm_projects_created_at_idx").on(table.createdAt),
    index("shortfilm_projects_status_idx").on(table.status),
  ]
);

// 短片模板表
export const shortfilmTemplates = pgTable(
  "shortfilm_templates",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: varchar("user_id", { length: 64 }).references(() => users.id, { onDelete: 'cascade' }),
    name: varchar("name", { length: 128 }).notNull(),
    description: text("description"),
    category: varchar("category", { length: 32 }).default('custom'),
    duration: integer("duration").default(0),
    promptTemplate: text("prompt_template"),
    tags: jsonb("tags").$type<string[]>().default([]),
    isSystem: boolean("is_system").default(false),
    hookType: varchar("hook_type", { length: 32 }),
    hookTypeName: varchar("hook_type_name", { length: 64 }),
    targetAudience: text("target_audience"),
    useCreator: boolean("use_creator").default(true),
    creatorGender: varchar("creator_gender", { length: 16 }),
    enableNarration: boolean("enable_narration").default(false),
    segments: jsonb("segments").$type<TemplateSegment[]>().default([]),
    templatePrompt: jsonb("template_prompt").$type<TemplatePrompt>(),
    productId: varchar("product_id", { length: 64 }),
    productName: varchar("product_name", { length: 128 }),
    productInfo: text("product_info"),
    sellingPoints: text("selling_points"),
    productImages: jsonb("product_images").$type<Array<{
      key: string;
      url: string;
    }>>().default([]),
    finalPrompt: text("final_prompt"),
    usageCount: integer("usage_count").default(0),
    createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    index("shortfilm_templates_user_idx").on(table.userId),
    index("shortfilm_templates_created_at_idx").on(table.createdAt),
    index("shortfilm_templates_category_idx").on(table.category),
  ]
);

// 模板段落类型
export interface TemplateSegment {
  id: string;
  order: number;
  duration: number;
  description: string;
  imagePrompt: string;
  videoPrompt: string;
  hookType?: string;
  sellingPoint?: string;
}

// 模板提示词类型
export interface TemplatePrompt {
  productInfo: string;
  productCategory: string;
  targetAudience: string;
  sellingPoints: string;
  hookType: string;
  hookTypeName: string;
  hookDescription?: string;
  hookTemplate?: string;
  duration: number;
  useCreator: boolean;
  creatorGender?: 'female' | 'male' | 'any';
  enableNarration?: boolean;
  createdAt: number;
}

// 提示词模板表
export const promptTemplates = pgTable(
  "prompt_templates",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: varchar("user_id", { length: 64 }).references(() => users.id, { onDelete: 'cascade' }),
    name: varchar("name", { length: 128 }).notNull(),
    description: text("description"),
    category: varchar("category", { length: 32 }).default('custom'),
    type: varchar("type", { length: 16 }).default('image'),
    prompt: text("prompt").notNull(),
    defaultParams: jsonb("default_params").$type<{
      aspectRatio?: string;
      resolution?: string;
      model?: string;
      enhancePrompt?: boolean;
      enableUpsample?: boolean;
    }>(),
    variables: jsonb("variables").$type<Array<{
      key: string;
      label: string;
      placeholder: string;
      defaultValue?: string;
      required?: boolean;
      options?: string[];
    }>>(),
    tags: jsonb("tags").$type<string[]>().default([]),
    isSystem: boolean("is_system").default(false),
    isHot: boolean("is_hot").default(false),
    createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    index("prompt_templates_user_idx").on(table.userId),
    index("prompt_templates_created_at_idx").on(table.createdAt),
    index("prompt_templates_category_idx").on(table.category),
    index("prompt_templates_type_idx").on(table.type),
  ]
);

// 系统配置表
export const systemConfig = pgTable(
  "system_config",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    configType: varchar("config_type", { length: 32 }).notNull(),
    name: varchar("name", { length: 128 }).notNull(),
    apiKey: text("api_key"),
    baseUrl: text("base_url"),
    model: varchar("model", { length: 128 }),
    defaultAspectRatio: varchar("default_aspect_ratio", { length: 10 }),
    defaultResolution: varchar("default_resolution", { length: 10 }),
    isDefault: boolean("is_default").default(false),
    extraConfig: jsonb("extra_config").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    index("system_config_type_idx").on(table.configType),
    index("system_config_is_default_idx").on(table.isDefault),
  ]
);

// 用户偏好表 - 存储用户级别的偏好设置
export const userPreferences = pgTable(
  "user_preferences",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: varchar("user_id", { length: 64 }).references(() => users.id, { onDelete: 'cascade' }),
    favoriteTemplates: jsonb("favorite_templates").$type<string[]>().default([]),
    recentTemplates: jsonb("recent_templates").$type<Array<{
      id: string;
      usedAt: number;
      variableValues?: Record<string, string>;
    }>>().default([]),
    templateUsageStats: jsonb("template_usage_stats").$type<Record<string, number>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    index("user_preferences_user_idx").on(table.userId),
  ]
);

// 队列配置表
export const queueConfig = pgTable(
  "queue_config",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    maxConcurrent: integer("max_concurrent").default(3).notNull(),
    retryDelay: integer("retry_delay").default(5000).notNull(),
    maxRetry: integer("max_retry").default(5).notNull(),
    taskTimeout: integer("task_timeout").default(120000).notNull(),
    autoStart: boolean("auto_start").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  }
);

// 视频复刻项目表
export const videoRemakeProjects = pgTable(
  "video_remake_projects",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: varchar("user_id", { length: 64 }).references(() => users.id, { onDelete: 'cascade' }),
    name: varchar("name", { length: 256 }).notNull(),
    sourceType: varchar("source_type", { length: 16 }).notNull(),
    sourceUrl: text("source_url"),
    sourcePath: text("source_path"),
    originalVideoKey: text("original_video_key"),
    fileSize: integer("file_size"),
    videoDuration: integer("video_duration"),
    parseStatus: varchar("parse_status", { length: 32 }).default('pending'),
    parseResult: jsonb("parse_result").$type<Record<string, unknown>>(),
    parseError: text("parse_error"),
    script: jsonb("script").$type<Record<string, unknown>>(),
    customizations: jsonb("customizations").$type<Record<string, unknown>>(),
    keyframesExtracted: boolean("keyframes_extracted").default(false),
    voicePresetId: varchar("voice_preset_id", { length: 32 }).default('warm_female'),
    mergedVideoKey: text("merged_video_key"),
    mergedVideoUrl: text("merged_video_url"),
    mergeError: text("merge_error"),
    status: varchar("status", { length: 32 }).default('pending'),
    createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    index("video_remake_projects_user_idx").on(table.userId),
    index("video_remake_projects_status_idx").on(table.status),
    index("video_remake_projects_parse_status_idx").on(table.parseStatus),
    index("video_remake_projects_created_at_idx").on(table.createdAt),
  ]
);

// 视频复刻分镜表
export const videoRemakeScenes = pgTable(
  "video_remake_scenes",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: varchar("user_id", { length: 64 }).references(() => users.id, { onDelete: 'cascade' }),
    projectId: varchar("project_id", { length: 64 }).notNull().references(() => videoRemakeProjects.id, { onDelete: 'cascade' }),
    sceneIndex: integer("scene_index").notNull(),
    startTime: integer("start_time"),
    endTime: integer("end_time"),
    duration: integer("duration"),
    description: text("description"),
    actionSequence: jsonb("action_sequence").$type<Record<string, unknown>>(),
    audioText: text("audio_text"),
    audioStyle: text("audio_style"),
    pace: text("pace"),
    visualPrompt: text("visual_prompt"),
    audioPrompt: text("audio_prompt"),
    speechText: text("speech_text"),
    voiceOver: text("voice_over"),
    backgroundMusic: text("background_music"),
    customizations: jsonb("customizations").$type<Record<string, unknown>>().default({}),
    shotType: varchar("shot_type", { length: 32 }),
    cameraMovement: varchar("camera_movement", { length: 32 }),
    cameraSpeed: varchar("camera_speed", { length: 16 }),
    composition: jsonb("composition").$type<Record<string, unknown>>().default({}),
    characterInfo: jsonb("character_info").$type<Record<string, unknown>>().default({}),
    generatedImageKey: text("generated_image_key"),
    generatedImageUrl: text("generated_image_url"),
    generatedVideoKey: text("generated_video_key"),
    generatedVideoUrl: text("generated_video_url"),
    videoKey: text("video_key"),
    videoUrl: text("video_url"),
    videoFileSize: integer("video_file_size"),
    status: varchar("status", { length: 32 }).default('pending'),
    videoStatus: varchar("video_status", { length: 32 }).default('pending'),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    index("video_remake_scenes_user_idx").on(table.userId),
    index("video_remake_scenes_project_idx").on(table.projectId, table.sceneIndex),
    index("video_remake_scenes_status_idx").on(table.status),
    index("video_remake_scenes_video_status_idx").on(table.videoStatus),
  ]
);

// 视频复刻输出表
export const videoRemakeOutputs = pgTable(
  "video_remake_outputs",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: varchar("user_id", { length: 64 }).references(() => users.id, { onDelete: 'cascade' }),
    projectId: varchar("project_id", { length: 64 }).notNull().references(() => videoRemakeProjects.id, { onDelete: 'cascade' }),
    outputType: varchar("output_type", { length: 32 }).notNull(),
    outputKey: text("output_key"),
    outputUrl: text("output_url"),
    thumbnailKey: text("thumbnail_key"),
    duration: integer("duration"),
    resolution: varchar("resolution", { length: 32 }),
    fileSize: integer("file_size"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    status: varchar("status", { length: 32 }).default('completed'),
    createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    index("video_remake_outputs_user_idx").on(table.userId),
    index("video_remake_outputs_project_idx").on(table.projectId, table.createdAt),
    index("video_remake_outputs_created_at_idx").on(table.createdAt),
  ]
);

// 系统提示词配置表
export const systemPromptConfig = pgTable(
  "system_prompt_config",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: varchar("user_id", { length: 64 }).references(() => users.id, { onDelete: 'cascade' }),
    systemPrompt: text("system_prompt"),
    defaultPrompt: text("default_prompt"),
    variablesUsed: jsonb("variables_used").$type<string[]>().default([]),
    createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    index("system_prompt_config_user_idx").on(table.userId),
  ]
);

// 视频复刻关键帧表
export const videoRemakeKeyframes = pgTable(
  "video_remake_keyframes",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    projectId: varchar("project_id", { length: 64 }).notNull().references(() => videoRemakeProjects.id, { onDelete: 'cascade' }),
    frameIndex: integer("frame_index").notNull(),
    timestampMs: integer("timestamp_ms").notNull(),
    imageKey: text("image_key"),
    imageUrl: text("image_url"),
    ssimScore: integer("ssim_score"),
    isKeyScene: boolean("is_key_scene").default(false),
    createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_keyframes_project").on(table.projectId),
  ]
);

// 视频复刻替换素材表
export const videoRemakeAssets = pgTable(
  "video_remake_assets",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: varchar("user_id", { length: 64 }).notNull(),
    projectId: varchar("project_id", { length: 64 }).notNull().references(() => videoRemakeProjects.id, { onDelete: 'cascade' }),
    assetType: varchar("asset_type", { length: 32 }).notNull(),
    fileKey: text("file_key").notNull(),
    fileUrl: text("file_url"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_assets_project").on(table.projectId),
    index("idx_assets_user").on(table.userId),
  ]
);

// 分析大师项目表
export const analysisMasterProjects = pgTable(
  "analysis_master_projects",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: varchar("user_id", { length: 64 }).references(() => users.id, { onDelete: 'cascade' }),
    name: varchar("name", { length: 256 }).notNull(),
    sourceType: varchar("source_type", { length: 32 }).default('link').notNull(),
    sourceUrl: text("source_url"),
    videoKey: text("video_key"),
    videoUrl: text("video_url"),
    videoDuration: integer("video_duration"),
    fileSize: integer("file_size"),
    status: varchar("status", { length: 32 }).default('draft'),
    result: jsonb("result").$type<Record<string, unknown>>(),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    index("analysis_master_projects_user_idx").on(table.userId, table.updatedAt),
    index("analysis_master_projects_status_idx").on(table.status),
  ]
);

// ============================================================
// TypeScript 类型导出
// ============================================================

// 用户认证类型
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type UserCredits = typeof userCredits.$inferSelect;
export type InsertUserCredits = typeof userCredits.$inferInsert;
export type CreditPackage = typeof creditPackages.$inferSelect;
export type InsertCreditPackage = typeof creditPackages.$inferInsert;
export type CreditOrder = typeof creditOrders.$inferSelect;
export type InsertCreditOrder = typeof creditOrders.$inferInsert;
export type SystemCreditPrice = typeof systemCreditPrices.$inferSelect;
export type InsertSystemCreditPrice = typeof systemCreditPrices.$inferInsert;
export type UsageRecord = typeof usageRecords.$inferSelect;
export type InsertUsageRecord = typeof usageRecords.$inferInsert;
export type AuthLog = typeof authLogs.$inferSelect;
export type InsertAuthLog = typeof authLogs.$inferInsert;
export type UserSetting = typeof userSettings.$inferSelect;
export type InsertUserSetting = typeof userSettings.$inferInsert;
export type SystemSetting = typeof systemSettings.$inferSelect;

// 业务类型
export type TaskQueueItem = typeof taskQueue.$inferSelect;
export type InsertTaskQueueItem = typeof taskQueue.$inferInsert;
export type ImageHistoryItem = typeof imageHistory.$inferSelect;
export type InsertImageHistoryItem = typeof imageHistory.$inferInsert;
export type VideoHistoryItem = typeof videoHistory.$inferSelect;
export type InsertVideoHistoryItem = typeof videoHistory.$inferInsert;
export type CharacterItem = typeof characterLibrary.$inferSelect;
export type InsertCharacterItem = typeof characterLibrary.$inferInsert;
export type Product = typeof products.$inferSelect;
export type InsertProduct = typeof products.$inferInsert;
export type ShortfilmProject = typeof shortfilmProjects.$inferSelect;
export type InsertShortfilmProject = typeof shortfilmProjects.$inferInsert;
export type ShortfilmTemplate = typeof shortfilmTemplates.$inferSelect;
export type InsertShortfilmTemplate = typeof shortfilmTemplates.$inferInsert;
export type VideoRemakeProject = typeof videoRemakeProjects.$inferSelect;
export type InsertVideoRemakeProject = typeof videoRemakeProjects.$inferInsert;
export type VideoRemakeScene = typeof videoRemakeScenes.$inferSelect;
export type InsertVideoRemakeScene = typeof videoRemakeScenes.$inferInsert;
export type VideoRemakeOutput = typeof videoRemakeOutputs.$inferSelect;
export type InsertVideoRemakeOutput = typeof videoRemakeOutputs.$inferInsert;
export type PromptTemplateDB = typeof promptTemplates.$inferSelect;
export type InsertPromptTemplate = typeof promptTemplates.$inferInsert;
export type SystemConfigItem = typeof systemConfig.$inferSelect;
export type InsertSystemConfigItem = typeof systemConfig.$inferInsert;
export type UserPreferences = typeof userPreferences.$inferSelect;
export type InsertUserPreferences = typeof userPreferences.$inferInsert;
export type QueueConfigDB = typeof queueConfig.$inferSelect;
export type InsertQueueConfig = typeof queueConfig.$inferInsert;
export type SystemPromptConfig = typeof systemPromptConfig.$inferSelect;
export type InsertSystemPromptConfig = typeof systemPromptConfig.$inferInsert;
export type VideoRemakeKeyframe = typeof videoRemakeKeyframes.$inferSelect;
export type InsertVideoRemakeKeyframe = typeof videoRemakeKeyframes.$inferInsert;
export type VideoRemakeAsset = typeof videoRemakeAssets.$inferSelect;
export type InsertVideoRemakeAsset = typeof videoRemakeAssets.$inferInsert;
export type AnalysisMasterProject = typeof analysisMasterProjects.$inferSelect;
export type InsertAnalysisMasterProject = typeof analysisMasterProjects.$inferInsert;
