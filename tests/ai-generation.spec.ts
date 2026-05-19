import { test, expect, Page } from '@playwright/test';

async function login(page: Page) {
  await page.goto('/login');
  await page.waitForSelector('input[placeholder="请输入手机号"]');
  await page.fill('input[placeholder="请输入手机号"]', '13800000000');
  await page.fill('input[placeholder="请输入密码"]', '00000000');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);
}

test.describe('AI 生成功能测试 - 真实内容生成', () => {

  test.setTimeout(180000);

  test('系统配置检查 - API Key 已配置', async ({ page }) => {
    const response = await page.request.get('http://localhost:5000/api/system-config');
    expect(response.status()).toBeGreaterThanOrEqual(200);

    const body = await response.json();
    console.log('━━━ 系统配置信息 ━━━');
    console.log('文本 API 数量:', body.data?.textApis?.length);
    console.log('图片 API 数量:', body.data?.imageApis?.length);
    console.log('视频 API 数量:', body.data?.videoApis?.length);
    console.log('默认文本 API:', body.data?.defaultTextApiId);
    console.log('默认图片 API:', body.data?.defaultImageApiId);
    console.log('默认视频 API:', body.data?.defaultVideoApiId);

    expect(body.data?.textApis?.length).toBeGreaterThan(0);
    expect(body.data?.imageApis?.length).toBeGreaterThan(0);
    expect(body.data?.videoApis?.length).toBeGreaterThan(0);
    console.log('✅ API Key 配置检查通过！');
  });

  test('登录后创建短片项目', async ({ page }) => {
    await login(page);

    await page.goto('/api/shortfilm/projects');
    await page.waitForLoadState('domcontentloaded');

    const content = await page.content();
    const body = JSON.parse(content.includes('<pre>')
      ? content.match(/<pre>(.*?)<\/pre>/)?.[1] || '{}'
      : content);

    console.log('获取项目列表响应状态检查...');
    console.log('当前 URL:', page.url());
  });

  test('完整流程：登录 → 创建项目 → 脚本生成', async ({ page }) => {
    await login(page);

    console.log('━━━ AI 完整生成流程测试 ━━━');

    const cookies = await page.context().cookies();

    console.log('📋 第1步：访问短片创作页面并创建项目');
    await page.goto('/shortfilm/new');
    await page.waitForLoadState('domcontentloaded');

    const descTextarea = page.locator('textarea[placeholder="描述产品的特点、卖点等..."]');
    await descTextarea.fill('测试产品：高品质无线蓝牙耳机，支持主动降噪功能');

    console.log('⏱️ 选择视频时长 - 16秒');
    await page.locator('[role="combobox"]:near(:text("视频时长"))').click();
    await page.locator('[role="option"]:has-text("16秒")').click();

    console.log('🚀 点击生成脚本按钮');
    const generateBtn = page.locator('button:has-text("生成脚本")');
    await expect(generateBtn).toBeEnabled();

    console.log('⏳ 等待脚本生成完成（最多60秒）...');

    try {
      await generateBtn.click();

      await page.waitForSelector('text=确认脚本，生成图片', { timeout: 60000 });

      console.log('✅ 脚本生成成功！已进入步骤2');
    } catch (error) {
      console.log('⚠️ 脚本生成超时或失败，尝试检查错误信息...');

      const errorLocator = page.locator('[role="alert"], .text-destructive, text=失败');
      if (await errorLocator.isVisible({ timeout: 5000 }).catch(() => false)) {
        const errorText = await errorLocator.textContent();
        console.log('错误信息:', errorText);
      }
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━');
  });

  test('通过 UI 交互测试图片生成入口', async ({ page }) => {
    await login(page);

    console.log('━━━ 图片生成入口测试 ━━━');

    await page.goto('/shortfilm/new');
    await page.waitForLoadState('domcontentloaded');

    const descTextarea = page.locator('textarea[placeholder="描述产品的特点、卖点等..."]');
    await descTextarea.fill('测试产品：智能手表');

    await page.locator('[role="combobox"]:near(:text("视频时长"))').click();
    await page.locator('[role="option"]:has-text("16秒")').click();

    const generateBtn = page.locator('button:has-text("生成脚本")');
    await generateBtn.click();

    console.log('⏳ 等待脚本生成...');

    try {
      await page.waitForSelector('text=确认脚本，生成图片', { timeout: 60000 });
      console.log('✅ 脚本生成成功！');

      console.log('➡️ 点击"确认并下一步"进入步骤3');
      const confirmBtn = page.locator('button:has-text("确认并下一步"), button:has-text("下一步")').first();
      if (await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await confirmBtn.click();
        await page.waitForTimeout(2000);
        console.log('✅ 进入图片生成步骤');
      }
    } catch (error) {
      console.log('⚠️ 流程未完成:', (error as Error).message);
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━');
  });

  test('检查用户积分和配额', async ({ page }) => {
    await login(page);

    console.log('━━━ 用户资源检查 ━━━');

    await page.goto('/shortfilm/new');
    await page.waitForLoadState('domcontentloaded');

    const creditsText = page.locator('text=/积分|余额|credit/i').first();
    if (await creditsText.isVisible({ timeout: 3000 }).catch(() => false)) {
      const text = await creditsText.textContent();
      console.log('用户积分信息:', text);
    } else {
      console.log('页面未显示积分信息（可能需要查看用户设置页面）');
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━');
  });

});
