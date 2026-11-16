import { expect, test } from '@playwright/test'

/** Phone layout: no sideways page scroll, nav reachable, account menu and assistant usable. */
test('works on a phone', async ({ page }) => {
  for (const path of ['/', '/discover', '/watchlist', '/player', '/health', '/settings']) {
    await page.goto(path)
    await expect(page.locator('main')).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow, `horizontal overflow on ${path}`).toBeLessThanOrEqual(1)
  }
  await page.goto('/')
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Stream Health' }).click()
  await expect(page).toHaveURL(/\/health/)
  await page.getByRole('button', { name: /account menu/i }).click()
  const menu = page.getByRole('region', { name: 'Account' })
  await expect(menu).toBeVisible()
  const box = await menu.boundingBox()
  const width = page.viewportSize()!.width
  expect(box!.x).toBeGreaterThanOrEqual(0)
  expect(box!.x + box!.width).toBeLessThanOrEqual(width)
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Ask NYSUS' }).click()
  await expect(page.getByRole('dialog', { name: 'Streaming assistant' })).toBeVisible()
})
