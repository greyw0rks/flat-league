import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium, expect } from '@playwright/test';
import type { CompetitionView, Standing } from '../packages/shared/domain';

const base = process.env.UI_BASE_URL || 'http://localhost:3020';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw new Error('UI review requires a local preview.');
mkdirSync('evidence/ui', { recursive: true });
const errors: string[] = [];
const report: Record<string, unknown> = { base, checkedAt: new Date().toISOString(), errors, fixtureScreenshots: ['results-three-player-fixture-desktop.png', 'results-three-player-fixture-mobile.png'] };
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  context.setDefaultNavigationTimeout(120_000);
  context.on('page', page => page.on('pageerror', error => errors.push(error.message)));
  const page = await context.newPage();
  await page.goto(base); await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.locator('.arena-poster')).toBeVisible();
  await expect(page.locator('.arena-canvas canvas')).toHaveCount(0);
  await page.screenshot({ path: 'evidence/ui/landing-polished-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Connect wallet', exact: true }).focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  assert.ok(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]')), 'Wallet drawer must receive focus');
  await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Connect wallet', exact: true })).toBeFocused();
  await page.getByRole('link', { name: 'FIND YOUR NEXT CHALLENGE' }).click();
  await expect(page.locator('#challenges')).toBeInViewport();
  report.keyboardDrawerAndAnchor = 'passed';

  const sizes = [{ name: 'tablet', width: 768, height: 1024 }, { name: 'mobile', width: 390, height: 844 }, { name: 'small-mobile', width: 360, height: 740 }];
  for (const size of sizes) {
    await page.setViewportSize(size); await page.goto(base);
    await expect(page.getByRole('link', { name: 'Enter the league', exact: true })).toBeVisible();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${size.name} landing overflow`);
    await page.screenshot({ path: `evidence/ui/landing-polished-${size.name}.png`, fullPage: true });
    await page.goto(base + '/discover'); await expect(page.getByRole('group', { name: 'Filter competitions by status' })).toBeVisible();
    await page.getByRole('button', { name: 'Live', exact: true }).focus(); await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: 'Live', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'All rounds', exact: true }).click();
    await page.getByLabel('Search competitions').fill('no-such-round-ui-proof');
    await expect(page.getByRole('heading', { name: 'No rounds match your search.' })).toBeVisible();
    await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
    await expect(page.getByLabel('Search competitions')).toHaveValue('');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${size.name} discover overflow`);
    await page.screenshot({ path: `evidence/ui/discover-polished-${size.name}.png`, fullPage: true });
  }
  report.responsiveAndFilters = sizes.map(s => s.name);

  const response = await fetch(base + '/api/competitions'); assert.equal(response.status, 200);
  const { competitions } = await response.json() as { competitions: CompetitionView[] };
  const finalized = competitions.find(c => c.status === 'finalized');
  if (finalized) {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`${base}/competitions/${finalized.id}/results`);
    await expect(page.locator('.podium-card').first()).toBeVisible();
    await page.screenshot({ path: 'evidence/ui/results-polished-desktop.png', fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: 'evidence/ui/results-polished-mobile.png', fullPage: true });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Results overflow');
    report.actualResultRound = finalized.id;

    // Three-place layout is a browser-only fixture, never persisted as activity.
    const standings: Standing[] = [1, 2, 3].map((rank) => ({ rank, wallet: `0x${String(rank).padStart(40, '0')}` as `0x${string}`, score: 110 - rank * 10, elapsedMs: 18_000 + rank * 3000, startedAt: finalized.startAt, reward: `${[60n, 25n, 15n][rank - 1] * 10n ** 18n}`, paid: false, txHash: null }));
    await page.route(`**/api/competitions/${finalized.id}/results`, route => route.fulfill({ json: { standings, finalized: true, settlementHash: finalized.settlementHash, artifact: null, serverNow: Date.now() } }));
    await page.reload(); await expect(page.locator('.podium-card')).toHaveCount(3);
    const wallets = page.locator('.podium-wallet');
    assert.ok(await wallets.evaluateAll(nodes => nodes.every(node => parseFloat(getComputedStyle(node).fontSize) >= 11)), 'Mobile podium wallets must remain legible');
    const first = await page.locator('.podium-card[data-rank="1"]').boundingBox(), second = await page.locator('.podium-card[data-rank="2"]').boundingBox();
    assert.ok(first && second && first.y < second.y, 'Mobile podium must show first place first');
    await page.screenshot({ path: 'evidence/ui/results-three-player-fixture-mobile.png', fullPage: true });
    await page.setViewportSize({ width: 1440, height: 1000 });
    const boxes = await Promise.all([1, 2, 3].map(rank => page.locator(`.podium-card[data-rank="${rank}"]`).boundingBox()));
    assert.ok(boxes[0] && boxes[1] && boxes[2] && boxes[1].x < boxes[0].x && boxes[0].x < boxes[2].x, 'Desktop winner must sit between second and third');
    await page.screenshot({ path: 'evidence/ui/results-three-player-fixture-desktop.png', fullPage: true });
    report.threePlayerLayoutFixture = 'passed';
  }
  await context.close();

  const animatedContext = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'no-preference' });
  animatedContext.setDefaultNavigationTimeout(120_000);
  animatedContext.on('page', page => page.on('pageerror', error => errors.push(error.message)));
  const animated = await animatedContext.newPage(); await animated.goto(base);
  await expect(animated.locator('.arena-canvas')).toBeVisible({ timeout: 30_000 });
  await expect(animated.locator('.arena-canvas canvas, .arena-canvas .arena-poster')).toHaveCount(1, { timeout: 30_000 });
  await animated.waitForTimeout(1000);
  const canvas = animated.locator('.arena-canvas canvas');
  const webgl = await canvas.count() === 1;
  if (webgl) {
    await expect(animated.getByRole('button', { name: 'Pause arena animation' })).toBeVisible();
    const before = await canvas.screenshot(); await animated.waitForTimeout(250); const after = await canvas.screenshot();
    report.animatedFramesChanged = !before.equals(after);
    assert.ok(!before.equals(after), 'Arena canvas must animate');
    await animated.getByRole('button', { name: 'Pause arena animation' }).click();
    await expect(animated.getByRole('button', { name: 'Play arena animation' })).toHaveAttribute('aria-pressed', 'true');
    await expect(animated.locator('.arena-canvas')).toHaveAttribute('data-motion-state', 'paused');
  }
  if (webgl) {
    await animated.waitForTimeout(200);
    const before = await canvas.screenshot(); await animated.waitForTimeout(250); const after = await canvas.screenshot();
    assert.ok(before.equals(after), 'Paused canvas must stop animating'); report.pausedFramesStable = true;
  }
  await animated.screenshot({ path: 'evidence/ui/landing-polished-motion.png', fullPage: true });
  if (webgl) {
    await animated.getByRole('button', { name: 'Play arena animation' }).click();
    await animated.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(animated.locator('.arena-canvas')).toHaveAttribute('data-motion-state', 'paused');
    await animated.evaluate(() => window.scrollTo(0, 0));
    await expect(animated.locator('.arena-canvas')).toHaveAttribute('data-motion-state', 'running');
    await canvas.evaluate(node => node.dispatchEvent(new Event('webglcontextlost')));
    await expect(animated.locator('.arena-canvas .arena-poster')).toBeVisible();
    await expect(animated.locator('.arena-canvas canvas')).toHaveCount(0);
    await expect(animated.getByRole('link', { name: 'Enter the league', exact: true })).toBeVisible();
    report.contextLossFallback = 'passed';
    report.pauseAndOffscreen = 'passed';
  } else {
    await expect(animated.locator('.arena-canvas')).toHaveAttribute('data-motion-state', 'static');
    await expect(animated.getByRole('button', { name: 'Pause arena animation' })).toHaveCount(0);
    await expect(animated.getByRole('link', { name: 'Enter the league', exact: true })).toBeVisible();
    report.pauseAndOffscreen = 'requires WebGL-capable browser; unavailable controls correctly hidden';
  }
  report.webgl = webgl ? 'software Chromium canvas verified; physical-device performance not measured' : 'static fallback rendered';
  report.reducedMotion = 'static artwork, no canvas';
  await animatedContext.close();
  assert.deepEqual(errors, [], 'Browser runtime errors');
  report.status = 'passed';
  console.log(JSON.stringify(report, null, 2));
} finally {
  writeFileSync('evidence/ui-polish.json', JSON.stringify(report, null, 2) + '\n');
  await browser.close();
}
