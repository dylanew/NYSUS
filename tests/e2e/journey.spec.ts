import { expect, test, type Page } from '@playwright/test'

/**
 * Spec 11.3, end to end: open the app, search, view recommendations, add to the watchlist,
 * open the player, trigger buffering, ask for a diagnosis, and receive a report that
 * contains the session's actual telemetry values.
 */

async function bufferingRatioOnPage(page: Page): Promise<string> {
  const tile = page.locator('dt', { hasText: /^Buffering$/ }).locator('..')
  return (await tile.locator('dd').innerText()).trim() // e.g. "23.5%"
}

test('discover, save, play a poor connection and get a grounded diagnosis', async ({ page }) => {
  // 1. Open the application, as a guest with no account.
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Good to see you.' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Welcome' })).toContainText("You're exploring as a guest")

  // 2. Search for a film.
  await page.getByLabel(/what would you like to watch/i).fill('Something like Interstellar, but darker and more suspenseful')
  await page.getByRole('button', { name: /find something/i }).click()

  // 3. View recommendations, with the inference source and explanations.
  await expect(page).toHaveURL(/\/discover\?q=/)
  await expect(page.getByText('Processed on your device')).toBeVisible()
  const results = page.getByRole('region', { name: 'Results' })
  const first = results.getByRole('article').first()
  await expect(first.getByText(/^Recommended because/)).toBeVisible()
  const firstTitle = (await first.getByRole('link').nth(1).innerText()).trim()

  // 4. Add a title to the watchlist; it survives a reload.
  await first.getByRole('button', { name: /add to watchlist/i }).click()
  await expect(first.getByRole('button', { name: /in watchlist/i })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Watchlist' }).click()
  await expect(page.getByRole('heading', { name: 'Watchlist', level: 1 })).toBeVisible()
  await expect(page.getByRole('link', { name: firstTitle })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('link', { name: firstTitle })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Your taste' })).toContainText(/science fiction/i)

  // 5. Open the player for that title.
  await page.getByRole('link', { name: firstTitle }).click()
  await page.getByRole('link', { name: /watch \(simulated\)/i }).click()
  await expect(page).toHaveURL(/\/player\?title=/)
  await expect(page.getByRole('heading', { name: firstTitle, level: 1 })).toBeVisible()

  // 6. Trigger a buffering scenario.
  await page.getByLabel('Network').selectOption('poor')
  await page.getByRole('button', { name: 'Play', exact: true }).last().click()
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: /simulate 30 s/i }).click()
  await page.getByRole('button', { name: 'Pause', exact: true }).last().click()
  await expect(page.locator('ol, ul').getByText(/Buffering started/).first()).toBeVisible()
  const ratio = await bufferingRatioOnPage(page)
  expect(Number.parseFloat(ratio)).toBeGreaterThan(0)

  // 7. Request a diagnostic investigation.
  await page.getByRole('button', { name: /ask why it's buffering/i }).click()
  const drawer = page.getByRole('dialog', { name: 'Streaming assistant' })
  await expect(drawer).toBeVisible()

  // The tool activity reflects the calls the model actually made.
  await expect(drawer.getByText(/playback metrics/i).first()).toBeVisible()

  // 8. The report contains the session's actual telemetry values.
  await expect(drawer.getByText(new RegExp(`buffering ratio ${ratio.replace('%', '').replace('.', '\\.')}%`))).toBeVisible()
  await expect(drawer.getByRole('region', { name: 'Diagnostic report' })).toBeVisible()
  await expect(drawer.getByText(/s\d+-e\d+/).first()).toBeVisible()
})

test('a guest can load the demo profile and the session is kept for later', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('region', { name: 'Welcome' }).getByRole('button', { name: 'Load demo profile' }).click()
  await expect(page.getByText(/Based on 6 saved titles/)).toBeVisible()

  await page.goto('/player?title=dune')
  await page.getByLabel('Network').selectOption('unstable')
  await page.getByRole('button', { name: 'Play', exact: true }).last().click()
  await page.getByRole('button', { name: /simulate 30 s/i }).click()
  await page.getByRole('button', { name: 'Pause', exact: true }).last().click()

  await page.goto('/')
  const continueWatching = page.getByRole('heading', { name: 'Continue watching' }).locator('..')
  await expect(continueWatching.getByRole('link', { name: /Dune/ })).toBeVisible()
  await expect(continueWatching).toContainText('Unstable connection')

  // Account menu: guest, saved in this browser, data can be deleted.
  await page.getByRole('button', { name: /account menu/i }).click()
  const menu = page.getByRole('region', { name: 'Account' })
  await expect(menu).toContainText('Exploring as a guest')
  await expect(menu).toContainText('Saved in this browser')
  await menu.getByRole('button', { name: /delete my saved data/i }).click()
  await menu.getByRole('button', { name: /click again to delete everything/i }).click()
  await expect(continueWatching.getByRole('link', { name: /Dune/ })).toHaveCount(0)
})

test('unknown pages and the assistant without a session are handled', async ({ page }) => {
  await page.goto('/nowhere')
  await expect(page.getByRole('heading', { name: 'Not found' })).toBeVisible()
  await page.goto('/assistant')
  await page.getByRole('textbox').first().fill('Why does my stream keep buffering?')
  await page.keyboard.press('Enter')
  await expect(page.getByText(/no playback session|press play/i).first()).toBeVisible()
})
