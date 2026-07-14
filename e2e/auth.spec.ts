import { test, expect } from "@playwright/test";

test.describe("auth smoke", () => {
  test("login page renders", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: /تسجيل الدخول|Sign in|登录/i })).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test("unauthenticated users are redirected to login", async ({ page }) => {
    await page.goto("/shipments");
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("optional authenticated flows", () => {
  test.skip(!process.env.E2E_EMAIL || !process.env.E2E_PASSWORD, "Requires E2E_EMAIL and E2E_PASSWORD");

  test("can sign in with test credentials", async ({ page }) => {
    await page.goto("/login");
    await page.locator('input[type="email"]').fill(process.env.E2E_EMAIL!);
    await page.locator('input[type="password"]').fill(process.env.E2E_PASSWORD!);
    await page.getByRole("button", { name: /دخول|Sign in|登录/i }).click();
    await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });
  });
});
