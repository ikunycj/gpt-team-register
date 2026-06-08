#!/usr/bin/env node
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const proc = globalThis.process;
const env = proc?.env || {};
const platform = proc?.platform || '';
const stdin = proc?.stdin;
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(SCRIPT_DIR, '..');
const SESSION_DIR = resolve(ROOT_DIR, 'chatgpt_sessions');
const DEFAULT_PROFILE_DIR = resolve(ROOT_DIR, '.browser-profile');
const CHATGPT_BASE = 'https://chatgpt.com';

function usage() {
  return [
    'Usage:',
    '  fetch-json-save.mjs --email <name@example.com> [--profile-dir .browser-profile]',
    '  fetch-json-save.mjs --save-chatgpt-session --email <name@example.com> [--profile-dir .browser-profile]',
    '  fetch-json-save.mjs --email <name@example.com> --session-json-file <auth-session.json>',
    '  fetch-json-save.mjs --email <name@example.com> --session-json-stdin',
  ].join('\n');
}

function parseArgs(argv) {
  const args = {
    pretty: true,
    mode: 'chatgpt-session',
    profileDir: DEFAULT_PROFILE_DIR,
    close: true,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') args.help = true;
    else if (arg === '--email') args.email = argv[++i];
    else if (arg === '--output-dir') args.outputDir = argv[++i];
    else if (arg === '--mode') args.mode = argv[++i];
    else if (arg === '--save-chatgpt-session') args.mode = 'chatgpt-session';
    else if (arg === '--profile-dir') args.profileDir = argv[++i];
    else if (arg === '--storage-state') args.storageState = argv[++i];
    else if (arg === '--session-json') args.sessionJson = argv[++i];
    else if (arg === '--session-json-file') args.sessionJsonFile = argv[++i];
    else if (arg === '--session-json-stdin') args.sessionJsonStdin = true;
    else if (arg === '--password') args.password = argv[++i];
    else if (arg === '--name') args.name = argv[++i];
    else if (arg === '--birthdate') args.birthdate = argv[++i];
    else if (arg === '--chrome-path') args.chromePath = argv[++i];
    else if (arg === '--keep-open') args.close = false;
    else if (arg === '--compact') args.pretty = false;
    else if (!args.email && !arg.startsWith('--')) args.email = arg;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  if (args.help) return args;
  if (args.mode !== 'chatgpt-session') {
    throw new Error(`Unsupported mode: ${args.mode}`);
  }

  if (!args.email) {
    throw new Error(usage());
  }

  return args;
}

function loadPlaywright() {
  const candidates = [
    env.PLAYWRIGHT_PACKAGE_PATH,
    'playwright',
  ].filter(Boolean);

  if (env.NODE_PATH) {
    for (const base of env.NODE_PATH.split(platform === 'win32' ? ';' : ':').filter(Boolean)) {
      candidates.push(resolve(base, 'playwright'));
      candidates.push(resolve(base, 'playwright/index.js'));
    }
  }

  const runtimeDir = env.CODEX_RUNTIME_NODE_DIR;
  if (runtimeDir) {
    candidates.push(resolve(runtimeDir, 'node_modules/playwright'));
    candidates.push(resolve(runtimeDir, 'node_modules/playwright/index.js'));
  }

  let lastError;
  for (const candidate of candidates) {
    try {
      return require(candidate);
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(
    `Unable to load Playwright. Set PLAYWRIGHT_PACKAGE_PATH, NODE_PATH, or install the "playwright" package. Last error: ${lastError?.message || 'unknown'}`,
  );
}

async function pathExists(target) {
  if (!target) return false;
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

async function resolveChromePath(explicitPath) {
  if (explicitPath) return explicitPath;

  const candidates = [
    env.CHROME_PATH,
    env.GOOGLE_CHROME_BIN,
    platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : '',
    platform === 'linux' ? '/usr/bin/google-chrome' : '',
    platform === 'linux' ? '/usr/bin/google-chrome-stable' : '',
    platform === 'linux' ? '/snap/bin/chromium' : '',
    platform === 'win32' ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' : '',
    platform === 'win32' ? 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe' : '',
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (await pathExists(candidate)) return candidate;
  }

  return '';
}

function safeCacheName(email) {
  return String(email || '').trim().toLowerCase().replace(/[^A-Za-z0-9_.@-]+/g, '_');
}

function normalizeCookie(cookie) {
  if (!cookie || typeof cookie !== 'object') return null;
  const name = String(cookie.name || '').trim();
  const value = String(cookie.value || '');
  const domain = String(cookie.domain || '');
  const path = String(cookie.path || '/');
  if (!name || !domain) return null;
  return { name, value, domain, path };
}

function importCookieJar(context, cookies) {
  const normalized = (cookies || []).map(normalizeCookie).filter(Boolean);
  return normalized.length ? context.addCookies(normalized).then(() => normalized.length) : Promise.resolve(0);
}

async function exportCookieJar(context) {
  return (await context.cookies()).map((cookie) => ({
    name: String(cookie.name || ''),
    value: String(cookie.value || ''),
    domain: String(cookie.domain || ''),
    path: String(cookie.path || '/'),
  }));
}

async function fetchChatgptSessionAccessToken(context) {
  const url = `${CHATGPT_BASE}/api/auth/session`;
  let lastError = '';

  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      const response = await context.request.get(url, {
        headers: {
          Accept: 'application/json',
          Referer: `${CHATGPT_BASE}/`,
        },
        timeout: 30000,
      });

      if (response.status() === 200) {
        const data = await response.json();
        const accessToken = String(data?.accessToken || '').trim();
        if (accessToken) {
          return {
            ok: true,
            data: {
              access_token: accessToken,
              session_token: String(data?.sessionToken || '').trim(),
              raw_session: data,
            },
          };
        }
        lastError = 'api/auth/session missing accessToken';
      } else {
        lastError = `api/auth/session HTTP ${response.status()}`;
      }
    } catch (error) {
      lastError = `${error?.constructor?.name || 'Error'}: ${error?.message || String(error)}`;
    }

    await context.request
      .get(`${CHATGPT_BASE}/`, {
        headers: {
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          Referer: `${CHATGPT_BASE}/`,
          'Upgrade-Insecure-Requests': '1',
        },
        timeout: 30000,
      })
      .catch(() => {});
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 1200));
  }

  return { ok: false, error: lastError };
}

