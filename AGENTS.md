# AGENTS.md

## 椤圭洰姒傝

鍩轰簬 Next.js 16 鐨?AI 鍥剧墖/瑙嗛鐢熸垚骞冲彴锛屽寘鍚煭鐗囩鐞嗭紙甯﹁揣锛夈€佽棰戝鍒汇€佸箍鍛婃ā鏉裤€丼aaS 棣栭〉绛夊姛鑳姐€傛敮鎸?AI 鑷姩鐢熸垚鍜屾墜鍔ㄨ緭鍏ヨ剼鏈袱绉嶆ā寮忋€傝棰戝鍒诲姛鑳藉凡鍚堝苟鍒扮煭鐗囧姛鑳戒腑锛屽叡鐢ㄧ紪杈戦〉闈紝浠呭叆鍙ｄ笉鍚屻€?
### 鎶€鏈爤

- **妗嗘灦**: Next.js 16 (App Router)
- **鏍稿績**: React 19
- **璇█**: TypeScript 5
- **UI 缁勪欢**: shadcn/ui (鍩轰簬 Radix UI)
- **鏍峰紡**: Tailwind CSS 4
- **鍥捐〃**: Recharts
- **鏁版嵁搴?*: PostgreSQL (Supabase)
- **瀛樺偍**: S3 鍏煎瀵硅薄瀛樺偍
- **HTTP 瀹㈡埛绔?*: undici (Node.js 鍘熺敓 fetch)

## 鏋勫缓鍜屾祴璇曞懡浠?
### 寮€鍙戠幆澧?```bash
pnpm dev  # 鍚姩寮€鍙戞湇鍔″櫒锛堢鍙?5000锛?```

### 鏋勫缓鍜岄儴缃?```bash
pnpm build   # 鏋勫缓鐢熶骇鐗堟湰
pnpm start   # 鍚姩鐢熶骇鐜
```

### 浠ｇ爜妫€鏌?```bash
pnpm lint      # ESLint 浠ｇ爜妫€鏌?pnpm ts-check  # TypeScript 绫诲瀷妫€鏌?```

## 椤圭洰缁撴瀯

```
.
鈹溾攢鈹€ src/
鈹?  鈹溾攢鈹€ app/                    # Next.js App Router
鈹?  鈹?  鈹溾攢鈹€ api/               # API 璺敱
鈹?  鈹?  鈹?  鈹溾攢鈹€ tasks/        # 浠诲姟鐩稿叧 API
鈹?  鈹?  鈹?  鈹溾攢鈹€ generate/     # 鍥剧墖鐢熸垚 API
鈹?  鈹?  鈹?  鈹溾攢鈹€ video/        # 瑙嗛鐢熸垚 API
鈹?  鈹?  鈹?  鈹溾攢鈹€ shortfilm/    # 鐭墖绠＄悊 API锛堝惈澶嶅埢鐩稿叧锛?鈹?  鈹?  鈹?  鈹?  鈹溾攢鈹€ projects/          # 椤圭洰 CRUD
鈹?  鈹?  鈹?  鈹?  鈹溾攢鈹€ remake-upload/     # 澶嶅埢瑙嗛涓婁紶
鈹?  鈹?  鈹?  鈹?  鈹溾攢鈹€ remake-link/       # 澶嶅埢閾炬帴瑙ｆ瀽
鈹?  鈹?  鈹?  鈹?  鈹溾攢鈹€ remake-parse/      # 澶嶅埢AI瑙ｆ瀽
鈹?  鈹?  鈹?  鈹?  鈹斺攢鈹€ remake-chunk-*/    # 鍒嗙墖涓婁紶
鈹?  鈹?  鈹?  鈹斺攢鈹€ ...
鈹?  鈹?  鈹溾攢鈹€ shortfilm/        # 鐭墖缂栬緫椤甸潰锛堝師鍒?澶嶅埢鍏辩敤锛?鈹?  鈹?  鈹溾攢鈹€ video-remake/     # 瑙嗛澶嶅埢鍏ュ彛椤甸潰锛堝垪琛?鏂板缓锛?鈹?  鈹?  鈹溾攢鈹€ queue/            # 浠诲姟闃熷垪椤甸潰
鈹?  鈹?  鈹斺攢鈹€ ...
鈹?  鈹溾攢鈹€ components/           # React 缁勪欢
鈹?  鈹?  鈹斺攢鈹€ ui/              # shadcn/ui 缁勪欢
鈹?  鈹溾攢鈹€ lib/                  # 宸ュ叿搴?鈹?  鈹?  鈹溾攢鈹€ fetch-agent.ts   # HTTP Agent 閰嶇疆
鈹?  鈹?  鈹溾攢鈹€ shortfilm.ts     # 鐭墖绠＄悊宸ュ叿锛堝惈澶嶅埢鏁版嵁妯″瀷锛?鈹?  鈹?  鈹溾攢鈹€ prompt-variables.ts # 鎻愮ず璇嶆ā鏉匡紙鍚鍒绘彁绀鸿瘝锛?鈹?  鈹?  鈹斺攢鈹€ ...
鈹?  鈹斺攢鈹€ storage/              # 鏁版嵁搴撶浉鍏?鈹?      鈹斺攢鈹€ database/        # 鏁版嵁搴?schema 鍜屽伐鍏?鈹溾攢鈹€ supabase/migrations/      # 鏁版嵁搴撹縼绉绘枃浠?鈹斺攢鈹€ public/                   # 闈欐€佽祫婧?```

