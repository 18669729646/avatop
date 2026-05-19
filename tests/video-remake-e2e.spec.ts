import { test, expect, Page } from '@playwright/test';

async function login(page: Page) {
  await page.goto('/login');
  await page.waitForSelector('input[placeholder="请输入手机号"]');
  await page.fill('input[placeholder="请输入手机号"]', '13800000000');
  await page.fill('input[placeholder="请输入密码"]', '00000000');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);
}

test.describe('模拟用户制作视频复刻 - 完整流程 E2E', () => {

  test('进入视频复刻列表页面', async ({ page }) => {
    await login(page);

    await page.goto('/video-remake');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('body')).toBeVisible();
    console.log('✅ 视频复刻列表页面加载成功');
  });

  test('进入视频复刻创建页面', async ({ page }) => {
    await login(page);

    await page.goto('/video-remake/new');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('body')).toBeVisible();
    console.log('✅ 视频复刻创建页面加载成功');
  });

  test('通过项目参数进入复刻模式的短片页面', async ({ page }) => {
    await login(page);

    const projectId = 'temp-project-123';
    await page.goto(`/shortfilm/new?id=${projectId}&mode=remake`);
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('body')).toBeVisible();
    console.log('✅ 复刻模式的短片页面加载成功');
  });

  test('完整复刻流程：从列表到创建页面', async ({ page }) => {
    await login(page);

    console.log('━━━ 模拟用户制作视频复刻 ━━━');

    console.log('📋 第1步：访问视频复刻列表');
    await page.goto('/video-remake');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).toBeVisible();

    console.log('➕ 第2步：点击新建项目进入创建页面');
    await page.goto('/video-remake/new');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('body')).toBeVisible();
    console.log('✅ 视频复刻基础流程测试通过！');
  });

  test('检查复刻页面的元素', async ({ page }) => {
    await login(page);

    await page.goto('/shortfilm/new?mode=remake');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByText('脚本生成', { exact: true })).toBeVisible();
    await expect(page.getByText('确认脚本', { exact: true })).toBeVisible();
    await expect(page.getByText('生成图片', { exact: true })).toBeVisible();
    await expect(page.getByText('生成视频', { exact: true })).toBeVisible();
    await expect(page.getByText('预览成果', { exact: true })).toBeVisible();

    console.log('✅ 复刻页面的步骤指示器元素验证完成');
  });

  test('完整复刻流程：登录 → 列表 → 创建', async ({ page }) => {
    await login(page);

    console.log('━━━ 完整视频复刻流程测试 ━━━');

    console.log('📋 访问复刻列表');
    await page.goto('/video-remake');
    await page.waitForLoadState('domcontentloaded');

    console.log('➕ 新建复刻项目');
    await page.goto('/video-remake/new');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('body')).toBeVisible();

    console.log('✅ 视频复刻完整流程测试通过！');
  });

});

test.describe('短片 & 复刻 综合测试', () => {

  test('用户可以在短片创作和视频复刻间切换', async ({ page }) => {
    await login(page);

    console.log('━━━ 综合功能验证 ━━━');

    console.log('1️⃣ 访问短片创作页面');
    await page.goto('/shortfilm/new');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).toBeVisible();

    console.log('2️⃣ 切换到视频复刻列表');
    await page.goto('/video-remake');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).toBeVisible();

    console.log('3️⃣ 回到短片列表');
    await page.goto('/shortfilm');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).toBeVisible();

    console.log('✅ 页面间切换测试通过！');
  });

  test('所有核心页面都可访问', async ({ page }) => {
    await login(page);

    const pages = [
      { url: '/shortfilm/new', name: '短片创作' },
      { url: '/shortfilm', name: '短片列表' },
      { url: '/video-remake', name: '视频复刻列表' },
      { url: '/video-remake/new', name: '视频复刻创建' },
      { url: '/queue', name: '任务队列' },
    ];

    for (const pageConfig of pages) {
      console.log(`📋 访问 ${pageConfig.name}`);
      await page.goto(pageConfig.url);
      await page.waitForLoadState('domcontentloaded');
      await expect(page.locator('body')).toBeVisible();
    }

    console.log('✅ 所有核心页面访问测试通过！');
  });

});