async function loadStorageStateCookies(storageStatePath) {
  const data = JSON.parse(await readFile(storageStatePath, 'utf8'));
  return Array.isArray(data?.cookies) ? data.cookies : [];
}

async function readStdinText() {
  if (!stdin) throw new Error('stdin is not available in this runtime');
  let text = '';
  stdin.setEncoding('utf8');
  for await (const chunk of stdin) text += chunk;
  return text;
}

async function loadSessionJson(args) {
  if (args.sessionJson) return JSON.parse(args.sessionJson);
  if (args.sessionJsonFile) return JSON.parse(await readFile(args.sessionJsonFile, 'utf8'));
  if (args.sessionJsonStdin) return JSON.parse(await readStdinText());
  return null;
}

async function openBrowserContext(args) {
  const { chromium } = loadPlaywright();
  const chromePath = await resolveChromePath(args.chromePath);
  const launchOptions = {
    headless: true,
    args: ['--no-sandbox'],
  };
  if (chromePath) launchOptions.executablePath = chromePath;

  await mkdir(args.profileDir, { recursive: true });
  const context = await chromium.launchPersistentContext(args.profileDir, launchOptions);
  return { context, chromePath };
}

export async function saveChatgptSessionCacheFromContext(context, options) {
  const outputDir = resolve(options.outputDir || SESSION_DIR);
  const outputPath = resolve(outputDir, `${safeCacheName(options.email)}.json`);
  let imported = 0;
  if (options.storageState) {
    imported = await importCookieJar(context, await loadStorageStateCookies(options.storageState));
  }

  const accessResult = await fetchChatgptSessionAccessToken(context);
  if (!accessResult.ok) {
    throw new Error(`failed to get access token: ${accessResult.error}`);
  }

  const data = {
    email: options.email,
    saved_at: new Date().toISOString(),
    chatgpt_password: String(options.password || ''),
    name: String(options.name || ''),
    birthdate: String(options.birthdate || ''),
    access_token: accessResult.data.access_token,
    session_token: accessResult.data.session_token,
    cookies: await exportCookieJar(context),
  };

  await mkdir(outputDir, { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(data, null, options.pretty === false ? 0 : 2)}\n`, 'utf8');
  return { path: outputPath, cookies: data.cookies.length, imported };
}

export async function saveChatgptSessionCacheFromAuthSession(authSession, options) {
  const accessToken = String(authSession?.accessToken || '').trim();
  if (!accessToken) {
    throw new Error('session JSON missing accessToken');
  }

  const outputDir = resolve(options.outputDir || SESSION_DIR);
  const outputPath = resolve(outputDir, `${safeCacheName(options.email)}.json`);
  const data = {
    email: options.email,
    saved_at: new Date().toISOString(),
    chatgpt_password: String(options.password || ''),
    name: String(options.name || ''),
    birthdate: String(options.birthdate || ''),
    access_token: accessToken,
    session_token: String(authSession?.sessionToken || '').trim(),
    cookies: Array.isArray(options.cookies) ? options.cookies.map(normalizeCookie).filter(Boolean) : [],
    raw_session: authSession,
  };

  await mkdir(outputDir, { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(data, null, options.pretty === false ? 0 : 2)}\n`, 'utf8');
  return { path: outputPath, cookies: data.cookies.length, imported: 0 };
}

async function saveChatgptSessionCache(args) {
  const authSession = await loadSessionJson(args);
  if (authSession) {
    const result = await saveChatgptSessionCacheFromAuthSession(authSession, args);
    console.log(`Saved ChatGPT session cache to ${result.path}`);
    console.log(`Cookies: ${result.cookies}`);
    return;
  }

  let context;
  try {
    const opened = await openBrowserContext(args);
    context = opened.context;
    const result = await saveChatgptSessionCacheFromContext(context, args);
    console.log(`Saved ChatGPT session cache to ${result.path}`);
    console.log(`Cookies: ${result.cookies}${result.imported ? ` (${result.imported} imported from storage state)` : ''}`);
  } finally {
    if (context && args.close) await context.close();
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }
  await saveChatgptSessionCache(args);
}

if (proc?.argv?.[1] && resolve(proc.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