## 浠ｇ爜椋庢牸鎸囧崡

### TypeScript
- 浣跨敤 TypeScript 5 涓ユ牸妯″紡
- 鎵€鏈夊嚱鏁板弬鏁板繀椤绘爣娉ㄧ被鍨?- 鎵€鏈夌粍浠?鍑芥暟浣跨敤鍓嶅繀椤?import
- 閬垮厤浣跨敤闅愬紡 any

### React/Next.js
- 浣跨敤 React 19 鏂扮壒鎬?- 缁勪欢浣跨敤 `use client` 鎸囦护鏃堕厤鍚?useEffect + useState 纭繚瀹㈡埛绔覆鏌?- 閬垮厤闈炴硶 HTML 宓屽锛堝 `<p>` 宓屽 `<div>`锛?- 浣跨敤 shadcn/ui 缁勪欢椋庢牸

### 鏍峰紡
- 浣跨敤 Tailwind CSS 4
- 浼樺厛浣跨敤 Tailwind 绫诲悕鑰岄潪鍐呰仈鏍峰紡
- 淇濇寔鏍峰紡涓€鑷存€?
### API 鍝嶅簲鏍煎紡
鎵€鏈?API 蹇呴』浣跨敤缁熶竴鐨勫搷搴旀牸寮忥細
```typescript
// 鎴愬姛鍝嶅簲
return NextResponse.json({
  success: true,
  data: { ... }
});

// 閿欒鍝嶅簲
return NextResponse.json({
  success: false,
  error: '閿欒淇℃伅'
}, { status: 400 });
```

### 閿欒澶勭悊妯″紡
浣跨敤缁熶竴鐨勯敊璇鐞嗗伐鍏峰嚱鏁帮細
```typescript
import { logApiError, errorResponse } from '@/lib/logger';

// 鍦?try/catch 涓娇鐢?try {
  // 涓氬姟閫昏緫
} catch (error) {
  return errorResponse('API鍚嶇О', '鎿嶄綔鍚嶇О', error, userId);
}
```

## 娴嬭瘯璇存槑

### 浠ｇ爜闈欐€佹鏌ワ紙蹇呭仛锛?```bash
pnpm lint
pnpm ts-check
```

### API 鎺ュ彛娴嬭瘯
浣跨敤 `test_run` 宸ュ叿鎵ц鎺ュ彛鍐掔儫娴嬭瘯锛?```bash
# 娴嬭瘯浠诲姟鍒涘缓
curl -s -X POST -H 'Content-Type: application/json' -d '{...}' http://localhost:5000/api/tasks

# 娴嬭瘯鍥剧墖鐢熸垚
curl -s -X POST -H 'Content-Type: application/json' -d '{...}' http://localhost:5000/api/generate

# 娴嬭瘯瑙嗛鐢熸垚
curl -s -X POST -H 'Content-Type: application/json' -d '{...}' http://localhost:5000/api/video
```

### 鏈嶅姟瀛樻椿鎺㈡祴
```bash
curl -I http://localhost:5000
```

### 鏃ュ織妫€鏌?```bash
# 妫€鏌ユ渶鏂伴敊璇?tail -n 50 /app/work/logs/bypass/app.log | grep -iE "error|exception|warn"

