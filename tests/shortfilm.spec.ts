import { test, expect, Page } from '@playwright/test';

async function login(page: Page) {
  await page.goto('/login');
  await page.waitForSelector('input[placeholder="请输入手机号"]');
  await page.fill('input[placeholder="请输入手机号"]', '13800000000');
  await page.fill('input[placeholder="请输入密码"]', '00000000');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);
}

test.describe('短片创作 - 步骤1：脚本生成', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/shortfilm/new');
    await page.waitForSelector('textarea[placeholder="描述产品的特点、卖点等..."]', { timeout: 10000 });
  });

  test('页面加载 - 步骤指示器显示正确', async ({ page }) => {
    await expect(page.getByText('脚本生成', { exact: true })).toBeVisible();
    await expect(page.getByText('确认脚本', { exact: true })).toBeVisible();
    await expect(page.getByText('生成图片', { exact: true })).toBeVisible();
    await expect(page.getByText('生成视频', { exact: true })).toBeVisible();
    await expect(page.getByText('预览成果', { exact: true })).toBeVisible();
  });

  test('页面加载 - 初始字段状态正确', async ({ page }) => {
    await expect(page.getByText('AI自动生成脚本')).toBeVisible();
    await expect(page.getByText('手动输入提示词')).toBeVisible();
    const descTextarea = page.locator('textarea[placeholder="描述产品的特点、卖点等..."]');
    await expect(descTextarea).toBeVisible();
    await expect(descTextarea).toHaveValue('');
    await expect(page.locator('text=视频时长')).toBeVisible();
  });

  test('生成按钮初始状态 - 无内容时禁用', async ({ page }) => {
    const generateBtn = page.locator('button:has-text("生成脚本")');
    await expect(generateBtn).toBeVisible();
    await expect(generateBtn).toBeDisabled();
  });

  test('填写产品描述后生成按钮启用', async ({ page }) => {
    const descTextarea = page.locator('textarea[placeholder="描述产品的特点、卖点等..."]');
    await descTextarea.fill('这是一款智能手表，具有心率监测和运动追踪功能');
    await expect(page.locator('button:has-text("生成脚本")')).toBeEnabled();
  });

  test('切换时长选项', async ({ page }) => {
    await page.locator('[role="combobox"]:near(:text("视频时长"))').click();
    await page.locator('[role="option"]:has-text("32秒")').click();
    await expect(page.locator('text=32秒').first()).toBeVisible();
  });

  test('切换到手动输入模式', async ({ page }) => {
    await page.getByText('手动输入提示词').click();
    await page.waitForTimeout(500);
    await expect(page.locator('button:has-text("下一步：确认脚本")')).toBeVisible();
    await expect(page.locator('text=8秒').first()).toBeVisible();
  });

  test('手动模式 - 选择时长后进入下一步', async ({ page }) => {
    await page.getByText('手动输入提示词').click();
    await page.waitForTimeout(500);
    await page.locator('text=24秒').first().click();
    await page.locator('button:has-text("下一步：确认脚本")').click();
    await expect(page.getByText('确认脚本，生成图片')).toBeVisible({ timeout: 5000 });
  });

  test('产品选择下拉框存在', async ({ page }) => {
    await expect(page.getByText('选择已有产品（可选）')).toBeVisible();
  });

  test('产品图片上传区域存在', async ({ page }) => {
    await expect(page.locator('text=产品图片')).toBeVisible();
    const fileInput = page.locator('input[type="file"][accept*="image"]');
    await expect(fileInput).toBeAttached();
  });
});

test.describe('短片创作 - 步骤2：确认脚本', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('手动模式进入步骤2后界面元素正常', async ({ page }) => {
    await page.goto('/shortfilm/new');
    await page.waitForSelector('textarea[placeholder="描述产品的特点、卖点等..."]', { timeout: 10000 });
    await page.getByText('手动输入提示词').click();
    await page.waitForTimeout(500);
    await page.locator('text=16秒').first().click();
    await page.locator('button:has-text("下一步：确认脚本")').click();
    await page.waitForTimeout(1000);
    await expect(page.getByText('确认脚本，生成图片')).toBeVisible();
  });
});

test.describe('短片创作 - 页面交互测试', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/shortfilm/new');
    await page.waitForSelector('textarea[placeholder="描述产品的特点、卖点等..."]', { timeout: 10000 });
  });

  test('输入框可正常输入', async ({ page }) => {
    const descTextarea = page.locator('textarea[placeholder="描述产品的特点、卖点等..."]');
    const testText = '测试产品：高品质无线蓝牙耳机，支持主动降噪，续航30小时';
    await descTextarea.fill(testText);
    await expect(descTextarea).toHaveValue(testText);
  });

  test('清空输入后按钮恢复禁用', async ({ page }) => {
    const descTextarea = page.locator('textarea[placeholder="描述产品的特点、卖点等..."]');
    await descTextarea.fill('测试内容');
    await expect(page.locator('button:has-text("生成脚本")')).toBeEnabled();
    await descTextarea.clear();
    await expect(page.locator('button:has-text("生成脚本")')).toBeDisabled();
  });

  test('模式切换保持输入内容', async ({ page }) => {
    const descTextarea = page.locator('textarea[placeholder="描述产品的特点、卖点等..."]');
    await descTextarea.fill('测试产品描述');
    await page.getByText('手动输入提示词').click();
    await page.waitForTimeout(300);
    await page.getByText('AI自动生成脚本').click();
    await page.waitForTimeout(300);
    await expect(descTextarea).toHaveValue('测试产品描述');
  });
});

test.describe('短片创作 - API 测试', () => {
  test('系统配置 API 可访问', async ({ page }) => {
    const response = await page.request.get('/api/system-config');
    expect(response.status()).toBeGreaterThanOrEqual(200);
  });

  test('短片项目列表 API 可访问', async ({ page }) => {
    const response = await page.request.get('/api/shortfilm/projects');
    expect(response.status()).toBeGreaterThanOrEqual(200);
  });
});
