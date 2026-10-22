import { chromium } from 'playwright';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { deflateSync } from 'node:zlib';

const ADMIN_URL = process.env.DENTAL_E2E_ADMIN_URL || 'https://al-asas-dental-staging.web.app/admin/settings';
const WORKER_URL = (process.env.DENTAL_E2E_WORKER_URL || 'https://alasas-dental-staging-worker.coffee101.workers.dev').replace(/\/$/, '');
const PROJECT_ID = 'al-asas-dental-staging';
const REPOSITORY = 'NAJF8/al-asas-assets';
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const STORAGE_STATE = process.env.DENTAL_E2E_STORAGE_STATE;
const FIREBASE_CONFIG = { apiKey: 'AIzaSyDO4QHtOT0HQ-t7CgbdwDfgTuYPni23Vxc', authDomain: 'al-asas-dental-staging.firebaseapp.com', projectId: PROJECT_ID, appId: '1:915871985225:web:8b3c1995b47e0364df9998' };
const results = new Map();

const report = (name, status, detail = '') => {
  results.set(name, { status, detail });
  console.log(`${name}=${status}${detail ? ` :: ${detail}` : ''}`);
};

const requireOutsideWorkspace = (pathValue) => {
  if (!pathValue) return null;
  const path = resolve(pathValue);
  const workspace = resolve(process.cwd());
  if (path === workspace || path.startsWith(`${workspace}${process.platform === 'win32' ? '\\' : '/'}`)) {
    throw new Error('DENTAL_E2E_STORAGE_STATE must be outside the repository/workspace.');
  }
  return path;
};

const crc32 = (bytes) => {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
};

const pngChunk = (type, data) => {
  const typeBytes = Buffer.from(type);
  const size = Buffer.alloc(4); size.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4); checksum.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])));
  return Buffer.concat([size, typeBytes, data, checksum]);
};

const makePng = (red, green, blue) => {
  const signature = Buffer.from('89504e470d0a1a0a', 'hex');
  const header = Buffer.alloc(13); header.writeUInt32BE(1, 0); header.writeUInt32BE(1, 4); header[8] = 8; header[9] = 2;
  const pixels = deflateSync(Buffer.from([0, red, green, blue]));
  return Buffer.concat([signature, pngChunk('IHDR', header), pngChunk('IDAT', pixels), pngChunk('IEND', Buffer.alloc(0))]);
};

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const json = async (response) => { try { return await response.json(); } catch { return {}; } };

const workerRequest = async (path, init = {}) => fetch(`${WORKER_URL}${path}`, { ...init, headers: { Accept: 'application/json', ...(init.headers || {}) } });

const testUnauthenticated = async () => {
  const noToken = await workerRequest('/api/public-media');
  report('PATIENT_STUDENT_DENIAL', noToken.status === 401 ? 'PARTIAL' : 'FAIL', `unauthenticated=${noToken.status} (patient/student tokens are checked when supplied)`);
  const invalid = await workerRequest('/api/public-media', { headers: { Authorization: 'Bearer synthetic.invalid.token' } });
  report('INVALID_TOKEN_DENIAL', invalid.status === 401 ? 'PASS' : 'FAIL', `status=${invalid.status}`);
  for (const [name, envName] of [['PATIENT_DENIAL', 'DENTAL_E2E_PATIENT_ID_TOKEN'], ['STUDENT_DENIAL', 'DENTAL_E2E_STUDENT_ID_TOKEN']]) {
    const token = process.env[envName];
    if (!token) { report(name, 'NOT_VERIFIED', `${envName} not provided`); continue; }
    const response = await workerRequest('/api/public-media', { headers: { Authorization: `Bearer ${token}` } });
    report(name, response.status === 403 ? 'PASS' : 'FAIL', `status=${response.status}`);
  }
};