# 妫€鏌ユ渶鏂版棩蹇?tail -n 50 /app/work/logs/bypass/app.log
```

## 瀹夊叏娉ㄦ剰浜嬮」

### 鏁忔劅淇℃伅澶勭悊
- API Key 鑴辨晱瀛樺偍锛氬墠绔樉绀?`sk-****xxxx`锛屽悗绔娇鐢ㄧ湡瀹?Key
- 浠诲姟鍒涘缓鏃朵笉瀛樺偍 apiKey
- 鏌ヨ鏃舵牴鎹敤鎴疯鑹茶繃婊ゆ晱鎰熷瓧娈?- 浣跨敤鍐呴儴璁よ瘉 header 浼犻€掔敤鎴蜂俊鎭?
### 鐜鍙橀噺
- 鎵€鏈夐厤缃€氳繃鐜鍙橀噺鑾峰彇锛岀姝㈢‖缂栫爜
- JWT_SECRET 蹇呴』璁剧疆寮哄瘑閽?- 鏁版嵁搴撹繛鎺ュ瓧绗︿覆浣跨敤鐜鍙橀噺

### 缃戠粶璇锋眰
- 浣跨敤 undici Agent 閰嶇疆瓒呮椂
- 闀挎椂闂磋繍琛岀殑璇锋眰浣跨敤 `longRunningAgent`
- 姝ｇ‘澶勭悊杩炴帴瓒呮椂鍜岃姹傝秴鏃?
## 甯歌闂

### 鍥剧墖鐢熸垚澶辫触锛堣繛鎺ヨ秴鏃讹級
**闂**: `ConnectTimeoutError: Connect Timeout Error (attempted address: grsaiapi.com:443, timeout: 10000ms)`

**瑙ｅ喅鏂规**: 鍦?`src/lib/fetch-agent.ts` 涓坊鍔?`connectTimeout` 閰嶇疆锛?```typescript
export const longRunningAgent = new Agent({
  connectTimeout: 10 * 60 * 1000,    // 10 鍒嗛挓杩炴帴瓒呮椂
  headersTimeout: 10 * 60 * 1000,    // 10 鍒嗛挓
  bodyTimeout: 10 * 60 * 1000,       // 10 鍒嗛挓
  keepAliveTimeout: 60 * 1000,
  keepAliveMaxTimeout: 10 * 60 * 1000,
});
```

### 鑴氭湰鐢熸垚涓€鐩存樉绀?鐢熸垚涓?
**闂**: SSE 浜嬩欢鍦ㄥ紑鍙戞ā寮忎笅鍙兘鏃犳硶姝ｇ‘浼犻€掑埌鍓嶇

**瑙ｅ喅鏂规**: 娣诲姞鑴氭湰浠诲姟杞鏈哄埗浣滀负 SSE 澶囩敤鏂规

### 浠诲姟鎵ц鏃?API Key 涓虹┖
**闂**: 鍓嶇鎻愮ず"璇峰厛鍦ㄧ郴缁熻缃腑閰嶇疆 API Key"

**瑙ｅ喅鏂规**:
1. 妫€鏌?`/api/system-config` API 鏄惁姝ｇ‘浠?`config.defaults` 璇诲彇榛樿 ID
2. 妫€鏌ュ墠绔鏌ラ€昏緫鏄惁浣跨敤 `apiKeyMasked` 浣滀负澶囬€夊垽鏂?
### middleware 寮冪敤璀﹀憡
**闂**: Next.js 16 鎻愮ず "The 'middleware' file convention is deprecated"

**瑙ｅ喅鏂规**: 灏?`src/middleware.ts` 閲嶅懡鍚嶄负 `src/proxy.ts`锛屽苟灏嗗鍑哄嚱鏁板悕浠?`middleware` 鏀逛负 `proxy`

### /@vite/client 404 閿欒
**闂**: 寮€鍙戝伐鍏疯姹?`/@vite/client` 杩斿洖 404

**瑙ｅ喅鏂规**: 鍒涘缓 `src/proxy.ts` 鎷︽埅璇锋眰锛?```typescript
export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === '/@vite/client') {
    return new NextResponse(null, { status: 204 });
  }
  return NextResponse.next();
}
```

## 鏁版嵁搴撹縼绉?
鍒涘缓鏂拌縼绉绘枃浠讹細
```bash
# 鏍煎紡: migrations/{搴忓彿}_{鎻忚堪}.sql
# 绀轰緥: migrations/005_add_script_generation_mode.sql
```

鎵ц杩佺Щ锛?```sql
-- 杩佺Щ鏂囦欢鍐呭
ALTER TABLE shortfilm_projects ADD COLUMN script_generation_mode TEXT DEFAULT 'ai';
```

## 闆嗘垚鏈嶅姟浣跨敤

### S3 瀵硅薄瀛樺偍
浣跨敤 `src/lib/s3-client.ts` 涓殑 `s3Storage` 瀹炰緥锛?```typescript
import { s3Storage } from '@/lib/s3-client';

// 涓婁紶鏂囦欢
const key = await s3Storage.uploadFile({
  fileContent: buffer,
  fileName: 'path/to/file.jpg',
  contentType: 'image/jpeg',
});

// 鐢熸垚绛惧悕 URL
const url = await s3Storage.generatePresignedUrl({
  key,
  expireTime: URL_EXPIRE_TIME,
});
```

### Supabase 鏁版嵁搴?浣跨敤 `src/lib/database.ts` 涓殑 `getSupabaseClient`锛?```typescript
import { getSupabaseClient } from '@/lib/database';

const supabase = getSupabaseClient();
const { data, error } = await supabase
  .from('table_name')
  .select('*')
  .eq('id', id);
```

## 鏃ュ織璁板綍

### 鏃ュ織鐩綍
- `/app/work/logs/bypass/app.log` - 涓绘祦绋嬫棩蹇?- `/app/work/logs/bypass/dev.log` - 璋冭瘯鏃ュ織
- `/app/work/logs/bypass/console.log` - 娴忚鍣ㄦ帶鍒跺彴鏃ュ織

### 鏃ュ織璁板綍鏂瑰紡
```typescript
import { logTaskError } from '@/lib/task-logging';

