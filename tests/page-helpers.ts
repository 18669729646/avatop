import { Page, Locator, expect } from '@playwright/test';

export class LoginHelper {
  readonly page: Page;
  readonly phoneInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.phoneInput = page.locator('input[type="tel"], input[placeholder*="手机"]');
    this.passwordInput = page.locator('input[type="password"]');
    this.submitButton = page.locator('button[type="submit"], button:has-text("登录")');
    this.errorMessage = page.locator('[role="alert"], .text-destructive');
  }

  async login(phone: string, password: string): Promise<void> {
    await this.page.goto('/login');
    await this.phoneInput.fill(phone);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
    await this.page.waitForURL('**/');
  }

  async expectLoginSuccess(): Promise<void> {
    await expect(this.page).toHaveURL(/\/$|\/\?/);
  }

  async expectLoginError(expectedMessage?: string): Promise<void> {
    if (expectedMessage) {
      await expect(this.errorMessage).toContainText(expectedMessage);
    } else {
      await expect(this.errorMessage).toBeVisible();
    }
  }
}

export class ShortfilmPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async goto(): Promise<void> {
    await this.page.goto('/shortfilm/new');
  }

  async waitForStep1(): Promise<void> {
    await this.page.waitForSelector('text=产品描述, text=生成脚本', { timeout: 10000 });
  }
}

export class VideoRemakePage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async goto(): Promise<void> {
    await this.page.goto('/video-remake');
  }

  async gotoNew(): Promise<void> {
    await this.page.goto('/video-remake/new');
  }
}