const githubReadback = async (publicUrl, expectedBytes, expectedStatus = 200) => {
  const parsed = new URL(publicUrl);
  const [, owner, repo, ref, ...pathParts] = parsed.pathname.split('/');
  const path = pathParts.join('/');
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${encodeURIComponent(ref)}`, { headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'alasas-dental-public-media-e2e' } });
  if (expectedStatus === 404) return response.status === 404;
  if (response.status !== expectedStatus) return false;
  const body = await response.json();
  const actual = Buffer.from(String(body.content || '').replace(/\s/g, ''), 'base64');
  return sha256(actual) === sha256(expectedBytes);
};

const firestoreRequest = async (token, path, init = {}) => fetch(`${FIRESTORE_BASE}${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers || {}) } });

const setTemporaryBrandingReference = async (token, value) => {
  const list = await firestoreRequest(token, '/branding_settings?pageSize=10');
  if (!list.ok) throw new Error(`branding read failed (${list.status})`);
  const body = await list.json();
  const document = body.documents?.[0];
  if (!document?.name) throw new Error('no branding_settings document available');
  const name = document.name.split('/documents/')[1];
  const fieldPath = encodeURIComponent('e2e_test_media_url');
  const patch = await firestoreRequest(token, `/${name}?updateMask.fieldPaths=${fieldPath}`, { method: 'PATCH', body: JSON.stringify({ fields: { e2e_test_media_url: { stringValue: value } } }) });
  if (!patch.ok) throw new Error(`branding test reference write failed (${patch.status})`);
  return { name, hadOriginal: Boolean(document.fields?.e2e_test_media_url), original: document.fields?.e2e_test_media_url };
};

const clearTemporaryBrandingReference = async (token, reference) => {
  if (!reference) return;
  const fieldPath = encodeURIComponent('e2e_test_media_url');
  const fields = reference.hadOriginal ? { e2e_test_media_url: reference.original } : {};
  const response = await firestoreRequest(token, `/${reference.name}?updateMask.fieldPaths=${fieldPath}`, { method: 'PATCH', body: JSON.stringify({ fields }) });
  if (!response.ok) throw new Error(`branding test reference cleanup failed (${response.status})`);
};