// 璁板綍浠诲姟閿欒
logTaskError(taskId, '鎿嶄綔鍚嶇О', error, {
  userId: task.user_id,
  type: task.type,
  // 鍏朵粬涓婁笅鏂囦俊鎭?}, task.user_id);
```

### 鏃ュ織鍒嗙被
椤圭洰浣跨敤缁熶竴鐨勬棩蹇楃郴缁燂紝鏀寔鍒嗙被璁板綍锛?```typescript
import { logError, logInfo, logWarn, logApiError, logTaskError, logAuthError, logStorageError } from '@/lib/logger';

// 閫氱敤閿欒
logError('api', '鎿嶄綔鎻忚堪', error, { detail: '棰濆淇℃伅' }, userId);

// 渚挎嵎鏂规硶
logApiError('API鍚嶇О', '鎿嶄綔', error, { detail: '棰濆淇℃伅' }, userId);
logTaskError('taskId', '鎿嶄綔', error, { detail: '棰濆淇℃伅' }, userId);
logAuthError('鎿嶄綔', error, { detail: '棰濆淇℃伅' }, userId);
logStorageError('鎿嶄綔', error, { detail: '棰濆淇℃伅' }, userId);
```

### 閿欒鍒嗙被
- **妯″瀷閿欒** (isModelError): API 闄愭祦銆佸弬鏁伴敊璇€佹ā鍨嬩笉鍙敤绛?鈫?璁板綍涓?INFO
- **绯荤粺閿欒**: 浠ｇ爜寮傚父銆佹暟鎹簱閿欒绛?鈫?璁板綍涓?ERROR

## 瑙嗛澶嶅埢鍔熻兘

### 鍔熻兘姒傝堪
鐖嗘鐭棰?AI 澶嶅埢鍔熻兘锛屾敮鎸佽緭鍏ョ煭瑙嗛閾炬帴鎴栦笂浼犺棰戯紝AI 鑷姩瑙ｆ瀽瑙嗛鐜銆佽剼鏈€侀暅澶磋瑷€銆佸彛鎾枃鏈紝鐢熸垚楂樿繕鍘熷害瑙嗛绱犳潗銆?
**V3鏋舵瀯**锛氳棰戝鍒诲凡鍚堝苟鍒扮煭鐗囧姛鑳戒腑锛屽叡鐢ㄧ紪杈戦〉闈紙`/shortfilm/new`锛夛紝姝ラ2-5瀹屽叏澶嶇敤鐭墖娴佺▼銆備粎姝ラ1鏍规嵁鍏ュ彛涓嶅悓鏄剧ず涓嶅悓UI銆?
### 鍏ュ彛涓庢祦绋?- **鍘熷垱鍏ュ彛**锛歚/shortfilm/new` 鈫?姝ラ1閫夋嫨浜у搧+鐢熸垚鑴氭湰
- **澶嶅埢鍏ュ彛**锛歚/video-remake/new` 鈫?鍒涘缓椤圭洰 鈫?璺宠浆 `/shortfilm/new?id={id}` 鈫?姝ラ1涓婁紶/瑙ｆ瀽瑙嗛
- **澶嶅埢鍒楄〃**锛歚/video-remake` 鈫?鏌ヨ `sourceType='remake'` 鐨勭煭鐗囬」鐩?
### 鏁版嵁妯″瀷
澶嶅埢椤圭洰浣跨敤 `shortfilm_projects` 琛紝閫氳繃 `source_type` 瀛楁鍖哄垎锛?- `source_type='original'`锛氬師鍒涚煭鐗囷紙榛樿锛?- `source_type='remake'`锛氳棰戝鍒?
澶嶅埢涓撶敤瀛楁锛?- `source_video_key`锛氬師濮嬭棰?S3 key
- `source_video_url`锛氬師濮嬭棰戦绛惧悕URL锛?澶╂湁鏁堟湡锛?- `video_duration`锛氳棰戞椂闀匡紙绉掞級

### 鏁版嵁搴撹〃
- `shortfilm_projects` - 鐭墖椤圭洰琛紙鍘熷垱+澶嶅埢鍏辩敤锛?- `video_remake_projects` - 鍘嗗彶澶嶅埢椤圭洰琛紙宸插純鐢紝淇濈暀鍘嗗彶鏁版嵁锛?- `video_remake_scenes` - 鍘嗗彶鍒嗛暅琛紙宸插純鐢紝淇濈暀鍘嗗彶鏁版嵁锛?
### API 鎺ュ彛
澶嶅埢鐩稿叧 API 鍦ㄧ煭鐗囧懡鍚嶇┖闂翠笅锛?- `POST /api/shortfilm/remake-upload` - 涓婁紶瑙嗛锛堝皬鏂囦欢锛?- `POST /api/shortfilm/remake-link` - 閾炬帴瑙ｆ瀽锛坹t-dlp锛屾敮鎸?TikTok/YouTube/鎶栭煶/B绔欑瓑锛?- `POST /api/shortfilm/remake-parse/[id]` - AI娣卞害瑙ｆ瀽锛圙emini澶氭ā鎬佹ā鍨嬶級
- `POST /api/shortfilm/remake-chunk-init` - 鍒嗙墖涓婁紶鍒濆鍖?- `POST /api/shortfilm/remake-chunk-upload` - 鍒嗙墖涓婁紶
- `POST /api/shortfilm/remake-chunk-complete` - 鍒嗙墖涓婁紶瀹屾垚

鍏辩敤鐭墖 API锛?- `GET/POST /api/shortfilm/projects` - 椤圭洰鍒楄〃/鍒涘缓锛堟敮鎸?`sourceType=remake` 杩囨护锛?- `GET/PUT/DELETE /api/shortfilm/projects/[id]` - 鍗曚釜椤圭洰绠＄悊
- `POST /api/shortfilm/generate-image` - 鍥剧墖鐢熸垚
- `POST /api/shortfilm/generate-script` - 鑴氭湰鐢熸垚

### 鎻愮ず璇嶆ā鏉?澶嶅埢瑙ｆ瀽鎻愮ず璇嶄粠鏁版嵁搴?`system_prompt_config` 琛ㄨ鍙栵紙id=`video_remake`锛夛紝鏀寔绠＄悊鍛樺悗鍙伴厤缃€傚鏃犺嚜瀹氫箟閰嶇疆锛屼娇鐢?`prompt-variables.ts` 涓殑榛樿妯℃澘銆?
### 娉ㄦ剰浜嬮」
- `sourceVideoUrl` 鏄绛惧悕URL锛?澶╁悗杩囨湡锛屽姞杞介」鐩椂闇€鍒锋柊
- 瑙ｆ瀽缁撴灉鏄犲皠涓?`ScriptSegment[]` 鏍煎紡锛屽寘鍚?`imagePrompt`, `videoPrompt`, `speechText`, `audioPrompt` 绛夊瓧娈?- 瑙嗛鐢熸垚浣跨敤 Veo 3.1 鏀跺熬甯ф妧鏈紝姣忔8绉?
## 绉垎绯荤粺

### 鎵ｉ櫎绉垎
```typescript
import { consumeCredits } from '@/lib/credits';

const result = await consumeCredits(userId, 'image_generate', taskId, 'image');
if (!result.success) {
  console.error('鎵ｉ櫎绉垎澶辫触:', result.error);
}
```

### 妫€鏌ョН鍒?```typescript
import { checkUserCredits } from '@/lib/credits';

const check = await checkUserCredits(userId, 5);
if (!check.hasEnough) {
  return NextResponse.json(
    { error: `绉垎涓嶈冻锛屽綋鍓嶇Н鍒?${check.balance}锛岄渶瑕?${check.required} 绉垎` },
    { status: 402 }
  );
}
```

## 瀛樺偍閰嶉

### 妫€鏌ュ瓨鍌ㄩ厤棰?```typescript
import { checkStorageQuota } from '@/lib/storage-quota';

const storageCheck = await checkStorageQuota(userId);
if (!storageCheck.allowed) {
  return NextResponse.json(
    { error: storageCheck.error },
    { status: 507 }
  );
}
```

## 浠诲姟闃熷垪

### 鍒涘缓浠诲姟
```typescript
import { createImageTask } from '@/lib/tasks';

const taskId = await createImageTask(supabase, {
  user_id: userId,
  params: {
    prompt: '鎻愮ず璇?,
    aspectRatio: '9:16',
    resolution: '2K',
    baseUrl: 'https://api.example.com',
    model: 'nano-banana-2',
  },
  project_id: projectId,
});
```

### 澶勭悊浠诲姟
浠诲姟浼氳嚜鍔ㄧ敱 `/api/tasks/process` 澶勭悊锛屾棤闇€鎵嬪姩璋冪敤銆?
### 浠诲姟鐘舵€佹満
```
pending 鈫?running 鈫?completed
                   鈫?                failed 鈫?retrying 鈫?running
```

### 浠诲姟鐗规€?- **蹇冭烦鏈哄埗**: 30绉掓洿鏂颁竴娆★紝闃叉浠诲姟涓㈠け
- **涔愯閿?*: 闃叉骞跺彂澶勭悊鍚屼竴浠诲姟
- **閲嶈瘯鏈哄埗**: 澶辫触浠诲姟鑷姩閲嶈瘯
- **SSE鎺ㄩ€?*: 瀹炴椂鎺ㄩ€佷换鍔¤繘搴?
## 寮€鍙戣鑼?
### 绔彛浣跨敤
- Web 鏈嶅姟蹇呴』杩愯鍦?**5000** 绔彛
- 绂佹浣跨敤 9000 绔彛锛堢郴缁熶繚鐣欙級

### 鍖呯鐞嗗櫒
- 浠呭厑璁镐娇鐢?**pnpm**
- 绂佹浣跨敤 npm 鎴?yarn

### 鐜鍙橀噺
- 浣跨敤 `process.env.DEPLOY_RUN_PORT` 鑾峰彇鏈嶅姟绔彛
- 浣跨敤 `process.env.COZE_PROJECT_DOMAIN_DEFAULT` 鑾峰彇瀵瑰鍩熷悕
- 绂佹纭紪鐮佸煙鍚嶆垨绔彛

### 鏂囦欢瀛樺偍
- 鐢熸垚鏂囦欢浼樺厛瀛樺偍鍒板璞″瓨鍌?- 涓存椂鏂囦欢浣跨敤 `/tmp` 鐩綍锛堢敓浜х幆澧冿級

## 璋冭瘯娴佺▼

### 1. 鏌ョ湅閿欒鏃ュ織
```bash
tail -n 50 /app/work/logs/bypass/app.log
```

### 2. 瀹氫綅閿欒
- 鍓嶇闂锛氫紭鍏堟煡鐪?console.log
- 鍚庣闂锛氫紭鍏堟煡鐪?app.log
- API 闂锛氭鏌?dev.log

### 3. 淇浠ｇ爜
- 鏍规嵁閿欒淇℃伅瀹氫綅闂
- 淇鍚庨噸鍚湇鍔℃垨渚濊禆鐑洿鏂?
### 4. 楠岃瘉淇
- 鎵ц浠ｇ爜闈欐€佹鏌?- 娴嬭瘯鐩稿叧鍔熻兘
- 妫€鏌ユ棩蹇楃‘璁ゆ棤鏂伴敊璇?
## 鐭ヨ瘑娌夋穩

### 鏍稿績妯″潡璇存槑

| 妯″潡 | 璺緞 | 璇存槑 |
|------|------|------|
| 鐢ㄦ埛璁よ瘉 | `src/lib/auth.ts` | JWT 绛惧彂/楠岃瘉銆佸瘑鐮佸搱甯?|
| 璁よ瘉涓棿浠?| `src/lib/auth-middleware.ts` | API 閴存潈銆佹潈闄愭鏌?|
| 绉垎绯荤粺 | `src/lib/credits.ts` | 绉垎鎵ｅ噺銆佸厖鍊笺€佹煡璇?|
| 浠诲姟澶勭悊 | `src/app/api/tasks/process/route.ts` | 鏍稿績寮傛浠诲姟澶勭悊鍣?|
| SSE 鎺ㄩ€?| `src/lib/task-events.ts` | 瀹炴椂浠诲姟杩涘害鎺ㄩ€?|
| 鏂囦欢瀛樺偍 | `src/lib/s3-client.ts` | S3 鍗曚緥瀹㈡埛绔?|
| AI 閰嶇疆 | `src/lib/server-config.ts` | AI API 閰嶇疆绠＄悊 |
| 鏃ュ織绯荤粺 | `src/lib/logger.ts` | 缁熶竴鏃ュ織璁板綍 |
| 鐭墖鏁版嵁妯″瀷 | `src/lib/shortfilm.ts` | ShortFilmProject + ScriptSegment 鎺ュ彛瀹氫箟 |
| 澶嶅埢瑙ｆ瀽 | `src/app/api/shortfilm/remake-parse/[id]/route.ts` | Gemini澶氭ā鎬佽棰戣В鏋?|
| 瑙嗛涓嬭浇閫傞厤 | `src/lib/video-downloader.ts` | ssstik 浼樺厛銆亂t-dlp 闄嶇骇鐨勮棰戜笅杞藉眰 |
| 鍒嗘瀽澶у笀 | `src/lib/analysis-master.ts` | 瑙嗛鍒嗛暅鎷嗚В缁撴灉鏍囧噯鍖栦笌 Gemini 鍒嗘瀽 |
| 鎻愮ず璇嶆ā鏉?| `src/lib/prompt-variables.ts` | AI鎻愮ず璇嶆ā鏉匡紙鍚鍒绘彁绀鸿瘝锛?|

### 甯哥敤宸ュ叿鍑芥暟绱㈠紩

| 鍦烘櫙 | 鍑芥暟 | 鏂囦欢 |
|------|------|------|
| 閴存潈 | `authenticateRequest()` | `auth-middleware.ts` |
| 绉垎鎵ｅ噺 | `consumeCredits()` | `credits.ts` |
| 绉垎妫€鏌?| `checkUserCredits()` | `credits.ts` |
| HTTP 璇锋眰 | `fetchWithTimeout()` | `fetch-agent.ts` |
| 鏂囦欢涓婁紶 | `s3Storage.uploadFile()` | `s3-client.ts` |
| 棰勭鍚峌RL | `s3Storage.generatePresignedUrl()` | `s3-client.ts` |
| SSE 鎺ㄩ€?| `broadcastTaskUpdate()` | `task-events.ts` |
| 閿欒璁板綍 | `logTaskError()` | `logger.ts` |
| 瑙嗛涓嬭浇 | `downloadVideoFromUrl()` | `video-downloader.ts` |

### AI API 閰嶇疆缁撴瀯
```typescript
interface ApiConfig {
  baseUrl: string;      // API 鍩虹鍦板潃
  apiKey: string;       // API Key
  model?: string;       // 妯″瀷鍚嶇О
}

// 鑾峰彇閰嶇疆
import { getServerDefaultImageApi, getServerDefaultVideoApi } from '@/lib/server-config';

const imageApi = await getServerDefaultImageApi();
const videoApi = await getServerDefaultVideoApi();
```

### 鏁版嵁搴撹〃鍏崇郴
```
users (鐢ㄦ埛)
  鈹溾攢鈹€ user_credits (绉垎)
  鈹溾攢鈹€ user_settings (璁剧疆)
  鈹溾攢鈹€ task_queue (浠诲姟)
  鈹溾攢鈹€ shortfilm_projects (鐭墖椤圭洰锛屽惈澶嶅埢椤圭洰 source_type='remake')
  鈹?  鈹斺攢鈹€ script_segments (JSONB: 鑴氭湰鍒嗘)
  鈹溾攢鈹€ analysis_master_projects (鍒嗘瀽澶у笀椤圭洰)
  鈹溾攢鈹€ video_remake_projects (鍘嗗彶澶嶅埢椤圭洰锛屽凡寮冪敤)
  鈹斺攢鈹€ usage_records (绉垎浣跨敤璁板綍)
```

### 瑙嗛涓嬭浇涓庡垎鏋愬ぇ甯?
- 鐭墖澶嶅埢閾炬帴瀵煎叆閫氳繃 `src/lib/video-downloader.ts` 涓嬭浇瑙嗛锛岄粯璁?`VIDEO_DOWNLOAD_PROVIDER=auto`銆?- `auto` 绛栫暐浼氬 TikTok/鎶栭煶绫婚摼鎺ヤ紭鍏堝皾璇?ssstik锛屽啀闄嶇骇鍒?`yt-dlp`锛涢潪 TikTok 骞冲彴浠嶄緷璧?`yt-dlp`銆?- ssstik 鏄綉椤靛瀷闈炲畼鏂逛笅杞芥柟妗堬紝鎵归噺涓嬭浇瀛樺湪鍙嶇埇銆侀檺娴併€侀〉闈㈢粨鏋勫彉鍖栥€佺涓夋柟鏃ュ織璁板綍鍜屾湇鍔′笉鍙敤椋庨櫓锛涚敓浜х幆澧冨繀椤婚檺鍒跺苟鍙戝苟淇濈暀闄嶇骇鏂规銆?- 鍒嗘瀽澶у笀椤甸潰涓?`/analysis-master`锛孉PI 涓?`/api/analysis-master/projects` 鍜?`/api/analysis-master/analyze/[id]`銆?- 鍒嗘瀽澶у笀椤圭洰瀛樺偍鍦?`analysis_master_projects` 琛紝杩佺Щ鏂囦欢涓?`supabase/migrations/012_analysis_master.sql`銆?- 鍒嗘瀽澶у笀鍒嗘瀽鎵ц閫氳繃 `task_queue.type='analysis'` 鍚庡彴澶勭悊锛宍/api/analysis-master/analyze/[id]` 鍙礋璐ｆ姠閿佸拰鍏ラ槦锛屽墠绔疆璇㈤」鐩姸鎬併€?- 鍒嗘瀽澶у笀浼氳皟鐢ㄦ枃鏈ā鍨嬬殑 Gemini 澶氭ā鎬佽兘鍔涳紝娑夊強涓婁紶銆丄I 璋冪敤銆佺Н鍒嗘墸鍑忓拰瀵硅薄瀛樺偍锛涗慨鏀规椂蹇呴』妫€鏌ラ敊璇鐞嗐€佽秴鏃躲€佺敤鎴锋暟鎹殧绂汇€佹墸璐瑰箓绛夋€у拰浠诲姟閲嶈瘯鐘舵€併€?
## 鑱旂郴鍜屾敮鎸?
濡傛湁闂锛岃妫€鏌ワ細
1. 鏈?AGENTS.md 鏂囨。
2. 浠ｇ爜娉ㄩ噴
3. 鏃ュ織鏂囦欢
4. 椤圭洰 README.md

## 2026-05-19 鍒嗘瀽澶у笀闆嗘垚璇存槑

- `/analysis-master` 浣跨敤鐜版湁 SaaS 鐨?`AppLayout`銆乻hadcn/ui銆乀ailwind 鍗＄墖/鎸夐挳浣撶郴锛屾柊澧為〉闈㈡敼鍔ㄩ渶缁х画淇濇寔绉诲姩绔€傞厤銆?- 鍒嗘瀽澶у笀椤圭洰鏁版嵁瀛樺偍鍦?`analysis_master_projects`锛岃縼绉绘枃浠朵负 `supabase/migrations/012_analysis_master.sql`銆?- 鍒嗘瀽浠诲姟缁熶竴杩涘叆 `task_queue`锛屼换鍔＄被鍨嬩负 `analysis`锛岀敱 `/api/tasks/process` 鍚庡彴澶勭悊锛涗笟鍔℃帴鍙?`/api/analysis-master/analyze/[id]` 鍙礋璐ｉ壌鏉冦€佺Н鍒嗛妫€鏌ャ€侀」鐩姠閿佸拰鍏ラ槦銆?- 鍒嗘瀽澶у笀 AI 璋冪敤璧?`getServerDefaultTextApi()`锛屽鐢ㄧ郴缁熷悗鍙扳€滄枃鏈ā鍨嬧€濋厤缃紱涓嶈鍦ㄥ姛鑳戒唬鐮佷腑纭紪鐮佹ā鍨嬨€丄PI Key 鎴?Base URL銆?- 鍒嗘瀽澶у笀鎻愮ず璇嶈蛋 `system_prompt_config.id='analysis_master'`锛岀鐞嗗憳鍙湪鎻愮ず璇嶈缃〉閰嶇疆锛涢粯璁ゆā鏉垮拰鍙橀噺瀹氫箟缁存姢鍦?`src/lib/prompt-variables.ts`銆?- 鍒嗘瀽澶у笀娑夊強涓婁紶銆佸璞″瓨鍌ㄣ€佹暟鎹簱銆佷换鍔￠槦鍒椼€佺Н鍒嗘墸鍑忓拰 Gemini 澶氭ā鎬佽皟鐢紱淇敼鏃跺繀椤婚獙璇侀敊璇鐞嗐€佺敤鎴锋暟鎹殧绂汇€佸瓨鍌ㄩ厤棰濄€佷换鍔″け璐ョ姸鎬佸拰绉垎骞傜瓑椋庨櫓銆?- 鍒嗘瀽澶у笀涓婁紶/閾炬帴瀵煎叆蹇呴』鍦?S3 涓婁紶鎴愬姛浣嗘暟鎹簱鍐欏叆澶辫触鏃舵竻鐞嗗凡涓婁紶瀵硅薄锛岄伩鍏嶅璞″瓨鍌ㄦ硠婕忋€?- 鍒嗘瀽澶у笀绉垎棰勬鏌ュ繀椤昏鍙?`system_credit_prices.action_type='video_analysis_master'`锛屼笉寰楃‖缂栫爜绉垎浠锋牸銆?- 瑙嗛涓嬭浇 URL 鏍￠獙蹇呴』鍚屾椂妫€鏌ュ崗璁€乴ocalhost/鍏冩暟鎹煙鍚嶃€両P 瀛楅潰閲忓拰 DNS 瑙ｆ瀽鍚庣殑绉佺綉/淇濈暀鍦板潃锛沗ssstik` 涓?`yt-dlp` 闄嶇骇璺緞閮藉繀椤昏蛋鍚屼竴鏍￠獙銆?
## 2026-05-19 鎺ュ彛瀹夊叏琛ュ厖

- `/api/tasks/process` 鏄换鍔℃墽琛屽叆鍙ｏ紝蹇呴』瑕佹眰鏈夋晥 `Authorization: Bearer <token>`锛屼笉寰椾粎鍑?`x-internal-auth` 瑙﹀彂锛涢潪绠＄悊鍛樺彧鑳藉鐞?鏌ョ湅鑷繁鐨勪换鍔★紝绠＄悊鍛樻墠鍙鐞嗗叏灞€闃熷垪銆?- 鍒嗘瀽澶у笀涓婁紶銆侀摼鎺ュ鍏ュ拰鍚庡彴鍒嗘瀽鎵ц缁熶竴闄愬埗瑙嗛澶у皬涓?100MB锛涗慨鏀瑰ぇ灏忛檺鍒舵椂蹇呴』鍚屾鏇存柊椤圭洰鍒涘缓鎺ュ彛銆佷换鍔℃墽琛屾帴鍙ｅ拰鍓嶇鎻愮ず銆?- 鍒嗘瀽澶у笀鎺ュ彛涓嶅緱鍚戝墠绔繑鍥炴暟鎹簱銆丼3 鎴?AI SDK 鐨勫師濮嬮敊璇俊鎭紱璇︾粏閿欒鍙啓鍏ユ湇鍔＄鏃ュ織锛屽墠绔繑鍥炵ǔ瀹氱殑涓氬姟閿欒鏂囨銆?

## 2026-05-19 Seedance 绉垎鎵ｈ垂瑙勫垯

- Seedance 瑙嗛浠诲姟鍒涘缓鎺ュ彛鍙仛浣欓棰勬鏌ュ拰鍏ラ槦锛屼笉鍦ㄥ叆闃熷悗寮傛鎵ｈ垂銆?- Seedance 瑙嗛浠诲姟鎴愬姛鍚庯紝鐢?`src/app/api/tasks/process/route.ts` 璇诲彇浠诲姟鍙傛暟涓殑 `action_type` 涓?`credits_required`锛岃皟鐢?`consumeFixedCredits()` 鎸夊疄闄呬换鍔￠噾棰濇墸涓€娆°€?- 闈?Seedance 瑙嗛浠诲姟缁х画浣跨敤 `consumeCredits(userId, 'video_generate', taskId, 'video')` 鎸夌郴缁熺Н鍒嗕环鏍兼墸璐广€?- 鎵€鏈夋墸璐瑰繀椤讳互 `task.id` 浣滀负 `resource_id` 鍐欏叆 `usage_records`锛屼緷璧栧敮涓€浠诲姟璧勬簮璁板綍閬垮厤閲嶅鎵ｈ垂銆?

## 2026-05-19 Seedance 鍚庡彴鍗曚环閰嶇疆

- Seedance 姣忕鍗曚环蹇呴』浠?`system_credit_prices` 璇诲彇锛屼笉鍏佽鍦ㄤ笟鍔′唬鐮佷腑纭紪鐮佷环鏍艰〃銆?- 榛樿浠锋牸鐢?`supabase/migrations/013_seedance_credit_prices.sql` 鍒濆鍖栵紝鍚庡彴绉垎璁剧疆椤甸€氳繃 `video_seedance2_*` action type 缁存姢姣忕绉垎銆?- Seedance 鍒涘缓浠诲姟鏃朵娇鐢ㄥ悗鍙板崟浠蜂箻浠ヨ棰戞椂闀垮緱鍒?`credits_required`锛屼换鍔℃垚鍔熷悗缁х画鎸夎鍥哄畾閲戦鎵ｈ垂銆?

## 2026-05-19 鍒嗘瀽澶у笀绉垎鎵ｈ垂瑙勫垯



## 2026-05-19 分析大师后台积分配置规则

- 分析大师默认每条 50 积分，但业务接口不得写死为固定价格，必须从 `system_credit_prices.action_type='video_analysis_master'` 读取。
- `/api/analysis-master/analyze/[id]` 创建任务时读取后台价格做余额预检，并将当时价格写入任务参数 `creditsRequired`。
- `task_queue.type='analysis'` 执行时优先按任务参数中的 `creditsRequired` 调用 `consumeFixedCredits()` 扣费，保证管理员后续改价不影响已入队任务。
- 如果历史任务缺少 `creditsRequired`，执行时才回退到 `consumeCredits()` 读取当前后台价格。
- 默认 50 积分由 `supabase/migrations/014_analysis_master_credit_price.sql` 初始化/修正，管理员可在后台积分配置页继续调整。
- 分析大师任务失败不得扣积分；扣费必须发生在 AI 分析成功之后、项目和任务标记成功之前。
- 后台价格允许配置为 0；任务参数 `creditsRequired=0` 表示免费分析，不得回退为读取当前价格。
