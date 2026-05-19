import { test, expect, Page } from '@playwright/test';

async function login(page: Page) {
  await page.goto('/login');
  await page.waitForSelector('input[placeholder="请输入手机号"]');
  await page.fill('input[placeholder="请输入手机号"]', '13800000000');
  await page.fill('input[placeholder="请输入密码"]', '00000000');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);
}

test.describe('模拟用户制作短片 - 完整流程 E2E', () => {

  test('步骤1：进入短片创作页面', async ({ page }) => {
    await login(page);

    await page.goto('/shortfilm/new');
    await page.waitForSelector('textarea[placeholder="描述产品的特点、卖点等..."]', { timeout: 10000 });

    await expect(page.getByText('脚本生成', { exact: true })).toBeVisible();
    await expect(page.getByText('确认脚本', { exact: true })).toBeVisible();
    await expect(page.getByText('生成图片', { exact: true })).toBeVisible();
    await expect(page.getByText('生成视频', { exact: true })).toBeVisible();
    await expect(page.getByText('预览成果', { exact: true })).toBeVisible();

    console.log('✅ 步骤1完成：成功进入短片创作页面');
  });

  test('步骤2：选择手动模式并配置时长', async ({ page }) => {
    await login(page);
    await page.goto('/shortfilm/new');
    await page.waitForSelector('textarea[placeholder="描述产品的特点、卖点等..."]', { timeout: 10000 });

    await page.getByText('手动输入提示词').click();
    await page.waitForTimeout(500);

    const duration16Btn = page.locator('text=16秒').first();
    await expect(duration16Btn).toBeVisible();
    await duration16Btn.click();

    const nextBtn = page.locator('button:has-text("下一步：确认脚本")');
    await expect(nextBtn).toBeVisible();
    await expect(nextBtn).toBeEnabled();

    console.log('✅ 步骤2完成：选择手动模式，配置16秒时长');
  });

  test('步骤3：进入步骤2确认脚本页面', async ({ page }) => {
    await login(page);
    await page.goto('/shortfilm/new');
    await page.waitForSelector('textarea[placeholder="描述产品的特点、卖点等..."]', { timeout: 10000 });

    await page.getByText('手动输入提示词').click();
    await page.waitForTimeout(500);
    await page.locator('text=16秒').first().click();
    await page.locator('button:has-text("下一步：确认脚本")').click();

    await expect(page.getByText('确认脚本，生成图片')).toBeVisible({ timeout: 5000 });

    console.log('✅ 步骤3完成：成功进入步骤2确认脚本页面');
  });

  test('步骤4：编辑段落提示词', async ({ page }) => {
    await login(page);
    await page.goto('/shortfilm/new');
    await page.waitForSelector('textarea[placeholder="描述产品的特点、卖点等..."]', { timeout: 10000 });

    await page.getByText('手动输入提示词').click();
    await page.waitForTimeout(500);
    await page.locator('text=16秒').first().click();
    await page.locator('button:has-text("下一步：确认脚本")').click();
    await page.waitForTimeout(1000);

    await expect(page.getByText('确认脚本，生成图片')).toBeVisible();

    const textareas = page.locator('textarea');
    const count = await textareas.count();
    console.log(`找到 ${count} 个文本框`);

    if (count >= 1) {
      await textareas.first().fill('一位年轻女性在户外跑步，阳光明媚，背景是城市天际线');
    }

    console.log('✅ 步骤4完成：成功编辑段落提示词');
  });

  test('完整流程：从创建到步骤2', async ({ page }) => {
    await login(page);
    await page.goto('/shortfilm/new');
    await page.waitForSelector('textarea[placeholder="描述产品的特点、卖点等..."]', { timeout: 10000 });

    console.log('━━━ 模拟用户制作短片 ━━━');

    console.log('📝 第1步：选择手动输入模式');
    await page.getByText('手动输入提示词').click();
    await page.waitForTimeout(500);

    console.log('⏱️ 第2步：选择视频时长 - 16秒');
    await page.locator('text=16秒').first().click();

    console.log('➡️ 第3步：点击下一步');
    await page.locator('button:has-text("下一步：确认脚本")').click();
    await page.waitForTimeout(1000);

    console.log('✨ 第4步：等待步骤2页面加载');
    await expect(page.getByText('确认脚本，生成图片')).toBeVisible({ timeout: 5000 });

    console.log('📝 第5步：编辑第一个段落的描述');
    const textareas = page.locator('textarea');
    const count = await textareas.count();
    if (count >= 1) {
      await textareas.first().fill('产品特写镜头：精致的外观设计，流畅的线条');
    }

    console.log('✅ 完整流程测试通过！用户可以成功创建短片项目');
  });

  test('用户操作模拟：AI模式填写表单', async ({ page }) => {
    await login(page);
    await page.goto('/shortfilm/new');
    await page.waitForSelector('textarea[placeholder="描述产品的特点、卖点等..."]', { timeout: 10000 });

    console.log('━━━ 模拟用户在AI模式下填写表单 ━━━');

    console.log('📝 填写产品描述');
    const descTextarea = page.locator('textarea[placeholder="描述产品的特点、卖点等..."]');
    await descTextarea.fill('这是一款智能降噪蓝牙耳机，采用先进主动降噪技术，续航长达30小时，佩戴舒适，适合运动和通勤使用。');

    console.log('⏱️ 选择视频时长 - 24秒');
    await page.locator('[role="combobox"]:near(:text("视频时长"))').click();
    await page.locator('[role="option"]:has-text("24秒")').click();

    console.log('✨ 验证生成按钮已启用');
    const generateBtn = page.locator('button:has-text("生成脚本")');
    await expect(generateBtn).toBeEnabled();

    console.log('✅ AI模式表单填写测试通过！');
  });

});
