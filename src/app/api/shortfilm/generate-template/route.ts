import { NextRequest, NextResponse } from 'next/server';
import { longRunningAgent } from '@/lib/fetch-agent';
import { getServerDefaultTextApi } from '@/lib/server-config';

// AI生成短片模板接口
// 基于爆款带货短视频创作方法论，自动生成专业的脚本模板

export async function POST(request: NextRequest) {
  try {
    const { 
      templateName,       // 模板名称
      productInfo,        // 产品信息描述
      productCategory,    // 产品类别：beauty/food/digital/clothing/home/other
      targetAudience,     // 目标受众
      sellingPoints,      // 核心卖点
      hookType,           // 钩子类型：pain_point/subversion/result_first/suspense/identity/data_shock/contrast/scarcity/highlight/social_currency
      duration,           // 视频时长：16/24/32
      useCreator = true,  // 达人出境选项，默认开启
      creatorGender = 'female', // 达人性别：female/male/any
      apiKey: _apiKey,
      baseUrl: _baseUrl,
      model: _model
    } = await request.json();

    if (!productInfo) {
      return NextResponse.json(
        { error: '请提供产品信息' },
        { status: 400 }
      );
    }

    // 从数据库获取 API 配置（优先使用数据库配置，忽略前端传递的 apiKey）
    const defaultTextApi = await getServerDefaultTextApi();
    const finalApiKey = defaultTextApi?.apiKey || process.env.YUNWU_API_KEY || '';
    const finalBaseUrl = defaultTextApi?.baseUrl || _baseUrl || 'https://yunwu.ai/v1beta';
    const finalModel = defaultTextApi?.model || _model || 'gemini-3.1-pro-preview';

    console.log(`[Template] Generating template for: ${productInfo}, hookType: ${hookType}, useCreator: ${useCreator}, creatorGender: ${creatorGender}`);

    // 计算片段数量：8秒2段落，16秒3段落，24秒4段落
    // 段落数 = 时长/8 + 1，视频数 = 段落数 - 1
    const imageSegmentCount = duration / 8 + 1;
    const videoSegmentCount = imageSegmentCount - 1;

    // 10种钩子类型详细映射
    const hookTypeMap: Record<string, { name: string; description: string; template: string; examples: string[] }> = {
      pain_point: {
        name: '痛点暴击钩子',
        description: '直接戳中用户痛点，制造"这说的就是我"的共鸣感',
        template: '你是不是也{具体痛点}？',
        examples: ['你是不是也每天熬夜，皮肤却越来越差？', '你是不是也感觉减肥太难坚持？']
      },
      subversion: {
        name: '颠覆认知钩子',
        description: '挑战普遍认知，制造信息差和好奇心',
        template: '别再{错误做法}了！/ 90%的人都不知道...',
        examples: ['别再用洗面奶洗脸了，医生说这招更管用！', '90%的人都不知道，睡前这样做反而伤身！']
      },
      result_first: {
        name: '结果前置钩子',
        description: '直接展示惊人结果，激发"我也想要"的欲望',
        template: '{时间}内，{达成了什么惊人结果}',
        examples: ['30天，我从暗黄肌变成自带高光！', '只换了一个习惯，我一个月瘦了8斤！']
      },
      suspense: {
        name: '悬念提问钩子',
        description: '抛出反常问题，利用完形心理迫使观看',
        template: '为什么{反常现象}？/ 你绝对猜不到...',
        examples: ['为什么有些女生不化妆，皮肤却比化妆的还好？', '你绝对猜不到，这家快倒闭的店年赚百万！']
      },
      identity: {
        name: '身份宣称钩子',
        description: '精准锁定目标人群，制造"被召唤"的归属感',
        template: '所有{特定人群}注意！/ 刷到这条视频的{人群}恭喜你！',
        examples: ['所有熬夜党注意！这可能是你今年最有价值的视频！', '家里有三年级小学生的家长，请一定看完！']
      },
      data_shock: {
        name: '数据冲击钩子',
        description: '用具体数字增强可信度和冲击力',
        template: '{权威数据} + {反差结论}',
        examples: ['73%的女生用错了护肤品，难怪越用越干！', '调研显示：92%的人刷牙时间不足45秒！']
      },
      contrast: {
        name: '对比反差钩子',
        description: '用强烈的前后对比制造视觉冲击',
        template: '左边{失败案例} vs 右边{成功案例}',
        examples: ['同样是素颜出门，左边是我，右边也是我！', '使用前vs使用后，差距太大了！']
      },
      scarcity: {
        name: '优惠稀缺钩子',
        description: '制造紧迫感和稀缺感，促成立即行动',
        template: '限时/限量信息 + 不行动的损失',
        examples: ['库存只剩200单，这个价格错过再等一年！', '限时3天！这个价格手慢无！']
      },
      highlight: {
        name: '高能片段钩子',
        description: '把最有情绪张力的片段直接放到开头',
        template: '直接展示戏剧性/冲突性片段',
        examples: ['展示使用产品时的惊喜表情', '直接展示惊艳的变身效果']
      },
      social_currency: {
        name: '社交货币钩子',
        description: '让用户感觉"我知道别人不知道的"，制造优越感',
        template: '内行人才知道... / 只有小众圈子才知道...',
        examples: ['柜姐不会告诉你的护肤秘密，今天全公开！', '摄影圈内都在传的调色参数，绝不外传！']
      }
    };

    // 获取选中的钩子信息
    const selectedHook = hookTypeMap[hookType as keyof typeof hookTypeMap] || hookTypeMap.pain_point;

    // 产品类别关键词映射
    const categoryKeywords: Record<string, string> = {
      beauty: '美妆护肤、彩妆、护肤、美容、化妆品',
      food: '食品饮料、零食、饮品、美食、健康食品',
      digital: '数码电子、手机配件、智能设备、电子数码',
      clothing: '服装服饰、穿搭、时尚、服装',
      home: '家居生活、家居、日用品、生活用品',
      other: '综合产品'
    };

    // 构建系统提示词 - 基于爆款带货短视频创作方法论
    const systemPrompt = `你是一位专业的短视频脚本策划专家，精通TikTok、抖音、小红书等平台的爆款带货短视频创作方法论。

## 核心：黄金3秒钩子法则

开场3秒决定视频生死，必须用强力钩子抓住注意力。以下是经过验证的10种高转化钩子：

### 1. 痛点暴击钩子
直接戳中用户痛点，制造"这说的就是我"的共鸣感。
- 结构："你是不是也(具体痛点)?"
- 案例："你是不是也每天忙到深夜，皮肤却越来越差?"
- 适用：功能性产品、解决痛点的产品

### 2. 颠覆认知钩子
挑战普遍认知，制造信息差和好奇心。
- 结构："别再(错误做法)了!/ 90%的人都不知道..."
- 案例："别再用洗面奶洗脸了，皮肤科医生说这招更管用!"
- 适用：有独特卖点、能打破常规的产品

### 3. 结果前置钩子
直接展示惊人结果，激发"我也想要"的欲望。
- 结构："(时间)内，(达成了什么惊人结果)"
- 案例："30天，我从暗黄肌变成自带高光!"
- 适用：效果明显、有对比性的产品

### 4. 悬念提问钩子
抛出反常问题，利用完形心理迫使观看。
- 结构："为什么(反常现象)?/ 你绝对猜不到..."
- 案例："为什么有些女生不化妆，皮肤却比化妆的还好?"
- 适用：有故事性、揭秘性的产品

### 5. 身份宣称钩子
精准锁定目标人群，制造"被召唤"的归属感。
- 结构："所有(特定人群)注意!/ 刷到这条视频的(人群)恭喜你!"
- 案例："所有熬夜党注意!这可能是你今年刷到最有价值的视频!"
- 适用：有明确目标受众的产品

### 6. 数据冲击钩子
用具体数字增强可信度和冲击力。
- 结构："(权威数据)+ (反差结论)"
- 案例："2024调研显示：73%的女生用错了护肤品，难怪越用越干!"
- 适用：有数据支撑、专业性的产品

### 7. 对比反差钩子
用强烈的前后对比制造视觉冲击。
- 结构："左边(失败案例) vs 右边(成功案例)"
- 案例："同样是素颜出门，左边是我，右边也是我——只差这一个步骤!"
- 适用：效果对比明显的产品

### 8. 优惠稀缺钩子
制造紧迫感和稀缺感，促成立即行动。
- 结构："限时/限量信息 + 不行动的损失"
- 案例："库存只剩200单，这个价格错过再等一年!"
- 适用：促销、限时优惠活动

### 9. 高能片段钩子
把最有情绪张力的片段直接放到开头。
- 结构：直接展示戏剧性/冲突性片段
- 案例：展示使用产品时的惊喜表情或惊艳效果
- 适用：有强烈视觉效果的产品

### 10. 社交货币钩子
让用户感觉"我知道别人不知道的"，制造优越感。
- 结构："内行人才知道.../ 只有小众圈子才知道..."
- 案例："柜姐不会告诉你的护肤秘密，今天全公开!"
- 适用：有行业秘密、小众好物

## 开场吸引力公式
吸引力 = (痛点精准度 × 形式新颖度) ÷ (认知复杂度 + 执行难度)
- 痛点越精准、形式越新颖，吸引力越强
- 认知复杂度越低、执行难度越低，吸引力越强

## 中段爆点策略（维持注意力）
- 每5-8秒切换信息点，保持节奏
- 痛点场景化：用具象场景替代抽象描述
- 产品证明：对比测试、数据量化、细节特写
- 情绪递进：问题→颠覆→解决方案

## 结尾转化技巧
- 明确行动指令："点击下方小黄车"
- 风险消除："支持7天无理由退换"
- 制造紧迫感："限量X件，售完即止"
- 价值承诺："让你(获得具体好处)"

## 重要：图片与视频的关系

短片创作流程：先生成每段的图片，然后以图片作为首帧生成视频。
- **段落1**：只需要图片提示词，不需要视频提示词（开场图片，后续视频从段落2开始）
- **段落2及以后**：需要图片提示词和视频提示词
- **视频提示词**：描述从当前段落的图片开始的动态效果、运镜、转场

${useCreator ? `## 达人出境模式（已启用）

**重要：本视频需要达人出境展示产品！**

${creatorGender === 'female' ? `### 达人性别要求
**必须使用女性达人**，年龄约25-35岁，形象气质佳，符合目标受众审美。

### 女性达人形象模板
- "一位年轻女性达人（25-30岁），皮肤白皙，穿着简约时尚的白色上衣，化淡妆，气质温婉亲切..."
- "女性达人微笑着拿起产品，眼神温柔看向镜头，手势优雅..."
- "女性达人轻轻转动产品，展示各个角度的细节，表情满意..."
` : creatorGender === 'male' ? `### 达人性别要求
**必须使用男性达人**，年龄约25-35岁，形象阳光自信，符合目标受众审美。

### 男性达人形象模板
- "一位年轻男性达人（25-35岁），面容干净清爽，穿着简约休闲的T恤或衬衫，气质阳光自信..."
- "男性达人自信地拿起产品，眼神坚定看向镜头，手势有力..."
- "男性达人展示产品细节，表情专注专业..."
` : `### 达人性别要求
**性别不限**，可由AI根据产品特点自行选择最合适的达人性别。年龄约25-35岁，形象符合目标受众审美。
`}

### 达人出境要求
1. **开场段落**：达人出镜，手持或展示产品，用亲切自然的语气说出开场白
2. **产品展示段落**：达人展示产品细节、使用方法、效果对比
3. **互动感**：达人与镜头/观众有眼神交流，手势丰富自然
4. **专业形象**：达人穿着得体，符合产品调性和目标受众审美

### 图片提示词中必须包含
- 达人形象描述（年龄、${creatorGender === 'female' ? '女性' : creatorGender === 'male' ? '男性' : '性别'}、外貌特征、穿着风格）
- 达人姿态和动作（手持产品、展示细节、使用演示）
- 表情和眼神（自信、亲切、惊讶、满意等）
- 达人与产品的互动方式

### 视频提示词中必须包含
- 达人的动作变化（根据具体产品设计）
- 手势和表情的自然过渡
- 镜头运动与达人配合（推近达人手部特写、拉远展示全身等）

### 达人描述模板
- "一位年轻${creatorGender === 'female' ? '女性' : creatorGender === 'male' ? '男性' : ''}达人（25-30岁），穿着简约时尚..."
- "达人微笑着拿起产品，眼神看向镜头..."
- "达人轻轻转动产品，展示各个角度的细节..."
` : `## 产品展示模式（达人不出境）

**本视频以产品为主体，不展示达人形象。**

### 产品展示要求
1. **开场段落**：产品特写或使用场景，配合文字或旁白开场
2. **产品展示段落**：产品细节、使用效果、场景应用
3. **视觉效果**：强调光影、质感、构图的专业性
4. **动态展示**：产品旋转、开盖、使用过程等

### 图片提示词重点
- 产品主体清晰，占据画面主要位置
- 光影质感高级，适合电商展示
- 背景简洁或符合产品使用场景
- 必要时添加道具辅助展示

### 视频提示词重点
- 产品的动态效果（旋转、开盖、倒出等）
- 镜头运动（推拉摇移、特写到全景）
- 场景转换和光影变化
`}## 输出要求

生成 ${imageSegmentCount} 个图片段落，用于生成 ${videoSegmentCount} 个视频片段（从段落2开始）：

每个段落包含：
1. **order**: 段落序号（从1开始）
2. **duration**: 该段时长（秒）
3. **description**: 该段落的内容描述
4. **imagePrompt**: 图片生成提示词（详细描述画面内容、构图、光影、产品展示方式，专业电商摄影风格）
5. **videoPrompt**: 视频生成提示词（仅段落2及以后需要，描述从当前图片开始的动态效果、运镜、转场）
6. **hookType**: 该段落使用的钩子类型（仅第一个段落需要填写，从上述10种钩子中选择最合适的一种）
7. **sellingPoint**: 该段落突出的产品卖点

## 格式要求
- 必须以JSON数组格式输出
- 所有内容使用中文
- 段落1的videoPrompt必须为空字符串""
- 图片提示词要详细、具体，适合AI生图
- 视频提示词要与图片内容强相关，描述画面中的运动变化
- 第一个段落必须使用黄金3秒钩子开场，hookType要明确标注使用的钩子类型`;

    // 构建用户消息
    const userMessage = `请为以下产品创作一个${duration}秒的爆款带货短视频脚本模板：

## 产品信息
${productInfo}

## 产品类别
${categoryKeywords[productCategory as keyof typeof categoryKeywords] || '综合产品'}

## 目标受众
${targetAudience || '18-35岁年轻消费者'}

## 核心卖点
${sellingPoints || '品质优良、性价比高、使用方便'}

## 指定钩子类型
**必须使用：${selectedHook.name}**
- 描述：${selectedHook.description}
- 话术模板：${selectedHook.template}
- 参考示例：${selectedHook.examples.join(' / ')}

## 要求
1. 第一个段落（前3秒）必须使用【${selectedHook.name}】开场，严格按照上述话术模板设计开场白
2. 第一个段落的hookType字段必须填写"${selectedHook.name}"
3. 中间段落展示产品卖点和使用场景，每5-8秒切换信息点
4. 最后一个段落包含明确的行动号召和紧迫感
5. 生成 ${imageSegmentCount} 个图片段落
6. 段落1的videoPrompt必须为空字符串""
7. 段落2及以后的videoPrompt描述从该段图片开始的动态效果
8. 图片和视频提示词要高度相关，视频是图片的动态延续
${useCreator ? `9. **达人出境要求**：每个段落的图片提示词必须包含达人形象描述，达人需要展示产品、与观众互动
10. 达人形象要统一，年龄约25-35岁，穿着风格符合产品调性` : `9. **产品展示模式**：以产品为主体，不出现人物，重点展示产品质感和细节`}
11. 直接输出JSON数组，不要包含其他文字`;

    // 判断API类型
    const isGeminiApi = finalBaseUrl.includes('/v1beta') || finalBaseUrl.includes('generativelanguage.googleapis.com');
    
    let content = '';
    
    if (isGeminiApi) {
      // 调用 Gemini API
      const endpoint = `${finalBaseUrl}/models/${finalModel}:generateContent?key=${finalApiKey}`;
      
      const requestBody = {
        contents: [
          {
            role: 'user',
            parts: [{ text: systemPrompt + '\n\n' + userMessage }]
          }
        ],
        generationConfig: {
          temperature: 0.8,
          maxOutputTokens: 8192,
        }
      };

      console.log(`[Template] Calling Gemini API: ${finalModel}`);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        // @ts-expect-error - Node.js undici Agent
        dispatcher: longRunningAgent,
      });

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const text = await response.text();
        console.error('[Template] API returned non-JSON:', text.substring(0, 500));
        return NextResponse.json(
          { error: `API返回非JSON响应，请检查baseUrl是否正确: ${finalBaseUrl}` },
          { status: 500 }
        );
      }

      const data = await response.json();

      if (!response.ok) {
        console.error('[Template] API error:', JSON.stringify(data, null, 2));
        return NextResponse.json(
          { error: data.error?.message || '模板生成失败' },
          { status: response.status }
        );
      }

      // 提取文本内容
      content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } else {
      // 调用 OpenAI 兼容 API
      const endpoint = `${finalBaseUrl}/chat/completions`;
      
      const requestBody = {
        model: finalModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.8,
        max_tokens: 8192,
      };

      console.log(`[Template] Calling OpenAI-compatible API: ${finalModel}`);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${finalApiKey}`,
        },
        body: JSON.stringify(requestBody),
        // @ts-expect-error - Node.js undici Agent
        dispatcher: longRunningAgent,
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('[Template] API error:', JSON.stringify(data, null, 2));
        return NextResponse.json(
          { error: data.error?.message || '模板生成失败' },
          { status: response.status }
        );
      }

      content = data.choices?.[0]?.message?.content || '';
    }

    console.log('[Template] Raw response:', content.substring(0, 500));

    // 解析JSON
    let segments;
    try {
      // 清理可能的markdown代码块标记
      let cleanContent = content.trim();
      if (cleanContent.startsWith('```json')) {
        cleanContent = cleanContent.slice(7);
      } else if (cleanContent.startsWith('```')) {
        cleanContent = cleanContent.slice(3);
      }
      if (cleanContent.endsWith('```')) {
        cleanContent = cleanContent.slice(0, -3);
      }
      cleanContent = cleanContent.trim();
      
      segments = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error('[Template] JSON parse error:', parseError);
      // 尝试提取JSON数组
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        try {
          segments = JSON.parse(jsonMatch[0]);
        } catch {
          return NextResponse.json(
            { error: '解析模板失败，请重试', rawContent: content.substring(0, 1000) },
            { status: 500 }
          );
        }
      } else {
        return NextResponse.json(
          { error: '解析模板失败，请重试', rawContent: content.substring(0, 1000) },
          { status: 500 }
        );
      }
    }

    // 验证并规范化数据
    if (!Array.isArray(segments) || segments.length === 0) {
      return NextResponse.json(
        { error: '生成的模板格式不正确，请重试' },
        { status: 500 }
      );
    }

    // 规范化每个段落
    const normalizedSegments = segments.map((seg, index) => ({
      id: `seg-${Date.now()}-${index}`,
      order: seg.order || index + 1,
      duration: seg.duration || Math.ceil(duration / segments.length),
      description: seg.description || '',
      imagePrompt: seg.imagePrompt || '',
      videoPrompt: seg.videoPrompt || '',
      hookType: index === 0 ? selectedHook.name : (seg.hookType || undefined),
      sellingPoint: seg.sellingPoint || '',
    }));

    // 生成模板元数据
    const templateMeta = {
      name: templateName || `${productInfo.substring(0, 20)}...短视频模板`,
      description: `基于爆款方法论生成的${duration}秒${selectedHook.name}带货短视频模板`,
      category: productCategory || 'other',
      duration: duration,
      hookType: hookType || 'pain_point',
      targetAudience: targetAudience || '18-35岁年轻消费者',
      hookTypeName: normalizedSegments[0]?.hookType || selectedHook.name,
      segments: normalizedSegments,
      createdAt: Date.now(),
    };

    console.log(`[Template] Generated ${normalizedSegments.length} segments`);

    return NextResponse.json({
      success: true,
      template: templateMeta,
    });

  } catch (error) {
    console.error('[Template] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '模板生成失败' },
      { status: 500 }
    );
  }
}