const runAuthenticatedFlow = async (context, tempDir) => {
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  let firebaseToken = null;
  const workerResponses = [];
  page.on('request', (request) => {
    if (request.url().startsWith(WORKER_URL)) {
      const authorization = request.headers().authorization;
      if (authorization?.startsWith('Bearer ')) firebaseToken = authorization.slice('Bearer '.length);
    }
  });
  page.on('response', async (response) => {
    if (response.url() === `${WORKER_URL}/api/public-media` && response.request().method() === 'POST') workerResponses.push({ status: response.status(), body: await json(response) });
  });
  await page.goto(ADMIN_URL, { waitUntil: 'domcontentloaded' });
  // Firestore listeners keep network connections open; networkidle is not a
  // truthful readiness signal for this app and can time out after valid auth.
  await page.waitForLoadState('domcontentloaded').catch(() => undefined);
  const loginButton = page.getByRole('button', { name: 'تسجيل الدخول باستخدام Google' });
  const email = process.env.DENTAL_E2E_ADMIN_EMAIL;
  const password = process.env.DENTAL_E2E_ADMIN_PASSWORD;
  if (email && password) {
      // Wait for the Admin app's modular Auth persistence setup to finish
      // before the trusted compat sign-in writes the browser session.
      await loginButton.waitFor({ state: 'visible' });
      await page.waitForTimeout(1000);
      await page.addScriptTag({ url: 'https://www.gstatic.com/firebasejs/11.0.2/firebase-app-compat.js' });
      await page.addScriptTag({ url: 'https://www.gstatic.com/firebasejs/11.0.2/firebase-auth-compat.js' });
      await page.evaluate(async ({ config, email: address, password: secret }) => {
        const app = window.firebase.apps.length ? window.firebase.app() : window.firebase.initializeApp(config);
        await app.auth().setPersistence(window.firebase.auth.Auth.Persistence.LOCAL);
        await app.auth().signInWithEmailAndPassword(address, secret);
      }, { config: FIREBASE_CONFIG, email, password });
      console.log(`AUTOMATED_AUTH=PASS :: Firebase Email/Password sign-in completed uid=${await page.evaluate(() => window.firebase.auth().currentUser?.uid || 'missing')}`);
      // Allow the browser persistence write and the app's auth observer to
      // settle before navigation; otherwise a fast reload can race Firebase.
      await page.waitForTimeout(1500);
      await page.goto(ADMIN_URL, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1500);
      console.log(`AUTOMATED_AUTH_STATE :: url=${page.url()} login_button=${await loginButton.count()}`);
  } else if (page.url().includes('/admin/login') || await loginButton.count()) {
      if (process.env.DENTAL_E2E_HEADLESS === '1') throw new Error('Admin session is missing; provide approved Email/Password test secrets or a storage state.');
      await loginButton.click();
      await page.waitForURL(/\/admin\/(?!login)/, { timeout: 180000 });
  }
  await page.goto(ADMIN_URL, { waitUntil: 'domcontentloaded' });
  if (await page.getByRole('button', { name: 'تسجيل الدخول باستخدام Google' }).count()) throw new Error('Admin session did not reach the authenticated dashboard.');
  await page.getByRole('heading', { name: 'الإعدادات', exact: true }).waitFor();
  await page.getByRole('button', { name: 'الصور والشعارات', exact: true }).click();
  await page.getByRole('heading', { name: 'مكتبة الأصول العامة' }).waitFor();
  const first = join(tempDir, 'dental-media-test.png');
  const second = join(tempDir, 'dental-media-test-replacement.png');
  await writeFile(first, makePng(12, 96, 180));
  await writeFile(second, makePng(220, 64, 48));
  const input = page.locator('input[type="file"]').first();
  const uploadResponse = page.waitForResponse((response) => response.url() === `${WORKER_URL}/api/public-media` && response.request().method() === 'POST');
  await input.setInputFiles(first);
  const upload = await uploadResponse;
  const uploadBody = await json(upload);
  if (upload.status() !== 201 || !uploadBody.media_id || !uploadBody.public_url) throw new Error(`upload failed (${upload.status()}) ${uploadBody.error || ''}`);
  report('WORKER_AUTHENTICATED_REQUEST', 'PASS', `status=${upload.status()} media_id_present=true`);
  report('PLAYWRIGHT_UPLOAD', 'PASS', 'setInputFiles completed and Worker returned a media id');
  const uploadedBytes = await readFile(first);
  report('GITHUB_CONTENTS_WRITE', await githubReadback(uploadBody.public_url, uploadedBytes) ? 'PASS' : 'FAIL', 'public Contents readback and byte hash checked');
  const preview = page.locator('img.settings-image-preview').first();
  await preview.waitFor({ state: 'visible' });
  report('MEDIA_PREVIEW', (await preview.getAttribute('src'))?.startsWith(uploadBody.public_url) ? 'PASS' : 'FAIL');
  // Upload updates the branding preview immediately, while the media library
  // list is refreshed from Firestore on mount. Reload before selecting the
  // replacement input so the new asset is present in the library DOM.
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'الإعدادات', exact: true }).waitFor();
  await page.getByRole('button', { name: 'الصور والشعارات', exact: true }).click();
  await page.getByRole('heading', { name: 'مكتبة الأصول العامة' }).waitFor();
  const article = page.locator('article').filter({ has: page.locator('img[src^="https://raw.githubusercontent.com/"]') }).last();
  const replaceInput = article.locator('input[type="file"]');
  const replaceResponse = page.waitForResponse((response) => response.url() === `${WORKER_URL}/api/public-media` && response.request().method() === 'POST');
  await replaceInput.setInputFiles(second);
  const replacement = await replaceResponse;
  const replacementBody = await json(replacement);
  if (replacement.status() !== 200 || replacementBody.media_id !== uploadBody.media_id || !replacementBody.public_url) throw new Error(`replace failed (${replacement.status()})`);
  report('MEDIA_REPLACE', 'PASS', `status=${replacement.status()} same_media_id=true`);
  const replacementBytes = await readFile(second);
  report('GITHUB_REPLACE_READBACK', await githubReadback(replacementBody.public_url, replacementBytes) ? 'PASS' : 'FAIL');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'الإعدادات', exact: true }).waitFor();
  await page.getByRole('button', { name: 'الصور والشعارات', exact: true }).click();
  await page.getByRole('heading', { name: 'مكتبة الأصول العامة' }).waitFor();
  const currentArticle = page.locator('article').filter({ hasText: 'image/png' }).last();
  const deleteButton = currentArticle.getByRole('button', { name: 'حذف', exact: true });
  let temporaryReference = null;
  try {
    if (!firebaseToken) throw new Error('Firebase token was not observed from the authenticated Admin session.');
    temporaryReference = await setTemporaryBrandingReference(firebaseToken, replacementBody.public_url);
    page.once('dialog', (dialog) => dialog.accept());
    const protectedResponse = page.waitForResponse((response) => response.url() === `${WORKER_URL}/api/public-media` && response.request().method() === 'POST');
    await deleteButton.click();
    const protectedResult = await protectedResponse;
    const protectedBody = await json(protectedResult);
    report('PROTECTED_ASSET_DELETE', protectedResult.status() === 409 && protectedBody.error === 'MEDIA_IN_USE' ? 'PASS' : 'FAIL', `status=${protectedResult.status()} code=${protectedBody.error || 'unknown'}`);
  } catch (error) {
    report('PROTECTED_ASSET_DELETE', 'BLOCKED', error instanceof Error ? error.message : String(error));
  } finally {
    try { await clearTemporaryBrandingReference(firebaseToken, temporaryReference); } catch (error) { report('PROTECTED_ASSET_CLEANUP', 'FAIL', error instanceof Error ? error.message : String(error)); }
  }
  const finalArticle = page.locator('article').filter({ hasText: 'image/png' }).last();
  page.once('dialog', (dialog) => dialog.accept());
  const deleteResponse = page.waitForResponse((response) => response.url() === `${WORKER_URL}/api/public-media` && response.request().method() === 'POST');
  await finalArticle.getByRole('button', { name: 'حذف', exact: true }).click();
  const deleted = await deleteResponse;
  const deletedBody = await json(deleted);
  report('MEDIA_DELETE', deleted.status() === 200 && deletedBody.ok === true ? 'PASS' : 'FAIL', `status=${deleted.status()}`);
  report('GITHUB_CONTENTS_DELETE_READBACK', await githubReadback(replacementBody.public_url, replacementBytes, 404) ? 'PASS' : 'FAIL');
};

