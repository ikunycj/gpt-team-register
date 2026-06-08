#!/usr/bin/env node
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require(
  '/Users/yangchunjiang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.js',
);

const DEFAULT_DOMAIN = 'hegiw77632.cloud-ip.cc';
const DEFAULT_SSO_NAME = 'codex';
const DEFAULT_WORK_ROLE = '工程';
const DEFAULT_CHROME =
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(SCRIPT_DIR, '..');
const DEFAULT_PROFILE_DIR = resolve(ROOT_DIR, '.browser-profile');

function parseArgs(argv) {
  const args = {
    domain: DEFAULT_DOMAIN,
    ssoName: DEFAULT_SSO_NAME,
    workRole: DEFAULT_WORK_ROLE,
    headless: false,
    requireConfirm: false,
    keepOpen: true,
    persistent: true,
    profileDir: DEFAULT_PROFILE_DIR,
    retries: 2,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--id') args.id = argv[++i];
    else if (arg === '--email') args.email = argv[++i];
    else if (arg === '--domain') args.domain = argv[++i];
    else if (arg === '--sso') args.ssoName = argv[++i];
    else if (arg === '--role') args.workRole = argv[++i];
    else if (arg === '--headless') args.headless = true;
    else if (arg === '--confirm') args.requireConfirm = true;
    else if (arg === '--close') args.keepOpen = false;
    else if (arg === '--no-persistent') args.persistent = false;
    else if (arg === '--profile-dir') args.profileDir = argv[++i];
    else if (arg === '--retries') args.retries = Number(argv[++i]);
    else if (!args.id && !arg.startsWith('--')) args.id = arg;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  if (!args.id) {
    throw new Error('Usage: register-team-account.mjs --id ikun0000002 [--confirm]');
  }
  if (!args.email) args.email = `${args.id}+@${args.domain}`;
  if (!Number.isFinite(args.retries) || args.retries < 0) args.retries = 2;
  return args;
}

async function clearAndFill(locator, text) {
  await locator.click();
  await locator.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
  await locator.press('Backspace');
  await locator.fill(text);
}

async function pressText(page, text) {
  for (const ch of text) {
    if (ch === '@') await page.keyboard.press('Shift+Digit2');
    else if (ch === '+') await page.keyboard.press('Shift+Equal');
    else if (ch === '.') await page.keyboard.press('Period');
    else if (ch === '-') await page.keyboard.press('Minus');
    else await page.keyboard.press(ch);
  }
}

async function clickByText(page, text, timeout = 8000) {
  const target = page.getByText(text, { exact: true });
  await target.waitFor({ state: 'visible', timeout });
  await target.click();
}

async function clickButton(page, name, timeout = 10000) {
  const button = page.getByRole('button', { name, exact: true });
  await button.waitFor({ state: 'visible', timeout });
  await button.click();
}

async function maybeHandleCloudflare(page) {
  await page.waitForTimeout(1000);
  let title = await page.title().catch(() => '');
  let body = await page.locator('body').innerText({ timeout: 2000 }).catch(() => '');
  if (title.includes('请稍候') || body.includes('请稍候')) {
    console.log('');
    console.log('Cloudflare/browser verification is showing.');
    console.log('Complete the visible verification manually in the opened browser.');
    console.log('The script uses a persistent browser profile so this should be remembered next time.');
    const rl = createInterface({ input, output });
    await rl.question('Press Enter after the page reaches the ChatGPT login form...');
    rl.close();
    await page.waitForTimeout(1500);
    title = await page.title().catch(() => '');
    body = await page.locator('body').innerText({ timeout: 2000 }).catch(() => '');
    if (title.includes('请稍候') || body.includes('请稍候')) {
      throw new Error('Cloudflare verification still appears active; complete it manually before retrying.');
    }
  }
}

async function maybeLogout(page) {
  const loginFormVisible = await page
    .getByLabel('电子邮件地址', { exact: true })
    .isVisible({ timeout: 2500 })
    .catch(() => false);
  if (loginFormVisible) return;

  const loggedIn = await page
    .getByText('Alice Inc.', { exact: false })
    .isVisible({ timeout: 3000 })
    .catch(() => false);
  if (!loggedIn) return;

  console.log('Existing ChatGPT session detected; logging out first.');
  const profileButton = page.getByRole('button', {
    name: /打开.*个人资料.*菜单|Alice Inc.*Business/,
  });
  await profileButton.first().click();
  await clickByText(page, '退出登录');
  await clickButton(page, '退出登录');
  await page.waitForURL(/chatgpt\.com\/auth\/login|auth\.openai\.com/, { timeout: 10000 }).catch(() => {});

  const createAccount = page.getByRole('button', { name: '创建帐户', exact: true });
  if (await createAccount.isVisible({ timeout: 3000 }).catch(() => false)) {
    await createAccount.click();
  } else {
    await page.goto('https://chatgpt.com/auth/login', { waitUntil: 'domcontentloaded' });
  }
}

async function enterEmailAndContinue(page, email) {
  const emailInput = page.getByLabel('电子邮件地址', { exact: true });
  await emailInput.waitFor({ state: 'visible', timeout: 20000 });
  try {
    await clearAndFill(emailInput, email);
  } catch {
    await emailInput.click();
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
    await page.keyboard.press('Backspace');
    await pressText(page, email);
  }
  await clickButton(page, '继续');
}

async function chooseSso(page, ssoName) {
  await page.waitForURL(/auth\.openai\.com\/sso/, { timeout: 30000 });
  await clickButton(page, ssoName);
}

async function fillSaml(page, email, id) {
  const emailInput = page.locator('#email');
  const userIdInput = page.locator('#userid');
  await emailInput.waitFor({ state: 'visible', timeout: 30000 });

  try {
    await clearAndFill(emailInput, email);
  } catch {
    await emailInput.click();
    await pressText(page, email);
  }

  try {
    await clearAndFill(userIdInput, id);
  } catch {
    await userIdInput.click();
    await pressText(page, id);
  }
}

async function confirmSubmit(args) {
  if (!args.requireConfirm) return;

  const rl = createInterface({ input, output });
  const expected = `确认提交 ${args.id}`;
  console.log('');
  console.log(`Ready to submit SSO Sign In for ${args.email} / ${args.id}.`);
  console.log('This can create or log in the account.');
  const answer = await rl.question(`Type "${expected}" to submit: `);
  rl.close();
  if (answer.trim() !== expected) {
    throw new Error('Submission not confirmed; leaving the browser at the SSO form.');
  }
}

async function submitSaml(page) {
  const bodyLocator = page.locator('body');
  await clickButton(page, 'Sign In', 10000);
  await Promise.race([
    page.waitForURL(/chatgpt\.com|auth\.openai\.com/, { timeout: 8000 }).catch(() => {}),
    bodyLocator.waitFor({ state: 'visible', timeout: 8000 }).catch(() => {}),
  ]);
  const body = await bodyLocator.innerText({ timeout: 2000 }).catch(() => '');
  if (body.includes('invalid SAML request')) return false;
  return true;
}

async function finishOnboarding(page, workRole) {
  await page.waitForURL(/chatgpt\.com/, { timeout: 60000 }).catch(() => {});
  await page.locator('body').waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});

  const roleButton = page.getByRole('button', { name: workRole, exact: true });
  if (await roleButton.isVisible({ timeout: 4000 }).catch(() => false)) {
    console.log(`Selecting work role: ${workRole}`);
    await roleButton.click();
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
  }

  const later = page.getByRole('button', { name: '稍后再说', exact: true });
  if (await later.isVisible({ timeout: 2500 }).catch(() => false)) {
    await later.click();
    await page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => {});
  }

  const skip = page.getByRole('button', { name: '跳过', exact: true });
  if (await skip.isVisible({ timeout: 2500 }).catch(() => false)) {
    await skip.click();
    await page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => {});
  }
}

