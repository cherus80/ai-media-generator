#!/usr/bin/env node
/**
 * Capture production UI screenshots with a doc user account.
 *
 * Output is LOCAL-ONLY by default: output/playwright/<run-id>/ (gitignored).
 * Credentials are read from --creds-file or DOC_USER_EMAIL/DOC_USER_PASSWORD env vars.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const raw = argv[i];
    if (!raw.startsWith('--')) continue;
    const key = raw.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
    } else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
}

async function mkdirp(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function loadCreds({ credsFile }) {
  const envEmail = process.env.DOC_USER_EMAIL;
  const envPassword = process.env.DOC_USER_PASSWORD;
  if (envEmail && envPassword) {
    return { email: envEmail, password: envPassword };
  }

  const filePath = credsFile || 'tmp/doc_user_prod.json';
  const raw = await fs.readFile(filePath, 'utf-8');
  const data = JSON.parse(raw);
  if (!data.email || !data.password) {
    throw new Error(`Invalid creds file: ${filePath} (expected {email,password})`);
  }
  return { email: data.email, password: data.password };
}

function isoRunId() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

async function bestEffortNetworkIdle(page) {
  try {
    await page.waitForLoadState('networkidle', { timeout: 10_000 });
  } catch {
    // ignore
  }
}

async function safeGoto(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await bestEffortNetworkIdle(page);
  await page.waitForTimeout(300);
}

async function main() {
  const args = parseArgs(process.argv);
  const baseUrl = args['base-url'] || process.env.DOCS_BASE_URL || 'https://ai-generator.mix4.ru';
  const headed = Boolean(args.headed);
  const credsFile = args['creds-file'];
  const userPhotoPath = args['user-photo'] || process.env.DOCS_USER_PHOTO;
  const itemPhotoPath = args['item-photo'] || process.env.DOCS_ITEM_PHOTO;
  const fittingZone = (args.zone || process.env.DOCS_FITTING_ZONE || 'legs').toString();
  const doGenerate = Boolean(args.generate) || process.env.DOCS_DO_GENERATE === '1';
  const runId = args['run-id'] || isoRunId();
  const outDir = args['out-dir'] || path.join('output', 'playwright', `prod-${runId}`);

  const { email, password } = await loadCreds({ credsFile });

  await mkdirp(outDir);

  const browser = await chromium.launch({ headless: !headed });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });

  // Hide cookie banner + reduce UI jitter
  await context.addInitScript(() => {
    try {
      window.localStorage.setItem('cookie-consent', 'accepted');
    } catch {
      // ignore
    }
  });

  const page = await context.newPage();

  const shots = [];
  async function shot(name) {
    const file = path.join(outDir, `${name}.png`);
    await page.screenshot({ path: file, fullPage: true });
    shots.push({ name, file, url: page.url() });
  }

  async function uploadInCurrentStep(filePath) {
    if (!filePath) {
      throw new Error('Missing file path for upload step. Provide --user-photo/--item-photo.');
    }
    const absolute = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
    // react-dropzone renders a hidden input[type=file]
    const input = page.locator('input[type="file"]').first();
    await input.setInputFiles(absolute);
    // Wait for preview image to appear
    await page.locator('img[alt="Предпросмотр"]').first().waitFor({ timeout: 60_000 });
  }

  async function clickByText(text) {
    const button = page.getByRole('button', { name: text }).first();
    await button.click();
  }

  // Public pages
  await safeGoto(page, new URL('/', baseUrl).toString());
  await shot('00-landing');

  await safeGoto(page, new URL('/pricing', baseUrl).toString());
  await shot('01-pricing');

  await safeGoto(page, new URL('/register', baseUrl).toString());
  await shot('02-register');

  // Login
  await safeGoto(page, new URL('/login?next=%2Fapp', baseUrl).toString());
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);

  // Consent checkbox is required for login
  const consent = page.locator('#pd-consent-login');
  if (await consent.count()) {
    await consent.check({ force: true });
  }

  await shot('10-login-filled');

  // Submit login form
  await page.locator('form button[type="submit"]').first().click();
  await page.waitForURL(/\/app|\/verify-required/, { timeout: 60_000 });
  await bestEffortNetworkIdle(page);
  await shot('11-app-home');

  // App sections
  const routes = [
    ['12-app-instructions', '/app/instructions'],
    ['13-app-examples', '/app/examples'],
    ['14-app-about', '/app/about'],
    ['20-fitting', '/fitting'],
    ['21-editing', '/editing'],
    ['30-profile', '/profile'],
    ['31-history', '/history'],
    ['32-notifications', '/notifications'],
  ];

  for (const [name, route] of routes) {
    await safeGoto(page, new URL(route, baseUrl).toString());
    await shot(name);
  }

  // Optional: full try-on flow with real generation (costs 2 ⭐)
  if (doGenerate) {
    await safeGoto(page, new URL('/fitting', baseUrl).toString());
    await shot('40-tryon-step1-empty');

    await uploadInCurrentStep(userPhotoPath);
    await shot('41-tryon-step1-user-photo');
    await clickByText('Далее →');
    await page.getByText('Шаг 2:').first().waitFor({ timeout: 60_000 });
    await bestEffortNetworkIdle(page);
    await shot('42-tryon-step2-empty');

    await uploadInCurrentStep(itemPhotoPath);
    await shot('43-tryon-step2-item-photo');
    await clickByText('Далее →');
    await page.getByText('Шаг 3:').first().waitFor({ timeout: 60_000 });
    await bestEffortNetworkIdle(page);
    await shot('44-tryon-step3-zone');

    // Select zone if present in UI
    const zoneToLabel = new Map([
      ['head', 'Голова'],
      ['face', 'Лицо'],
      ['neck', 'Шея'],
      ['hands', 'Руки'],
      ['legs', 'Ноги'],
      ['body', 'Всё тело'],
    ]);
    const zoneLabel = zoneToLabel.get(fittingZone) || 'Ноги';
    await page.getByRole('button', { name: new RegExp(zoneLabel, 'i') }).first().click();
    await page.waitForTimeout(300);
    await shot('45-tryon-step3-zone-selected');

    await page.getByRole('button', { name: /Примерить/i }).first().click();
    await page.waitForTimeout(500);
    await shot('46-tryon-generating');

    // Wait for result (success or failure)
    await page
      .getByRole('heading', { name: /Ваша примерка готова|Произошла ошибка/i })
      .first()
      .waitFor({ timeout: 180_000 });
    await bestEffortNetworkIdle(page);
    await shot('47-tryon-result');
  }

  const manifest = {
    base_url: baseUrl,
    run_id: runId,
    created_at: new Date().toISOString(),
    doc_user_email: email,
    tryon: doGenerate
      ? {
          user_photo: userPhotoPath || null,
          item_photo: itemPhotoPath || null,
          zone: fittingZone,
        }
      : null,
    screenshots: shots,
  };

  await fs.writeFile(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf-8');

  await browser.close();

  process.stdout.write(`OK: ${outDir}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