const main = async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'alasas-dental-public-media-'));
  let context;
  try {
    await testUnauthenticated();
    const statePath = requireOutsideWorkspace(STORAGE_STATE);
    const browserOptions = { headless: process.env.DENTAL_E2E_HEADLESS === '1' };
    if (statePath) browserOptions.storageState = statePath;
    context = await chromium.launchPersistentContext(join(tempDir, 'browser'), browserOptions);
    await runAuthenticatedFlow(context, tempDir);
    if (statePath) await context.storageState({ path: statePath });
    report('ADMIN_TEST_AUTH', 'PASS', 'authenticated Admin session reached settings');
  } catch (error) {
    const contextDetail = context ? ` pages=${(await Promise.all(context.pages().map(async (item) => `${item.url()} body=${(await item.locator('body').innerText().catch(() => '')).slice(0, 180)}`))).join(' | ')}` : '';
    report('ADMIN_TEST_AUTH', 'BLOCKED', `${error instanceof Error ? error.message : String(error)}${contextDetail}`);
  } finally {
    await context?.close();
    await rm(tempDir, { recursive: true, force: true });
  }
  const failed = [...results.values()].filter(({ status }) => ['FAIL', 'BLOCKED', 'NOT_VERIFIED'].includes(status));
  process.exitCode = failed.length ? 2 : 0;
};

await main();