async function verifySuccess(page) {
  const text = await page.locator('body').innerText({ timeout: 10000 });
  return (
    page.url().startsWith('https://chatgpt.com/') &&
    text.includes('Alice Inc.') &&
    text.includes('Business') &&
    (text.includes('与 ChatGPT 聊天') || text.includes('今天有什么计划'))
  );
}

async function runOnce(page, args) {
  await page.goto('https://chatgpt.com/auth/login', { waitUntil: 'domcontentloaded' });
  await maybeHandleCloudflare(page);
  await maybeLogout(page);
  await enterEmailAndContinue(page, args.email);
  await chooseSso(page, args.ssoName);
  await fillSaml(page, args.email, args.id);
  await confirmSubmit(args);
  return submitSaml(page);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  console.log(`Registering Team account: ${args.id}`);
  console.log(`Email: ${args.email}`);

  await mkdir(args.profileDir, { recursive: true });
  const context = args.persistent
    ? await chromium.launchPersistentContext(args.profileDir, {
        headless: args.headless,
        executablePath: DEFAULT_CHROME,
        args: ['--no-sandbox'],
        viewport: { width: 1280, height: 900 },
      })
    : await chromium
        .launch({
          headless: args.headless,
          executablePath: DEFAULT_CHROME,
          args: ['--no-sandbox'],
        })
        .then((browser) => browser.newContext({ viewport: { width: 1280, height: 900 } }));
  const page = context.pages()[0] || (await context.newPage());

  try {
    let submitted = false;
    for (let attempt = 1; attempt <= args.retries + 1; attempt += 1) {
      console.log(`Attempt ${attempt}/${args.retries + 1}`);
      submitted = await runOnce(page, args);
      if (submitted) break;
      console.log('SAML request expired; retrying with a fresh SSO request.');
    }

    if (!submitted) throw new Error('Could not submit a valid SAML request.');

    await finishOnboarding(page, args.workRole);
    const ok = await verifySuccess(page);
    if (!ok) {
      console.log('Reached ChatGPT, but final workspace verification was inconclusive.');
      console.log(`Current URL: ${page.url()}`);
      return;
    }

    console.log(`Success: ${args.id} is logged into ChatGPT Alice Inc. Business.`);
  } finally {
    if (!args.keepOpen) await context.close();
    else console.log('Browser left open for inspection. Use --close to close automatically.');
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
