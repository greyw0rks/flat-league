import '../src/server/load-env';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium, expect, type BrowserContext, type Page } from '@playwright/test';
import { createPublicClient, createWalletClient, http, parseUnits, type Hex } from 'viem';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { leagueChain, chainId, managerAddress, wifAddress } from '../src/lib/config';
import { managerAbi } from '../packages/contracts/managerAbi';
import { mockWifAbi } from '../packages/contracts/mockWifAbi';
import { demoQuestions } from '../packages/shared/demo-questions';
import { commitQuestions, hashArtifact, type CompetitionView, type Standing } from '../packages/shared/domain';

const base = process.env.UI_BASE_URL || 'http://localhost:3020';
if (chainId !== 31337 || !['localhost', '127.0.0.1'].includes(new URL(base).hostname) || !managerAddress || !wifAddress)
  throw new Error('Browser funding checks require the local Anvil playground.');
const client = createPublicClient({ chain: leagueChain, transport: http() });
assert.equal(await client.getChainId(), 31337);
const creator = privateKeyToAccount('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80');
// Fresh player starts with no tokens or gas and cannot receive an earlier run's payout.
const player = privateKeyToAccount(generatePrivateKey());
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const failures: string[] = [];
const walletTransactions: Hex[] = [];
mkdirSync('evidence/ui', { recursive: true });
async function contextFor(account: typeof creator | typeof player): Promise<BrowserContext> {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  const wallet = createWalletClient({ account, chain: leagueChain, transport: http() });
  await context.exposeFunction('__leagueWalletRequest', async ({ method, params = [] }: { method: string; params?: unknown[] }) => {
    if (method === 'eth_accounts' || method === 'eth_requestAccounts') return [account.address];
    if (method === 'eth_chainId') return '0x7a69';
    if (method === 'wallet_switchEthereumChain' || method === 'wallet_addEthereumChain') return null;
    if (method === 'wallet_getCapabilities') return {};
    if (method === 'personal_sign') return account.signMessage({ message: { raw: params[0] as Hex } });
    if (method === 'eth_sendTransaction') {
      const tx = params[0] as { to: Hex; data?: Hex; value?: Hex; gas?: Hex };
      const hash = await wallet.sendTransaction({ to: tx.to, data: tx.data, value: tx.value ? BigInt(tx.value) : undefined });
      walletTransactions.push(hash); return hash;
    }
    return client.request({ method, params } as never);
  });
  await context.addInitScript(() => {
    const bridge = window as unknown as { __leagueWalletRequest: (args: unknown) => Promise<unknown>; ethereum: unknown };
    bridge.ethereum = { isMetaMask: true, request: bridge.__leagueWalletRequest, on() {}, removeListener() {} };
  });
  context.on('page', page => page.on('pageerror', error => failures.push(error.message)));
  return context;
}
async function connect(page: Page) {
  await page.getByRole('button', { name: 'Connect wallet' }).first().click();
  await page.getByRole('button', { name: 'Browser wallet', exact: true }).click();
  await page.getByRole('button', { name: 'Sign in to compete', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}
async function json<T>(path: string): Promise<T> {
  const res = await fetch(base + '/api' + path); assert.equal(res.status, 200, path); return res.json() as Promise<T>;
}
const dateInput = (ms: number) => { const d = new Date(ms); return new Date(ms - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16); };
try {
  // Force the browser journey to exercise exact token approval as well as funding.
  const setupWallet = createWalletClient({ account: creator, chain: leagueChain, transport: http() });
  const resetApproval = await setupWallet.writeContract({ address: wifAddress, abi: mockWifAbi, functionName: 'approve', args: [managerAddress, 0n] });
  await client.waitForTransactionReceipt({ hash: resetApproval });
  const creatorContext = await contextFor(creator), page = await creatorContext.newPage();
  await page.goto(base); await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.screenshot({ path: 'evidence/ui/landing-desktop.png', fullPage: true });
  await page.goto(base + '/create'); await connect(page);
  const title = `Browser proof ${Date.now()}`;
  await page.getByLabel('Challenge title').fill(title);
  await page.getByLabel('What is this challenge about?').fill('Local browser verification of creator funding, a timed run, settlement, and a real MockWIF transfer.');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: /Use public sample questions/ }).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  const start = Math.ceil((Date.now() + 20_000) / 60_000) * 60_000, end = start + 180_000;
  await page.getByLabel('Reward pool (MockWIF)').fill('10');
  await page.getByLabel('Starts · your local time').fill(dateInput(start));
  await page.getByLabel('Closes · your local time').fill(dateInput(end));
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Fund 10 MockWIF', exact: true }).click();
  await page.waitForURL(/\/competitions\/[\w-]+$/, { timeout: 60_000 });
  const id = page.url().split('/').at(-1)!;
  const { markDemoCompetition } = await import('../src/server/league');
  await markDemoCompetition(id);
  const { competition: round } = await json<{ competition: CompetitionView }>('/competitions/' + id);
  assert.equal(round.pool, parseUnits('10', 18).toString());
  assert.equal((await client.getTransactionReceipt({ hash: round.fundingHash })).status, 'success');
  assert.equal(walletTransactions.length, 2, 'Browser should approve and fund exactly once');
  console.log('Creator browser funding confirmed. Waiting for the published start time.');
  const playerContext = await contextFor(player), play = await playerContext.newPage();
  await play.goto(base + '/competitions/' + id); await connect(play);
  while (Date.now() < start + 1000) await new Promise(resolve => setTimeout(resolve, Math.min(10_000, start + 1000 - Date.now())));
  await expect(play.getByRole('button', { name: 'Join for free', exact: true })).toBeVisible({ timeout: 20_000 });
  await play.getByRole('button', { name: 'Join for free', exact: true }).click();
  await expect(play.getByRole('button', { name: 'Start your run', exact: true })).toBeVisible({ timeout: 30_000 });
  await play.getByRole('button', { name: 'Start your run', exact: true }).click();
  await play.getByRole('button', { name: 'Start my run', exact: true }).click();
  await play.waitForURL(/\/play$/);
  await expect(play.locator('fieldset.answers')).toBeVisible();
  await expect(play.locator('canvas, .arena-canvas')).toHaveCount(0);
  const walletBefore = await client.readContract({ address: wifAddress, abi: mockWifAbi, functionName: 'balanceOf', args: [player.address] });
  for (let i = 0; i < 10; i++) {
    const prompt = await play.locator('.quiz-container h1').innerText();
    const question = demoQuestions.find(q => q.prompt === prompt)!; assert.ok(question);
    const text = question.options.find(o => o.id === question.correctOption)!.text;
    if (i === 0) {
      const radios = play.getByRole('radio');
      await radios.first().focus(); await play.keyboard.press('Space');
      await expect(radios.first()).toBeChecked(); await play.keyboard.press('ArrowDown');
      await expect(radios.nth(1)).toBeChecked();
    }
    await play.locator('.answer-option').filter({ hasText: text }).click();
    if (i === 0) {
      await play.screenshot({ path: 'evidence/ui/quiz-desktop.png', fullPage: true });
      await play.reload(); await expect(play.locator('.quiz-container h1')).toHaveText(prompt);
      await play.locator('.answer-option').filter({ hasText: text }).click();
    }
    await play.getByRole('button', { name: i === 9 ? 'Finish my run' : 'Confirm & next', exact: true }).click();
    if (i < 9) { await expect(play.locator('.quiz-container h1')).not.toHaveText(prompt); await expect(play.locator('.quiz-container h1')).toBeFocused(); }
  }
  await expect(play.getByRole('heading', { name: 'Your run is in.' })).toBeVisible();
  const interim = await json<{ standings: Standing[] }>('/competitions/' + id + '/results'); assert.deepEqual(interim.standings, []);
  console.log('Second wallet completed ten answers; reload preserved its run and live scores remain hidden.');
  await play.getByRole('link', { name: 'View standings', exact: true }).click();
  const mobile = await playerContext.newPage(); await mobile.setViewportSize({ width: 390, height: 844 });
  await mobile.goto(base + '/discover'); await mobile.screenshot({ path: 'evidence/ui/discover-mobile.png' });
  assert.ok(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Mobile page must not overflow');
  for (const path of ['/leaderboard', '/profile', '/my-competitions', '/rules']) {
    const response = await mobile.goto(base + path); assert.equal(response?.status(), 200, path);
  }
  const visualContext = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'no-preference' });
  const animated = await visualContext.newPage();
  animated.on('pageerror', error => failures.push(error.message));
  await animated.goto(base);
  await expect(animated.locator('.hero-art .game-world img')).toBeVisible({ timeout: 15_000 });
  await animated.waitForTimeout(1000);
  assert.ok(await animated.locator('.hero-art .game-world img').count(), 'Arcade world artwork must render');
  await animated.screenshot({ path: 'evidence/ui/landing-webgl.png', fullPage: true });
  await visualContext.close();
  while (Date.now() < end + 1000) await new Promise(resolve => setTimeout(resolve, Math.min(10_000, end + 1000 - Date.now())));
  // Anvil mines on transactions by default; mine a block at wall-clock time for post-close estimation.
  await client.request({ method: 'evm_mine' as never } as never);
  console.log('Round closed. Waiting for signed settlement and sponsored reward receipt.');
  let result: { standings: Standing[]; finalized: boolean; artifact: { questions: typeof demoQuestions; salt: Hex }; settlementHash: Hex } | undefined;
  for (let n = 0; n < 30; n++) {
    result = await json('/competitions/' + id + '/results');
    if (result!.finalized && result!.standings[0]?.paid) break;
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  assert.ok(result?.finalized); const winner = result.standings[0]; assert.ok(winner.paid); assert.equal(winner.score, 100); assert.equal(winner.wallet.toLowerCase(), player.address.toLowerCase());
  assert.equal(winner.reward, parseUnits('10', 18).toString());
  assert.equal((await client.readContract({ address: wifAddress, abi: mockWifAbi, functionName: 'balanceOf', args: [player.address] })) - walletBefore, parseUnits('10', 18));
  assert.equal(commitQuestions(result.artifact.questions, result.artifact.salt), round.questionCommitment);
  const settled = await client.readContract({ address: managerAddress, abi: managerAbi, functionName: 'getCompetition', args: [BigInt(round.onchainId)] }); assert.equal(settled.status, 1);
  await expect(play.getByText('Your reward has arrived.')).toBeVisible({ timeout: 20_000 });
  await play.screenshot({ path: 'evidence/ui/results-desktop.png', fullPage: true });
  assert.deepEqual(failures, [], 'Browser runtime errors');
  writeFileSync('evidence/local-lifecycle.json', JSON.stringify({ checkedAt: new Date().toISOString(), network: 'Local Anvil ONLY', chainId: 31337, competitionId: id, onchainId: round.onchainId, creator: creator.address, player: player.address, pool: round.pool, approvalHash: walletTransactions[0], fundingHash: round.fundingHash, settlementHash: result.settlementHash, rewardHash: winner.txHash, artifactHash: hashArtifact(result.artifact), score: winner.score, elapsedMs: winner.elapsedMs, checks: ['creator browser authoring/approval/funding', 'wallet SIWE login', 'sponsored registration', 'ten answers', 'reload recovery', 'hidden live scores', 'signed settlement', 'confirmed MockWIF balance increase', 'question commitment', 'mobile overflow', 'public routes', 'arena artwork/fallback', 'zero browser runtime errors'] }, null, 2) + '\n');
  console.log('PASS: browser creator → player → signed result → 10 MockWIF reward. Evidence saved.');
} catch (error) {
  for (const [i, context] of browser.contexts().entries()) {
    const page = context.pages().at(-1);
    if (page) await page.screenshot({ path: `evidence/ui/failure-${i}.png`, fullPage: true }).catch(() => {});
  }
  throw error;
} finally { await browser.close(); }
