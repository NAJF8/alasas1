// @ts-nocheck
import { scrypt as nodeScrypt } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(nodeScrypt);
type Env = { FIREBASE_PROJECT_ID: string; FIREBASE_SERVICE_ACCOUNT_JSON?: string; ALLOWED_ORIGINS?: string; RELEASE_SHA?: string; MEDICAL_IMAGES?: R2Bucket; GITHUB_ASSET_REPOSITORY?: string; GITHUB_APP_ID?: string; GITHUB_INSTALLATION_ID?: string; GITHUB_PRIVATE_KEY?: string; PUBLIC_MEDIA_MAX_BYTES?: string };
type Claims = { sub: string; aud: string; iss: string; exp: number; email?: string };
type Doc = { name: string; fields?: Record<string, any>; updateTime?: string };
type Write = { update?: { name: string; fields: Record<string, any> }; updateMask?: { fieldPaths: string[] }; delete?: string; currentDocument?: { exists?: boolean; updateTime?: string } };
type ApiError = Error & { status?: number; code?: string };

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...headers } });
const error = (code: string, status = 400): never => { const e = new Error(code) as ApiError; e.code = code; e.status = status; throw e; };
const iso = () => new Date().toISOString();
const id = () => crypto.randomUUID();
const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
const unb64 = (value: string) => Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4)), (c) => c.charCodeAt(0));
const decode = (value: string) => JSON.parse(new TextDecoder().decode(unb64(value))) as Record<string, any>;
const fs = (value: any): any => value === null || value === undefined ? { nullValue: null } : typeof value === 'boolean' ? { booleanValue: value } : typeof value === 'number' && Number.isInteger(value) ? { integerValue: String(value) } : typeof value === 'number' ? { doubleValue: value } : typeof value === 'string' ? { stringValue: value } : Array.isArray(value) ? { arrayValue: { values: value.map(fs) } } : { mapValue: { fields: Object.fromEntries(Object.entries(value).map(([k, v]) => [k, fs(v)])) } };
const unfs = (v: any): any => !v ? null : 'nullValue' in v ? null : 'stringValue' in v ? v.stringValue : 'booleanValue' in v ? v.booleanValue : 'integerValue' in v ? Number(v.integerValue) : 'doubleValue' in v ? v.doubleValue : 'timestampValue' in v ? v.timestampValue : 'arrayValue' in v ? (v.arrayValue.values || []).map(unfs) : 'mapValue' in v ? Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, unfs(x)])) : null;
const fromDoc = (doc: Doc | null) => doc ? { id: doc.name.split('/').pop(), ...Object.fromEntries(Object.entries(doc.fields || {}).map(([k, v]) => [k, unfs(v)])) } : null;
const encodePath = (path: string) => path.split('/').map(encodeURIComponent).join('/');
const cors = (request: Request, env: Env) => { const origin = request.headers.get('Origin') || ''; const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((x) => x.trim()); return { 'access-control-allow-origin': allowed.includes(origin) ? origin : 'null', 'access-control-allow-headers': 'Authorization,Content-Type,Idempotency-Key,x-file-size,x-file-name', 'access-control-allow-methods': 'GET,POST,DELETE,OPTIONS', vary: 'Origin' }; };
const tokenFrom = (request: Request) => { const value = request.headers.get('Authorization') || ''; return value.startsWith('Bearer ') ? value.slice(7) : null; };

const rateBuckets = new Map<string, { count: number; resetAt: number }>();
const checkRateLimit = (request: Request, bucket: string, maxRequests = 40, windowMs = 60_000) => {
  const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'local';
  const key = `${bucket}:${ip}`;
  const now = Date.now();
  const entry = rateBuckets.get(key);
  if (!entry || entry.resetAt <= now) {
    rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  entry.count += 1;
  if (entry.count > maxRequests) error('RATE_LIMITED', 429);
};

const verifyIdToken = async (request: Request, env: Env): Promise<Claims> => {
  const raw = tokenFrom(request);
  if (!raw) error('AUTH_REQUIRED', 401);
  const parts = raw.split('.');
  if (parts.length !== 3) error('INVALID_TOKEN', 401);
  try {
    const header = decode(parts[0]);
    const claims = decode(parts[1]) as Claims;
    if (header.alg !== 'RS256' || !header.kid || claims.aud !== env.FIREBASE_PROJECT_ID || claims.iss !== `https://securetoken.google.com/${env.FIREBASE_PROJECT_ID}` || !claims.sub || claims.exp * 1000 <= Date.now()) error('INVALID_TOKEN', 401);
    const keysResponse = await fetch('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com');
    if (!keysResponse.ok) error('TOKEN_KEYS_UNAVAILABLE', 503);
    const key = (await keysResponse.json<{ keys?: Array<Record<string, unknown>> }>()).keys?.find((item) => item.kid === header.kid);
    if (!key) error('INVALID_TOKEN', 401);
    const cryptoKey = await crypto.subtle.importKey('jwk', key, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    if (!await crypto.subtle.verify({ name: 'RSASSA-PKCS1-v1_5' }, cryptoKey, unb64(parts[2]), new TextEncoder().encode(`${parts[0]}.${parts[1]}`))) error('INVALID_TOKEN', 401);
    return claims;
  } catch (e) {
    if ((e as ApiError).status) throw e;
    error('INVALID_TOKEN', 401);
  }
};

let cachedServiceToken: { token: string; exp: number } | null = null;

const serviceToken = async (env: Env) => {
  const now = Math.floor(Date.now() / 1000);
  if (cachedServiceToken && cachedServiceToken.exp > now + 120) {
    return cachedServiceToken.token;
  }
  const account = parseServiceAccount(env);
  const assertion = await signServiceJwt(env, {
    iss: account.client_email,
    sub: account.client_email,
    scope: 'https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  });
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${assertion}`,
  });
  if (!response.ok) error('BACKEND_TOKEN_FAILED', 503);
  const result = await response.json<{ access_token?: string; expires_in?: number }>();
  if (!result.access_token) error('BACKEND_TOKEN_FAILED', 503);
  cachedServiceToken = {
    token: result.access_token,
    exp: now + (result.expires_in || 3600),
  };
  return cachedServiceToken.token;
};

const fsUrl = (env: Env, suffix = '') => `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents${suffix}`;
const fsResource = (env: Env, suffix = '') => `projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents${suffix}`;
const firestore = async (env: Env, suffix: string, init: RequestInit = {}) => fetch(fsUrl(env, suffix), { ...init, headers: { Authorization: `Bearer ${await serviceToken(env)}`, 'content-type': 'application/json', ...(init.headers || {}) } });
const getDoc = async (env: Env, collection: string, docId: string) => { const response = await firestore(env, `/${encodePath(collection)}/${encodeURIComponent(docId)}`); if (response.status === 404) return null; if (!response.ok) error('FIRESTORE_READ_FAILED', 503); return response.json<Doc>(); };
const listDocs = async (env: Env, collection: string, filters: Array<[string, unknown]> = [], limit = 100) => { const where = filters.length ? { where: { compositeFilter: { op: 'AND', filters: filters.map(([field, value]) => ({ fieldFilter: { field: { fieldPath: field }, op: 'EQUAL', value: fs(value) } })) } } } : {}; const response = await firestore(env, ':runQuery', { method: 'POST', body: JSON.stringify({ structuredQuery: { from: [{ collectionId: collection }], ...where, limit } }) }); if (!response.ok) error('FIRESTORE_QUERY_FAILED', 503); const rows = await response.json<Array<{ document?: Doc }>>(); return rows.flatMap((x) => x.document ? [fromDoc(x.document)] : []).filter(Boolean) as Array<Record<string, any>>; };
const writeUpdate = (env: Env, collection: string, docId: string, data: Record<string, unknown>, updateTime?: string): Write => ({ update: { name: fsResource(env, `/${collection}/${docId}`), fields: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, fs(v)])) }, updateMask: { fieldPaths: Object.keys(data) }, ...(updateTime ? { currentDocument: { updateTime } } : {}) });
const writeCreate = (env: Env, collection: string, docId: string, data: Record<string, unknown>): Write => ({ ...writeUpdate(env, collection, docId, data), currentDocument: { exists: false } });
const writeDelete = (env: Env, collection: string, docId: string): Write => ({ delete: fsResource(env, `/${collection}/${docId}`) });
const audit = (env: Env, actor: Claims, action: string, target: string, metadata: Record<string, unknown> = {}) => writeUpdate(env, 'audit_logs', id(), { actor_id: actor.sub, action, target, metadata, created_at: iso() });

const transaction = async <T>(env: Env, paths: string[], callback: (docs: Array<Doc | null>) => { result: T; writes: Write[] }): Promise<T> => {
  let lastErrText = '';
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const began = await firestore(env, ':beginTransaction', { method: 'POST', body: JSON.stringify({ options: { readWrite: {} } }) });
    if (!began.ok) error('FIRESTORE_TRANSACTION_FAILED', 503);
    const tx = (await began.json<{ transaction: string }>()).transaction;
    let docs: Array<Doc | null> = [];
    if (paths.length) {
      const got = await firestore(env, ':batchGet', { method: 'POST', body: JSON.stringify({ documents: paths.map((p) => fsResource(env, `/${encodePath(p)}`)), transaction: tx }) });
      if (!got.ok) error('FIRESTORE_TRANSACTION_FAILED', 503);
      const found = await got.json<Array<{ found?: Doc }>>();
      docs = paths.map((path) => found.find((x) => x.found?.name.endsWith(`/documents/${path}`))?.found || null);
    }
    const { result, writes } = callback(docs);
    const committed = await firestore(env, ':commit', { method: 'POST', body: JSON.stringify({ transaction: tx, writes }) });
    if (committed.ok) return result;
    lastErrText = await committed.text();
    if (!lastErrText.includes('ABORTED') && !lastErrText.includes('FAILED_PRECONDITION') && !lastErrText.includes('ALREADY_EXISTS')) error('FIRESTORE_COMMIT_FAILED', 503);
    if (attempt < 5) {
      await new Promise((resolve) => setTimeout(resolve, Math.min(1200, 350 * Math.pow(1.6, attempt) + Math.floor(Math.random() * 150))));
    }
  }
  error(`CONCURRENT_MODIFICATION_CONFLICT: ${lastErrText.slice(0, 300)}`, 409);
};

const parseBody = async (request: Request) => { try { return await request.json<Record<string, any>>(); } catch { error('INVALID_JSON', 400); } };
const normalizePhone = (value: string) => { const d = value.replace(/[٠-٩]/g, (x) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(x))).replace(/\D/g, ''); if (d.startsWith('00964')) return `+${d.slice(2)}`; if (d.startsWith('964')) return `+${d}`; if (d.startsWith('07')) return `+964${d.slice(1)}`; if (d.startsWith('7')) return `+964${d}`; return ''; };
const sha = async (value: string) => b64(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))));
const hashPassword = async (password: string) => { try { const salt = crypto.getRandomValues(new Uint8Array(16)); const derived = await scrypt(password, salt, 32, { N: 16384, r: 8, p: 1, maxmem: 32 * 1024 * 1024 }); return `scrypt$N=16384,r=8,p=1$${b64(salt)}$${b64(new Uint8Array(derived as Uint8Array))}`; } catch { error('PASSWORD_HASH_FAILED', 503); } };
const verifyPassword = async (password: string, encoded: string) => { try { const [, params, saltText, hashText] = encoded.split('$'); if (params !== 'N=16384,r=8,p=1' || !saltText || !hashText) return false; const derived = new Uint8Array(await scrypt(password, unb64(saltText), 32, { N: 16384, r: 8, p: 1, maxmem: 32 * 1024 * 1024 }) as Uint8Array); const expected = unb64(hashText); if (derived.length !== expected.length) return false; let mismatch = 0; for (let index = 0; index < derived.length; index += 1) mismatch |= derived[index] ^ expected[index]; return mismatch === 0; } catch { return false; } };
const parseServiceAccount = (env: Env) => { if (!env.FIREBASE_SERVICE_ACCOUNT_JSON) error('BACKEND_SECRET_NOT_CONFIGURED', 503); try { const account = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON) as { client_email?: string; private_key?: string }; if (!account.client_email || !account.private_key) error('BACKEND_SECRET_INVALID', 503); return account as { client_email: string; private_key: string }; } catch { error('BACKEND_SECRET_INVALID', 503); } };

const githubKey = async (pem: string) => {
  const source = pem.replace(/\\n/g, '\n').trim();
  const rsa = source.match(/-----BEGIN RSA PRIVATE KEY-----([\s\S]+?)-----END RSA PRIVATE KEY-----/);
  const pkcs8 = source.match(/-----BEGIN PRIVATE KEY-----([\s\S]+?)-----END PRIVATE KEY-----/);
  const format = rsa ? 'pkcs1' : pkcs8 ? 'pkcs8' : 'unknown';
  const body = (rsa?.[1] || pkcs8?.[1] || '').replace(/\s/g, '');
  console.log(JSON.stringify({ event: 'github_key_prepare', format, hasBeginMarker: source.includes('BEGIN '), hasEndMarker: source.includes('END '), bodyChars: body.length }));
  if (!body) { console.error(JSON.stringify({ event: 'github_key_invalid', reason: 'missing_pem_body' })); error('GITHUB_PRIVATE_KEY_INVALID', 503); }
  try {
    let bytes = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
    if (rsa) {
      const derLength = (value: number) => {
        if (value < 128) return [value];
        const width = Math.ceil(Math.log2(value + 1) / 8);
        return [0x80 | width, ...Array.from({ length: width }, (_, index) => (value >>> (8 * (width - index - 1))) & 0xff)];
      };
      const algorithm = new Uint8Array([0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00]);
      const version = new Uint8Array([0x02, 0x01, 0x00]);
      const privateKey = new Uint8Array([0x04, ...derLength(bytes.length), ...bytes]);
      const bodyBytes = new Uint8Array([...version, ...algorithm, ...privateKey]);
      bytes = new Uint8Array([0x30, ...derLength(bodyBytes.length), ...bodyBytes]);
    }
    return await crypto.subtle.importKey('pkcs8', bytes, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  } catch (cause) { console.error(JSON.stringify({ event: 'github_key_invalid', reason: 'import_failed', detail: String(cause).slice(0, 160) })); error('GITHUB_PRIVATE_KEY_INVALID', 503); }
};

const githubToken = async (env: Env) => {
  const configured = { appId: Boolean(env.GITHUB_APP_ID), installationId: Boolean(env.GITHUB_INSTALLATION_ID), privateKey: Boolean(env.GITHUB_PRIVATE_KEY), repository: Boolean(env.GITHUB_ASSET_REPOSITORY) };
  if (!Object.values(configured).every(Boolean)) { console.error(JSON.stringify({ event: 'github_token_config_missing', configured })); error('GITHUB_MEDIA_NOT_CONFIGURED', 503); }
  const now = Math.floor(Date.now() / 1000); const header = b64(new TextEncoder().encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))); const payload = b64(new TextEncoder().encode(JSON.stringify({ iat: now - 30, exp: now + 540, iss: env.GITHUB_APP_ID })));
  const key = await githubKey(env.GITHUB_PRIVATE_KEY!); let signature: string;
  try { signature = b64(new Uint8Array(await crypto.subtle.sign({ name: 'RSASSA-PKCS1-v1_5' }, key, new TextEncoder().encode(`${header}.${payload}`)))); } catch (cause) { console.error(JSON.stringify({ event: 'github_jwt_sign_failed', detail: String(cause).slice(0, 160) })); error('GITHUB_JWT_SIGN_FAILED', 503); }
  const response = await fetch(`https://api.github.com/app/installations/${env.GITHUB_INSTALLATION_ID}/access_tokens`, { method: 'POST', headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${header}.${payload}.${signature!}`, 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'alasas-dental-staging-worker' } });
  const responseText = await response.text(); let result: { token?: string; message?: string } = {}; try { result = JSON.parse(responseText); } catch { /* keep redacted */ }
  if (!response.ok) error('GITHUB_INSTALLATION_TOKEN_FAILED', 502); if (!result.token) error('GITHUB_INSTALLATION_TOKEN_EMPTY', 502); return result.token;
};

const githubContents = async (env: Env, path: string, init: RequestInit = {}) => { const token = await githubToken(env); const response = await fetch(`https://api.github.com/repos/${env.GITHUB_ASSET_REPOSITORY}/contents/${path}`, { ...init, headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'alasas-dental-staging-worker', 'content-type': 'application/json', ...(init.headers || {}) } }); const responseText = response.ok || response.status === 204 ? '' : await response.text(); let result: { message?: string } = {}; try { result = responseText ? JSON.parse(responseText) : {}; } catch { /* keep redacted */ } if (!response.ok) error(`GITHUB_CONTENTS_${response.status}`, 502); return response.status === 204 ? null : responseText ? JSON.parse(responseText) : response.json<any>(); };
const base64Bytes = (bytes: Uint8Array) => { let output = ''; for (let offset = 0; offset < bytes.length; offset += 0x8000) output += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + 0x8000, bytes.length))); return btoa(output); };
const signServiceJwt = async (env: Env, payload: Record<string, unknown>) => { const account = parseServiceAccount(env); const pem = account.private_key.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, ''); let key: CryptoKey; try { key = await crypto.subtle.importKey('pkcs8', Uint8Array.from(atob(pem), (c) => c.charCodeAt(0)), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']); } catch { error('BACKEND_KEY_IMPORT_FAILED', 503); } const header = b64(new TextEncoder().encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))); const body = b64(new TextEncoder().encode(JSON.stringify(payload))); try { const signature = b64(new Uint8Array(await crypto.subtle.sign({ name: 'RSASSA-PKCS1-v1_5' }, key, new TextEncoder().encode(`${header}.${body}`)))); return `${header}.${body}.${signature}`; } catch { error('BACKEND_KEY_SIGN_FAILED', 503); } };
const customToken = async (env: Env, uid: string) => { const account = parseServiceAccount(env); const now = Math.floor(Date.now() / 1000); return signServiceJwt(env, { iss: account.client_email, sub: account.client_email, aud: 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit', iat: now, exp: now + 3600, uid }); };
const requireRole = async (env: Env, actor: Claims, roles: string[]) => { const doc = await getDoc(env, 'profiles', actor.sub); const profile = fromDoc(doc) as Record<string, any> | null; if (!profile || profile.status !== 'VERIFIED' || !roles.includes(profile.role)) error('FORBIDDEN', 403); return profile; };
const transition = (current: string, next: string, allowed: Record<string, string[]>) => { if (!allowed[current]?.includes(next)) error('INVALID_STATUS_TRANSITION', 409); };

const signStorageToken = async (env: Env, payload: Record<string, unknown>) => {
  const account = parseServiceAccount(env);
  const secretBytes = new TextEncoder().encode(`${account.client_email}:${account.private_key.slice(0, 120)}`);
  const key = await crypto.subtle.importKey('raw', secretBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const body = b64(new TextEncoder().encode(JSON.stringify(payload)));
  const sig = b64(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body))));
  return `${body}.${sig}`;
};

const verifyStorageToken = async (env: Env, token: string): Promise<Record<string, any>> => {
  const parts = String(token || '').split('.');
  if (parts.length !== 2) error('INVALID_SIGNED_URL', 403);
  const account = parseServiceAccount(env);
  const secretBytes = new TextEncoder().encode(`${account.client_email}:${account.private_key.slice(0, 120)}`);
  const key = await crypto.subtle.importKey('raw', secretBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  let valid = false;
  try {
    valid = await crypto.subtle.verify('HMAC', key, unb64(parts[1]), new TextEncoder().encode(parts[0]));
  } catch {
    valid = false;
  }
  if (!valid) error('INVALID_SIGNED_URL', 403);
  let payload: Record<string, any>;
  try {
    payload = decode(parts[0]);
  } catch {
    error('INVALID_SIGNED_URL', 403);
  }
  if (typeof payload.exp !== 'number' || payload.exp * 1000 <= Date.now()) error('SIGNED_URL_EXPIRED', 403);
  return payload;
};

const hasValidMagicBytes = (mime: string, bytes: Uint8Array): boolean => {
  if (bytes.length < 4) return false;
  if (mime === 'image/png') return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  if (mime === 'image/jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mime === 'application/pdf') return bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
  if (mime === 'image/webp') {
    if (bytes.length < 12) return false;
    return bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
  }
  return false;
};

const publicMediaTargets: Record<string, string[]> = {
  branding_settings: ['logo_url', 'dark_logo_url', 'favicon_url', 'customer_header_logo_url', 'admin_sidebar_logo_url', 'hero_image_url'],
  universities: ['image_url'],
  clinical_categories: ['image_url'],
  content_settings: ['image_url'],
};
const mediaIdField = (field: string) => field.replace(/_url$/, '_media_id');
const firestoreUpdateMask = (fields: string[]) => fields.map((field) => `updateMask.fieldPaths=${encodeURIComponent(field)}`).join('&');
const mediaUrlMatches = (value: unknown, publicUrl: string) => typeof value === 'string' && value.split('?')[0] === publicUrl.split('?')[0];
const listPublicMediaReferences = async (env: Env, record: Record<string, any>) => {
  const references: Array<Record<string, string>> = [];
  for (const [collection, fields] of Object.entries(publicMediaTargets)) {
    const rows = await listDocs(env, collection, [], 500);
    for (const row of rows) for (const field of fields) {
      if (row[mediaIdField(field)] === record.id || mediaUrlMatches(row[field], String(record.public_url || ''))) {
        references.push({ collection, document_id: String(row.id), field, label: String(row.name_ar || row.section_key || row.id) });
      }
    }
  }
  return references;
};
const updatePublicMediaReference = async (env: Env, actor: Claims, input: Record<string, any>, link: boolean) => {
  await requireRole(env, actor, ['ADMIN', 'SUPER_ADMIN']);
  const collection = String(input.collection || ''); const field = String(input.field || ''); const documentId = String(input.document_id || '');
  if (!publicMediaTargets[collection]?.includes(field) || !documentId) error('INVALID_MEDIA_REFERENCE', 400);
  const target = fromDoc(await getDoc(env, collection, documentId)) as Record<string, any> | null;
  if (!target) error('MEDIA_TARGET_NOT_FOUND', 404);
  if (!link) {
    const mediaId = String(input.media_id || ''); const currentId = String(target[mediaIdField(field)] || ''); const currentUrl = String(target[field] || '');
    if (mediaId && currentId && mediaId !== currentId) error('MEDIA_REFERENCE_MISMATCH', 409);
    const fields = { [field]: fs(null), [mediaIdField(field)]: fs(null), updated_at: fs(iso()), updated_by: fs(actor.sub) };
    const response = await firestore(env, `/${collection}/${encodeURIComponent(documentId)}?${firestoreUpdateMask(Object.keys(fields))}`, { method: 'PATCH', body: JSON.stringify({ fields }) });
    if (!response.ok) error('MEDIA_REFERENCE_UPDATE_FAILED', 503);
    const readback = fromDoc(await getDoc(env, collection, documentId));
    return { collection, document_id: documentId, field, unlinked_url: currentUrl, record: readback };
  }
  const mediaId = String(input.media_id || ''); const media = fromDoc(await getDoc(env, 'public_media_assets', mediaId)) as Record<string, any> | null;
  if (!media?.public_url) error('MEDIA_NOT_FOUND', 404);
  const fields = { [field]: fs(media.public_url), [mediaIdField(field)]: fs(media.id), updated_at: fs(iso()), updated_by: fs(actor.sub) };
  const response = await firestore(env, `/${collection}/${encodeURIComponent(documentId)}?${firestoreUpdateMask(Object.keys(fields))}`, { method: 'PATCH', body: JSON.stringify({ fields }) });
  if (!response.ok) error('MEDIA_REFERENCE_UPDATE_FAILED', 503);
  const readback = fromDoc(await getDoc(env, collection, documentId));
  if (readback?.[field] !== media.public_url || readback?.[mediaIdField(field)] !== media.id) error('MEDIA_REFERENCE_READBACK_FAILED', 503);
  return { collection, document_id: documentId, field, media_id: media.id, public_url: media.public_url, record: readback };
};

const registrationRequest = async (request: Request, env: Env) => {
  checkRateLimit(request, 'registration', 20, 60_000);
  const input = await parseBody(request);
  const full_name = String(input.full_name || '').trim();
  const phone = normalizePhone(String(input.phone || ''));
  const role = input.role === 'PATIENT' || input.role === 'STUDENT' ? input.role : '';
  const gender = input.gender === 'MALE' || input.gender === 'FEMALE' ? input.gender : '';
  const password = String(input.password || '');
  const weak = new Set(['password', 'password123', 'qwerty123', '12345678', '1234567890']);
  const preferredUniversityIds = Array.from(new Set((Array.isArray(input.preferred_university_ids) ? input.preferred_university_ids : input.university_id ? [input.university_id] : []).map(String).filter(Boolean))).slice(0, 4);
  if (full_name.length < 2 || full_name.length > 160 || !/^\+9647\d{9}$/.test(phone) || !role || !gender || password.length < 8 || password.length > 128 || !/[A-Za-z]/.test(password) || !/[^A-Za-z]/.test(password) || weak.has(password.toLowerCase()) || password !== String(input.password_confirmation || '') || !String(input.province_id || '') || preferredUniversityIds.length < 1 || preferredUniversityIds.length > 4) error('INVALID_REGISTRATION', 400);
  if (role === 'PATIENT' && (!input.area_id || !input.birth_date)) error('INVALID_REGISTRATION', 400);
  if (role === 'STUDENT' && (!input.university_id || !input.stage)) error('INVALID_REGISTRATION', 400);
  const key = await sha(`phone:${phone}`);
  const requestId = id();
  const authUid = `dental_${requestId.replace(/-/g, '')}`;
  const created_at = iso();
  const password_hash = await hashPassword(password);
  const accountStatus = role === 'PATIENT' ? 'VERIFIED' : 'PENDING';
  const fields = { id: requestId, auth_uid: authUid, full_name, phone_e164: phone, role, gender, province_id: String(input.province_id), area_id: input.area_id ? String(input.area_id) : null, birth_date: input.birth_date ? String(input.birth_date) : null, university_id: input.university_id ? String(input.university_id) : preferredUniversityIds[0], stage: input.stage ? String(input.stage) : null, preferred_university_ids: preferredUniversityIds, password_hash, status: accountStatus, created_at, updated_at: created_at };
  const profile = { id: authUid, role, status: accountStatus, full_name, phone, whatsapp: input.whatsapp ? normalizePhone(String(input.whatsapp)) : null, gender, birth_date: input.birth_date ? String(input.birth_date) : null, province_id: String(input.province_id), area_id: input.area_id ? String(input.area_id) : null, university_id: input.university_id ? String(input.university_id) : preferredUniversityIds[0], stage: input.stage ? String(input.stage) : null, preferred_university_ids: preferredUniversityIds, created_at, updated_at: created_at };
  const result = await transaction(env, [`registration_phone_index/${key}`], (docs) => {
    if (fromDoc(docs[0])?.active_request_id) error('DUPLICATE_REGISTRATION', 409);
    const writes: Write[] = [
      writeCreate(env, 'registration_requests', requestId, fields),
      writeUpdate(env, 'registration_phone_index', key, { phone_e164: phone, active_request_id: requestId, updated_at: created_at }),
      writeCreate(env, 'profiles', authUid, profile),
    ];
    for (const universityId of preferredUniversityIds) {
      writes.push(writeCreate(env, role === 'PATIENT' ? 'patient_preferred_universities' : 'student_preferred_universities', `${authUid}_${universityId}`, { id: `${authUid}_${universityId}`, [role === 'PATIENT' ? 'patient_id' : 'student_id']: authUid, university_id: universityId, created_at }));
    }
    return { result: { request_id: requestId, status: accountStatus, created_at, auth_uid: authUid }, writes };
  });
  return json({ ...result, custom_token: await customToken(env, authUid) }, 201);
};

const phoneLogin = async (request: Request, env: Env) => {
  checkRateLimit(request, 'login', 30, 60_000);
  const input = await parseBody(request);
  const phone = normalizePhone(String(input.phone || ''));
  const password = String(input.password || '');
  if (!phone || !password || password.length > 128) error('INVALID_CREDENTIALS', 401);
  const key = await sha(`phone:${phone}`);
  const index = fromDoc(await getDoc(env, 'registration_phone_index', key)) as Record<string, any> | null;
  const registration = index?.active_request_id ? fromDoc(await getDoc(env, 'registration_requests', String(index.active_request_id))) as Record<string, any> | null : null;
  if (!registration || !(await verifyPassword(password, String(registration.password_hash || '')))) error('INVALID_CREDENTIALS', 401);
  if (registration.status === 'PENDING') error('ACCOUNT_PENDING', 403);
  if (registration.status === 'REJECTED' || registration.status === 'SUSPENDED') error('ACCOUNT_SUSPENDED', 403);
  const profile = fromDoc(await getDoc(env, 'profiles', String(registration.auth_uid))) as Record<string, any> | null;
  if (!profile) error('ACCOUNT_PENDING', 403);
  if (profile.status === 'SUSPENDED' || profile.status === 'REJECTED') error('ACCOUNT_SUSPENDED', 403);
  if (profile.status !== 'VERIFIED') error('ACCOUNT_PENDING', 403);
  return json({ custom_token: await customToken(env, String(registration.auth_uid)), status: profile.status, role: profile.role });
};

const profileUpdate = async (request: Request, env: Env, actor: Claims) => {
  const input = await parseBody(request);
  const existingDoc = await getDoc(env, 'profiles', actor.sub);
  const existing = fromDoc(existingDoc) as Record<string, any> | null;
  if (!existing) error('PROFILE_NOT_FOUND', 404);
  const role = String(existing.role || '');
  if (role !== 'PATIENT' && role !== 'STUDENT') {
    error('FORBIDDEN', 403);
  }
  const forbiddenKeys = [
    'role', 'status', 'permissions', 'uid', 'id', 'email', 'emailVerified',
    'created_at', 'is_super_admin', 'user_id', 'target_uid', 'target_id'
  ];
  for (const key of forbiddenKeys) {
    if (input[key] !== undefined) {
      error('FORBIDDEN_FIELD_MODIFICATION', 403);
    }
  }
  const fullName = input.full_name !== undefined ? String(input.full_name || '').trim() : String(existing.full_name || '').trim();
  if (fullName.length < 2 || fullName.length > 160) error('INVALID_PROFILE', 400);
  const whatsappRaw = input.whatsapp !== undefined ? String(input.whatsapp || '').trim() : String(existing.whatsapp || '').trim();
  const whatsapp = whatsappRaw ? normalizePhone(whatsappRaw) : null;
  const gender = input.gender === 'MALE' || input.gender === 'FEMALE' ? input.gender : existing.gender || null;
  const birthDate = input.birth_date !== undefined ? (input.birth_date ? String(input.birth_date) : null) : existing.birth_date || null;
  const provinceId = input.province_id !== undefined ? String(input.province_id || '') : String(existing.province_id || '');
  const areaId = input.area_id !== undefined ? (input.area_id ? String(input.area_id) : null) : existing.area_id || null;
  const universityId = input.university_id !== undefined ? (input.university_id ? String(input.university_id) : null) : existing.university_id || null;
  const stage = input.stage !== undefined ? (input.stage ? String(input.stage) : null) : existing.stage || null;
  const workplace = input.workplace !== undefined ? (input.workplace ? String(input.workplace).slice(0, 200) : null) : existing.workplace || null;
  const preferredUniversityIds = Array.isArray(input.preferred_university_ids)
    ? Array.from(new Set(input.preferred_university_ids.map(String).filter(Boolean)))
    : Array.isArray(existing.preferred_university_ids)
      ? existing.preferred_university_ids
      : universityId
        ? [universityId]
        : [];
  if ((role === 'STUDENT' || role === 'PATIENT') && (preferredUniversityIds.length < 1 || preferredUniversityIds.length > 4)) {
    error('INVALID_PREFERRED_UNIVERSITIES', 400);
  }
  if (!provinceId) error('INVALID_PROFILE', 400);
  const updatedAt = iso();
  const updates: Record<string, unknown> = {
    full_name: fullName,
    whatsapp,
    gender,
    birth_date: birthDate,
    province_id: provinceId,
    area_id: areaId,
    university_id: universityId || preferredUniversityIds[0] || null,
    stage,
    workplace,
    preferred_university_ids: preferredUniversityIds,
    updated_at: updatedAt,
  };
  const prefCollection = role === 'PATIENT' ? 'patient_preferred_universities' : 'student_preferred_universities';
  const ownerField = role === 'PATIENT' ? 'patient_id' : 'student_id';
  const existingPrefs = (role === 'PATIENT' || role === 'STUDENT') ? await listDocs(env, prefCollection, [[ownerField, actor.sub]], 20) : [];
  await transaction(env, [`profiles/${actor.sub}`], (docs) => {
    const writes: Write[] = [
      writeUpdate(env, 'profiles', actor.sub, updates, docs[0]?.updateTime),
      audit(env, actor, 'PROFILE_UPDATED', actor.sub, { role }),
    ];
    if (role === 'PATIENT' || role === 'STUDENT') {
      for (const oldPref of existingPrefs) {
        if (oldPref.id && !preferredUniversityIds.includes(String(oldPref.university_id))) {
          writes.push(writeDelete(env, prefCollection, String(oldPref.id)));
        }
      }
      for (const uniId of preferredUniversityIds) {
        writes.push(writeUpdate(env, prefCollection, `${actor.sub}_${uniId}`, {
          id: `${actor.sub}_${uniId}`,
          [ownerField]: actor.sub,
          university_id: uniId,
          created_at: existing.created_at || updatedAt,
        }));
      }
    }
    return { result: true, writes };
  });
  const readback = fromDoc(await getDoc(env, 'profiles', actor.sub));
  return json({ data: readback });
};

const adminRegistration = async (request: Request, env: Env, actor: Claims) => {
  await requireRole(env, actor, ['ADMIN', 'SUPER_ADMIN']);
  const input = await parseBody(request);
  if (input.action === 'list') {
    const requests = await listDocs(env, 'registration_requests', [], 100);
    return json({ requests: requests.map(({ password_hash: _passwordHash, ...safe }) => safe) });
  }
  const requestId = String(input.request_id || '');
  const next = input.action === 'approve' ? 'VERIFIED' : input.action === 'reject' ? 'REJECTED' : input.action === 'suspend' ? 'SUSPENDED' : '';
  if (!requestId || !next) error('INVALID_OPERATION', 400);
  const result = await transaction(env, [`registration_requests/${requestId}`], (docs) => {
    const current = fromDoc(docs[0]) as Record<string, any> | null;
    if (!current) error('NOT_FOUND', 404);
    transition(current.status, next, {
      PENDING: ['VERIFIED', 'REJECTED', 'SUSPENDED'],
      VERIFIED: ['SUSPENDED', 'REJECTED'],
      REJECTED: ['VERIFIED'],
      SUSPENDED: ['VERIFIED'],
    });
    const reviewedAt = iso();
    const writes: Write[] = [
      writeUpdate(env, 'registration_requests', requestId, { status: next, reviewed_by: actor.sub, reviewed_at: reviewedAt, rejection_reason: next === 'REJECTED' || next === 'SUSPENDED' ? String(input.reason || '').slice(0, 500) || null : null, updated_at: reviewedAt }, docs[0]?.updateTime),
      audit(env, actor, `REGISTRATION_${next}`, requestId),
    ];
    if (current.auth_uid) {
      writes.push(writeUpdate(env, 'profiles', String(current.auth_uid), { status: next === 'VERIFIED' ? 'VERIFIED' : 'SUSPENDED', updated_at: reviewedAt }));
    }
    if (next === 'VERIFIED') {
      const inviteId = id();
      writes.push(writeCreate(env, 'registration_activation_invites', inviteId, { id: inviteId, registration_request_id: requestId, status: 'PENDING', expires_at: new Date(Date.now() + 86400000).toISOString(), created_at: reviewedAt }));
    }
    return { result: { request_id: requestId, status: next }, writes };
  });
  return json(result);
};

const adminUserUpdate = async (request: Request, env: Env, actor: Claims) => {
  await requireRole(env, actor, ['ADMIN', 'SUPER_ADMIN']);
  const input = await parseBody(request);
  const profileId = String(input.profile_id || input.user_id || '');
  if (!profileId) error('INVALID_OPERATION', 400);
  const action = String(input.action || 'update');
  const regRows = await listDocs(env, 'registration_requests', [['auth_uid', profileId]], 5);
  const linkedReg = regRows[0] || null;
  const paths = [`profiles/${profileId}`, ...(linkedReg?.id ? [`registration_requests/${linkedReg.id}`] : [])];
  const result = await transaction(env, paths, (docs) => {
    const current = fromDoc(docs[0]) as Record<string, any> | null;
    if (!current) error('NOT_FOUND', 404);
    if (current.role === 'SUPER_ADMIN' || String(current.email || '').toLowerCase() === 'mohameadalhaear100@gmail.com') {
      error('FORBIDDEN', 403);
    }
    if (['ADMIN', 'STAFF'].includes(String(current.role)) && actor.sub !== current.id) {
      error('FORBIDDEN', 403);
    }
    const updatedAt = iso();
    const profilePatch: Record<string, unknown> = { updated_at: updatedAt };
    if (action === 'approve' || action === 'verify' || action === 'restore') profilePatch.status = 'VERIFIED';
    else if (action === 'reject') {
      profilePatch.status = 'REJECTED';
      profilePatch.rejection_reason = String(input.reason || '').slice(0, 500) || null;
    } else if (action === 'suspend') {
      profilePatch.status = 'SUSPENDED';
      profilePatch.rejection_reason = String(input.reason || '').slice(0, 500) || null;
    } else if (action === 'update') {
      if (input.full_name !== undefined) {
        const name = String(input.full_name || '').trim();
        if (name.length < 2 || name.length > 160) error('INVALID_PROFILE', 400);
        profilePatch.full_name = name;
      }
      if (input.status && ['PENDING', 'VERIFIED', 'REJECTED', 'SUSPENDED'].includes(String(input.status))) {
        profilePatch.status = String(input.status);
      }
      if (input.province_id !== undefined) profilePatch.province_id = String(input.province_id || '');
      if (input.area_id !== undefined) profilePatch.area_id = input.area_id ? String(input.area_id) : null;
      if (input.university_id !== undefined) profilePatch.university_id = input.university_id ? String(input.university_id) : null;
      if (input.stage !== undefined) profilePatch.stage = input.stage ? String(input.stage) : null;
      if (input.gender && ['MALE', 'FEMALE'].includes(String(input.gender))) profilePatch.gender = String(input.gender);
      if (input.birth_date !== undefined) profilePatch.birth_date = input.birth_date ? String(input.birth_date) : null;
      if (input.whatsapp !== undefined) profilePatch.whatsapp = input.whatsapp ? normalizePhone(String(input.whatsapp)) : null;
    } else {
      error('INVALID_OPERATION', 400);
    }
    const writes: Write[] = [
      writeUpdate(env, 'profiles', profileId, profilePatch, docs[0]?.updateTime),
      audit(env, actor, `USER_${action.toUpperCase()}`, profileId, { status: profilePatch.status || current.status }),
    ];
    if (linkedReg?.id && docs[1]) {
      const regPatch: Record<string, unknown> = { updated_at: updatedAt, reviewed_by: actor.sub, reviewed_at: updatedAt };
      if (profilePatch.status) regPatch.status = profilePatch.status;
      if (profilePatch.full_name) regPatch.full_name = profilePatch.full_name;
      if (profilePatch.province_id) regPatch.province_id = profilePatch.province_id;
      if (profilePatch.university_id) regPatch.university_id = profilePatch.university_id;
      if (profilePatch.stage !== undefined) regPatch.stage = profilePatch.stage;
      writes.push(writeUpdate(env, 'registration_requests', String(linkedReg.id), regPatch, docs[1]?.updateTime));
    }
    return { result: { id: profileId, ...current, ...profilePatch }, writes };
  });
  return json({ data: result });
};

const managerInvite = async (request: Request, env: Env, actor: Claims) => {
  await requireRole(env, actor, ['SUPER_ADMIN']);
  const input = await parseBody(request);
  const email = String(input.email || '').trim().toLowerCase();
  const role = input.role === 'ADMIN' || input.role === 'STAFF' ? input.role : '';
  const permissions = Array.isArray(input.permissions) ? input.permissions.map(String).slice(0, 50) : [];
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !role) error('INVALID_INVITATION', 400);
  const invitationId = id();
  const createdAt = iso();
  const result = await transaction(env, [], () => ({
    result: { invitation_id: invitationId, email, role, status: 'PENDING' },
    writes: [
      writeCreate(env, 'manager_invitations', invitationId, { id: invitationId, email, role, permissions, status: 'PENDING', expires_at: new Date(Date.now() + 86400000).toISOString(), created_at: createdAt, updated_at: createdAt }),
      audit(env, actor, 'MANAGER_INVITED', invitationId, { email, role }),
    ],
  }));
  return json(result, 201);
};

const managerUpdate = async (request: Request, env: Env, actor: Claims) => {
  await requireRole(env, actor, ['SUPER_ADMIN']);
  const input = await parseBody(request);
  const profileId = String(input.profile_id || '');
  const role = input.role === 'ADMIN' || input.role === 'STAFF' ? input.role : '';
  const status = input.status === 'VERIFIED' || input.status === 'SUSPENDED' ? input.status : '';
  const permissions = Array.isArray(input.permissions) ? input.permissions.map(String).slice(0, 50) : [];
  if (!profileId || !role || !status) error('INVALID_MANAGER_UPDATE', 400);
  const result = await transaction(env, [`profiles/${profileId}`], (docs) => {
    const current = fromDoc(docs[0]) as Record<string, any> | null;
    if (!current || !['ADMIN', 'STAFF', 'SUPER_ADMIN'].includes(String(current.role))) error('NOT_FOUND', 404);
    if (current.role === 'SUPER_ADMIN' || String(current.email || '').toLowerCase() === 'mohameadalhaear100@gmail.com') error('FORBIDDEN', 403);
    const updatedAt = iso();
    return {
      result: { profile_id: profileId, role, status, permissions },
      writes: [
        writeUpdate(env, 'profiles', profileId, { role, status, permissions, updated_at: updatedAt }, docs[0]?.updateTime),
        audit(env, actor, 'MANAGER_UPDATED', profileId, { role, status }),
      ],
    };
  });
  return json(result);
};

const managerAccept = async (request: Request, env: Env, actor: Claims) => {
  const input = await parseBody(request);
  const invitationId = String(input.invitation_id || input.p_invitation_id || '').trim();
  if (!invitationId) error('INVALID_INVITATION', 400);
  const actorEmail = String(actor.email || '').trim().toLowerCase();
  if (!actorEmail) error('EMAIL_VERIFICATION_REQUIRED', 403);
  const result = await transaction(env, [`manager_invitations/${invitationId}`, `profiles/${actor.sub}`], (docs) => {
    const invitation = fromDoc(docs[0]) as Record<string, any> | null;
    if (!invitation) error('INVITATION_NOT_FOUND', 404);
    if (invitation.status !== 'PENDING') error('INVITATION_NOT_PENDING', 409);
    if (invitation.expires_at && new Date(String(invitation.expires_at)).getTime() <= Date.now()) error('INVITATION_EXPIRED', 409);
    if (String(invitation.email || '').trim().toLowerCase() !== actorEmail) error('INVITATION_EMAIL_MISMATCH', 403);
    const invitedRole = String(invitation.role || '');
    if (!['ADMIN', 'STAFF'].includes(invitedRole)) error('FORBIDDEN', 403);
    const currentProfile = fromDoc(docs[1]) as Record<string, any> | null;
    if (currentProfile?.role === 'SUPER_ADMIN') error('FORBIDDEN', 403);
    const now = iso();
    const profileFields = {
      id: actor.sub,
      email: actorEmail,
      full_name: currentProfile?.full_name || actorEmail.split('@')[0],
      role: invitedRole,
      status: 'VERIFIED',
      permissions: Array.isArray(invitation.permissions) ? invitation.permissions : [],
      created_at: currentProfile?.created_at || now,
      updated_at: now,
    };
    return {
      result: { invitation_id: invitationId, profile_id: actor.sub, role: invitedRole, status: 'VERIFIED' },
      writes: [
        writeUpdate(env, 'manager_invitations', invitationId, { status: 'ACCEPTED', accepted_by: actor.sub, accepted_at: now, updated_at: now }, docs[0]?.updateTime),
        writeUpdate(env, 'profiles', actor.sub, profileFields, docs[1]?.updateTime),
        audit(env, actor, 'MANAGER_INVITATION_ACCEPTED', invitationId, { email: actorEmail, role: invitedRole }),
      ],
    };
  });
  return json({ data: result });
};

const createEntity = async (request: Request, env: Env, actor: Claims, kind: 'case' | 'student') => {
  const profile = await requireRole(env, actor, [kind === 'case' ? 'PATIENT' : 'STUDENT']);
  const input = await parseBody(request);
  const entityId = id();
  const isCase = kind === 'case';
  const preferredUniversityIds = Array.from(new Set((Array.isArray(input.university_ids || input.preferred_university_ids) ? (input.university_ids || input.preferred_university_ids) : []).map(String).filter(Boolean))).slice(0, 4);
  if (preferredUniversityIds.length < 1 || preferredUniversityIds.length > 4) error(isCase ? 'INVALID_CASE_UNIVERSITIES' : 'INVALID_REQUEST_UNIVERSITIES', 400);
  const requestedCaseId = !isCase && (input.requested_case_id || input.case_id) ? String(input.requested_case_id || input.case_id).trim() : null;
  const studentCasePairKey = requestedCaseId ? await sha(`${actor.sub}:${requestedCaseId}`) : null;
  const now = iso();
  const fields: Record<string, any> = {
    id: entityId,
    ...(isCase
      ? {
          patient_id: actor.sub,
          case_number: `CASE-${Date.now().toString(36).toUpperCase()}`,
          area_id: String(input.area_id || ''),
          patient_age: Number(input.patient_age || 0),
          patient_gender: String(input.patient_gender || ''),
          clinical_category_id: input.clinical_category_id ? String(input.clinical_category_id) : null,
          title: input.title ? String(input.title).slice(0, 200) : null,
          description: String(input.description || '').slice(0, 5000),
          symptoms: Array.isArray(input.symptoms) ? input.symptoms.map(String).slice(0, 30) : [],
          preferred_periods: Array.isArray(input.preferred_periods) ? input.preferred_periods.map(String).slice(0, 10) : [],
          preferred_university_ids: preferredUniversityIds,
          is_approved_for_student_view: false,
        }
      : {
          student_id: actor.sub,
          request_number: `REQ-${Date.now().toString(36).toUpperCase()}`,
          clinical_category_id: input.clinical_category_id ? String(input.clinical_category_id) : null,
          tooth_area: input.tooth_area ? String(input.tooth_area).slice(0, 500) : null,
          notes: input.notes ? String(input.notes).slice(0, 2000) : null,
          requested_case_id: requestedCaseId,
          preferred_university_ids: preferredUniversityIds,
        }),
    province_id: String(input.province_id || profile?.province_id || ''),
    available_days: Array.isArray(input.available_days) ? input.available_days.map(String).slice(0, 14) : [],
    status: 'PENDING',
    status_history: [{ status: 'PENDING', actor_id: actor.sub, at: now }],
    created_at: now,
    updated_at: now,
  };
  if (!fields.province_id || (isCase && (!fields.description || !fields.area_id || !Number.isInteger(fields.patient_age) || fields.patient_age < 1 || fields.patient_age > 120))) error(isCase ? 'INVALID_CASE' : 'INVALID_REQUEST', 400);
  const txPaths = requestedCaseId && studentCasePairKey ? [`patient_cases/${requestedCaseId}`, `student_case_requests/${studentCasePairKey}`] : [];
  const result = await transaction(env, txPaths, (docs) => {
    if (requestedCaseId) {
      const targetCase = fromDoc(docs[0]) as Record<string, any> | null;
      if (!targetCase) error('CASE_NOT_FOUND', 404);
      if (targetCase.status !== 'WAITING_FOR_MATCH' || targetCase.is_approved_for_student_view !== true) error('CASE_NOT_AVAILABLE', 409);
      const existingPair = fromDoc(docs[1]) as Record<string, any> | null;
      if (existingPair && ['PENDING', 'VERIFIED', 'MATCHED'].includes(String(existingPair.status))) error('DUPLICATE_CASE_REQUEST', 409);
      fields.requested_case_number = targetCase.case_number || targetCase.id;
    }
    const writes: Write[] = [
      writeCreate(env, isCase ? 'patient_cases' : 'student_requests', entityId, fields),
      audit(env, actor, isCase ? 'CASE_CREATED' : 'STUDENT_REQUEST_CREATED', entityId, requestedCaseId ? { requested_case_id: requestedCaseId } : {}),
    ];
    if (requestedCaseId && studentCasePairKey) {
      writes.push(writeUpdate(env, 'student_case_requests', studentCasePairKey, { request_id: entityId, student_id: actor.sub, case_id: requestedCaseId, status: 'PENDING', updated_at: now }));
    }
    const relationCollection = isCase ? 'patient_case_preferred_universities' : 'student_request_preferred_universities';
    for (const universityId of preferredUniversityIds) {
      writes.push(writeCreate(env, relationCollection, `${entityId}_${universityId}`, { id: `${entityId}_${universityId}`, ...(isCase ? { case_id: entityId, patient_id: actor.sub } : { request_id: entityId, student_id: actor.sub }), university_id: universityId, created_at: fields.created_at }));
    }
    return { result: { id: entityId, ...fields, actor_role: profile.role }, writes };
  });
  return json({ data: result }, 201);
};

const patientCaseUpdate = async (request: Request, env: Env, actor: Claims) => {
  await requireRole(env, actor, ['PATIENT']);
  const input = await parseBody(request);
  const caseId = String(input.case_id || input.id || '');
  if (!caseId) error('INVALID_OPERATION', 400);
  const action = String(input.action || 'update');
  const result = await transaction(env, [`patient_cases/${caseId}`], (docs) => {
    const current = fromDoc(docs[0]) as Record<string, any> | null;
    if (!current) error('NOT_FOUND', 404);
    if (current.patient_id !== actor.sub) error('FORBIDDEN', 403);
    if (['MATCHED', 'IN_PROGRESS', 'COMPLETED'].includes(String(current.status))) error('CASE_LOCKED_BY_MATCH', 409);
    const now = iso();
    const history = Array.isArray(current.status_history) ? [...current.status_history] : [];
    if (action === 'cancel') {
      history.push({ status: 'CANCELLED', actor_id: actor.sub, at: now });
      const patch = { status: 'CANCELLED', is_approved_for_student_view: false, status_history: history, updated_at: now };
      return {
        result: { ...current, ...patch },
        writes: [writeUpdate(env, 'patient_cases', caseId, patch, docs[0]?.updateTime), audit(env, actor, 'PATIENT_CASE_CANCELLED', caseId)],
      };
    }
    const patch: Record<string, unknown> = { updated_at: now };
    if (input.description !== undefined) {
      const desc = String(input.description || '').trim().slice(0, 5000);
      if (!desc) error('INVALID_CASE', 400);
      patch.description = desc;
    }
    if (input.clinical_category_id !== undefined) patch.clinical_category_id = input.clinical_category_id ? String(input.clinical_category_id) : null;
    if (input.title !== undefined) patch.title = input.title ? String(input.title).slice(0, 200) : null;
    if (input.patient_age !== undefined) {
      const age = Number(input.patient_age);
      if (!Number.isInteger(age) || age < 1 || age > 120) error('INVALID_CASE', 400);
      patch.patient_age = age;
    }
    if (Array.isArray(input.symptoms)) patch.symptoms = input.symptoms.map(String).slice(0, 30);
    if (Array.isArray(input.available_days)) patch.available_days = input.available_days.map(String).slice(0, 14);
    if (Array.isArray(input.preferred_periods)) patch.preferred_periods = input.preferred_periods.map(String).slice(0, 10);
    return {
      result: { ...current, ...patch },
      writes: [writeUpdate(env, 'patient_cases', caseId, patch, docs[0]?.updateTime), audit(env, actor, 'PATIENT_CASE_UPDATED', caseId)],
    };
  });
  return json({ data: result });
};

const studentRequestUpdate = async (request: Request, env: Env, actor: Claims) => {
  await requireRole(env, actor, ['STUDENT']);
  const input = await parseBody(request);
  const requestId = String(input.request_id || input.id || '');
  if (!requestId) error('INVALID_OPERATION', 400);
  const action = String(input.action || 'cancel');
  const existingDoc = await getDoc(env, 'student_requests', requestId);
  const existing = fromDoc(existingDoc) as Record<string, any> | null;
  if (!existing) error('NOT_FOUND', 404);
  if (existing.student_id !== actor.sub) error('FORBIDDEN', 403);
  if (['MATCHED', 'COMPLETED'].includes(String(existing.status))) error('REQUEST_LOCKED_BY_MATCH', 409);
  const pairKey = existing.requested_case_id ? await sha(`${actor.sub}:${existing.requested_case_id}`) : null;
  const now = iso();
  if (action === 'cancel') {
    const writes: Write[] = [
      writeUpdate(env, 'student_requests', requestId, { status: 'CANCELLED', updated_at: now }, existingDoc?.updateTime),
      audit(env, actor, 'STUDENT_REQUEST_CANCELLED', requestId),
    ];
    if (pairKey) writes.push(writeUpdate(env, 'student_case_requests', pairKey, { status: 'CANCELLED', updated_at: now }));
    await transaction(env, [], () => ({ result: true, writes }));
    return json({ data: { id: requestId, status: 'CANCELLED' } });
  }
  const patch: Record<string, unknown> = { updated_at: now };
  if (input.clinical_category_id !== undefined) patch.clinical_category_id = input.clinical_category_id ? String(input.clinical_category_id) : null;
  if (input.tooth_area !== undefined) patch.tooth_area = input.tooth_area ? String(input.tooth_area).slice(0, 500) : null;
  if (input.notes !== undefined) patch.notes = input.notes ? String(input.notes).slice(0, 2000) : null;
  if (Array.isArray(input.available_days)) patch.available_days = input.available_days.map(String).slice(0, 14);
  await transaction(env, [`student_requests/${requestId}`], (docs) => ({
    result: true,
    writes: [writeUpdate(env, 'student_requests', requestId, patch, docs[0]?.updateTime), audit(env, actor, 'STUDENT_REQUEST_UPDATED', requestId)],
  }));
  return json({ data: { ...existing, ...patch } });
};

const adminStatus = async (request: Request, env: Env, actor: Claims, collection: 'patient_cases' | 'student_requests') => {
  await requireRole(env, actor, ['ADMIN', 'SUPER_ADMIN']);
  const input = await parseBody(request);
  const itemId = String(input.case_id || input.request_id || '');
  const action = String(input.action || '');
  if (!itemId || !action) error('INVALID_OPERATION', 400);
  if (collection === 'patient_cases' && action === 'delete') {
    const doc = await getDoc(env, 'patient_cases', itemId);
    const current = fromDoc(doc) as Record<string, any> | null;
    if (!current) error('NOT_FOUND', 404);
    if (['MATCHED', 'IN_PROGRESS', 'COMPLETED'].includes(String(current.status))) error('CASE_HAS_ACTIVE_BOOKING', 409);
    await transaction(env, [`patient_cases/${itemId}`], () => ({
      result: true,
      writes: [writeDelete(env, 'patient_cases', itemId), audit(env, actor, 'PATIENT_CASE_DELETED', itemId)],
    }));
    return json({ id: itemId, deleted: true });
  }
  const next = collection === 'patient_cases'
    ? (action === 'hide' ? 'HIDDEN' : action === 'restore' || action === 'approve' ? 'WAITING_FOR_MATCH' : action === 'reject' ? 'REJECTED' : action === 'in_progress' ? 'IN_PROGRESS' : action === 'complete' ? 'COMPLETED' : action === 'cancel' ? 'CANCELLED' : '')
    : (action === 'approve' || action === 'verify' ? 'VERIFIED' : action === 'reject' ? 'REJECTED' : action === 'cancel' ? 'CANCELLED' : '');
  if (!next) error('INVALID_OPERATION', 400);
  const result = await transaction(env, [`${collection}/${itemId}`], (docs) => {
    const current = fromDoc(docs[0]) as Record<string, any> | null;
    if (!current) error('NOT_FOUND', 404);
    const allowed = collection === 'patient_cases'
      ? {
          PENDING: ['WAITING_FOR_MATCH', 'REJECTED', 'HIDDEN', 'CANCELLED'],
          NEW: ['WAITING_FOR_MATCH', 'REJECTED', 'HIDDEN', 'CANCELLED'],
          UNDER_REVIEW: ['WAITING_FOR_MATCH', 'REJECTED', 'HIDDEN', 'CANCELLED'],
          WAITING_FOR_MATCH: ['WAITING_FOR_MATCH', 'REJECTED', 'HIDDEN', 'CANCELLED'],
          REJECTED: ['WAITING_FOR_MATCH', 'HIDDEN'],
          HIDDEN: ['WAITING_FOR_MATCH'],
          MATCHED: ['IN_PROGRESS', 'COMPLETED', 'HIDDEN', 'CANCELLED'],
          IN_PROGRESS: ['COMPLETED', 'HIDDEN', 'CANCELLED'],
        }
      : {
          PENDING: ['VERIFIED', 'REJECTED', 'CANCELLED'],
          VERIFIED: ['REJECTED', 'CANCELLED'],
          REJECTED: ['VERIFIED'],
        };
    transition(String(current.status || 'PENDING'), next, allowed);
    const now = iso();
    const history = Array.isArray(current.status_history) ? [...current.status_history] : [];
    history.push({ status: next, action, actor_id: actor.sub, reason: input.reason ? String(input.reason).slice(0, 500) : null, at: now });
    const patch: Record<string, unknown> = {
      status: next,
      reviewed_by: actor.sub,
      reviewed_at: now,
      updated_at: now,
      status_history: history,
    };
    if (collection === 'patient_cases') {
      patch.is_approved_for_student_view = next === 'WAITING_FOR_MATCH';
    }
    if (next === 'REJECTED' || next === 'CANCELLED') {
      patch.rejection_reason = String(input.reason || '').slice(0, 500) || null;
    }
    return {
      result: { id: itemId, status: next, is_approved_for_student_view: patch.is_approved_for_student_view },
      writes: [
        writeUpdate(env, collection, itemId, patch, docs[0]?.updateTime),
        audit(env, actor, `${collection.toUpperCase()}_${next}`, itemId, { action, reason: patch.rejection_reason || null }),
      ],
    };
  });
  return json(result);
};

const searchCases = async (env: Env, actor: Claims) => {
  await requireRole(env, actor, ['STUDENT', 'ADMIN', 'SUPER_ADMIN']);
  const rows = await listDocs(env, 'patient_cases', [['is_approved_for_student_view', true]], 100);
  const available = rows.filter((row) => row.status === 'WAITING_FOR_MATCH' && row.is_approved_for_student_view === true);
  return json({
    data: available.map((row) => ({
      id: row.id,
      case_number: row.case_number,
      province_id: row.province_id,
      area_id: row.area_id,
      clinical_category_id: row.clinical_category_id || null,
      title: row.title || null,
      patient_age: row.patient_age,
      patient_gender: row.patient_gender,
      description: row.description,
      symptoms: row.symptoms,
      available_days: row.available_days,
      preferred_periods: row.preferred_periods,
      preferred_university_ids: row.preferred_university_ids || [],
      status: row.status,
      created_at: row.created_at,
    })),
  });
};

const myMatches = async (env: Env, actor: Claims) => {
  const profile = await requireRole(env, actor, ['STUDENT', 'PATIENT', 'ADMIN', 'SUPER_ADMIN']);
  const filterField = profile.role === 'STUDENT' ? 'student_id' : profile.role === 'PATIENT' ? 'patient_id' : '';
  const matches = filterField ? await listDocs(env, 'matches', [[filterField, actor.sub]], 50) : await listDocs(env, 'matches', [], 100);
  const enriched = await Promise.all(matches.map(async (item) => {
    const caseDoc = item.patient_case_id ? fromDoc(await getDoc(env, 'patient_cases', String(item.patient_case_id))) : null;
    const reqDoc = item.student_request_id ? fromDoc(await getDoc(env, 'student_requests', String(item.student_request_id))) : null;
    return {
      id: item.id,
      status: item.status,
      patient_case_id: item.patient_case_id,
      student_request_id: item.student_request_id,
      case_number: caseDoc?.case_number || null,
      case_description: caseDoc?.description || null,
      case_status: caseDoc?.status || null,
      request_number: reqDoc?.request_number || null,
      created_at: item.created_at,
      updated_at: item.updated_at,
      completed_at: item.completed_at || null,
    };
  }));
  return json({ data: enriched });
};

const match = async (request: Request, env: Env, actor: Claims) => {
  await requireRole(env, actor, ['ADMIN', 'SUPER_ADMIN']);
  const input = await parseBody(request);
  const caseId = String(input.case_id || ''), requestId = String(input.request_id || '');
  if (!caseId || !requestId) error('INVALID_OPERATION', 400);
  const idempotencyHeader = request.headers.get('Idempotency-Key')?.trim() || '';
  if (idempotencyHeader.length > 200) error('INVALID_IDEMPOTENCY_KEY', 400);
  const key = await sha(`${caseId}:${requestId}`);
  const idempotencyHash = idempotencyHeader ? await sha(idempotencyHeader) : '';
  const idempotencyPath = idempotencyHash ? `idempotency_keys/${idempotencyHash}` : null;
  const paths = [`patient_cases/${caseId}`, `student_requests/${requestId}`, `match_keys/${key}`, `case_locks/${caseId}`, ...(idempotencyPath ? [idempotencyPath] : [])];
  const result = await transaction(env, paths, (docs) => {
    const existingMatch = fromDoc(docs[2]) as Record<string, any> | null;
    const existingCaseLock = fromDoc(docs[3]) as Record<string, any> | null;
    const existingRequest = idempotencyPath ? fromDoc(docs[4]) as Record<string, any> | null : null;
    if (existingRequest && (existingRequest.patient_case_id !== caseId || existingRequest.student_request_id !== requestId)) error('IDEMPOTENCY_KEY_CONFLICT', 409);
    if (existingRequest) return { result: { match_id: existingRequest.match_id, status: existingRequest.status, idempotent: true }, writes: [] };
    if (existingMatch) {
      const writes = idempotencyPath ? [writeCreate(env, 'idempotency_keys', idempotencyHash, { match_id: existingMatch.match_id, patient_case_id: caseId, student_request_id: requestId, status: 'MATCHED', created_at: iso() })] : [];
      return { result: { match_id: existingMatch.match_id, status: 'MATCHED', idempotent: true }, writes };
    }
    const patientCase = fromDoc(docs[0]) as Record<string, any> | null, studentRequest = fromDoc(docs[1]) as Record<string, any> | null;
    if (!patientCase || !studentRequest) error('NOT_FOUND', 404);
    if (['MATCHED', 'IN_PROGRESS', 'COMPLETED'].includes(String(patientCase.status)) || (existingCaseLock && existingCaseLock.status === 'MATCHED' && existingCaseLock.student_request_id !== requestId)) {
      error('CASE_ALREADY_MATCHED', 409);
    }
    if (['MATCHED', 'COMPLETED'].includes(String(studentRequest.status))) {
      error('REQUEST_ALREADY_MATCHED', 409);
    }
    if (!['WAITING_FOR_MATCH', 'APPROVED'].includes(String(patientCase.status)) || patientCase.is_approved_for_student_view !== true || studentRequest.status !== 'VERIFIED') {
      error('INVALID_MATCH_STATE', 409);
    }
    if (studentRequest.requested_case_id && String(studentRequest.requested_case_id) !== caseId) {
      error('REQUEST_CASE_MISMATCH', 409);
    }
    const now = iso();
    const matchId = id();
    const fields = { id: matchId, patient_case_id: caseId, student_request_id: requestId, patient_id: patientCase.patient_id, student_id: studentRequest.student_id, status: 'MATCHED', created_at: now, updated_at: now, matched_by: actor.sub };
    const caseHistory = Array.isArray(patientCase.status_history) ? [...patientCase.status_history] : [];
    caseHistory.push({ status: 'MATCHED', actor_id: actor.sub, match_id: matchId, student_id: studentRequest.student_id, at: now });
    const lockWrite = docs[3]
      ? writeUpdate(env, 'case_locks', caseId, { match_id: matchId, patient_case_id: caseId, student_request_id: requestId, student_id: studentRequest.student_id, status: 'MATCHED', updated_at: now }, docs[3]?.updateTime)
      : writeCreate(env, 'case_locks', caseId, { match_id: matchId, patient_case_id: caseId, student_request_id: requestId, student_id: studentRequest.student_id, status: 'MATCHED', created_at: now, updated_at: now });
    const writes = [
      writeCreate(env, 'match_keys', key, { match_id: matchId, patient_case_id: caseId, student_request_id: requestId }),
      lockWrite,
      writeCreate(env, 'matches', matchId, fields),
      writeUpdate(env, 'patient_cases', caseId, { status: 'MATCHED', is_approved_for_student_view: false, matched_student_id: studentRequest.student_id, matched_request_id: requestId, match_id: matchId, status_history: caseHistory, updated_at: now }, docs[0]?.updateTime),
      writeUpdate(env, 'student_requests', requestId, { status: 'MATCHED', matched_case_id: caseId, match_id: matchId, updated_at: now }, docs[1]?.updateTime),
      audit(env, actor, 'CASE_MATCHED', matchId, { caseId, requestId, studentId: studentRequest.student_id, patientId: patientCase.patient_id }),
      ...(idempotencyPath ? [writeCreate(env, 'idempotency_keys', idempotencyHash, { match_id: matchId, patient_case_id: caseId, student_request_id: requestId, status: 'MATCHED', created_at: now })] : []),
    ];
    return { result: { match_id: matchId, status: 'MATCHED' }, writes };
  });
  return json({ match_id: result.match_id, status: result.status, data: result });
};

const complete = async (request: Request, env: Env, actor: Claims) => {
  await requireRole(env, actor, ['ADMIN', 'SUPER_ADMIN']);
  const input = await parseBody(request);
  const matchId = String(input.match_id || '');
  const action = String(input.action || 'complete');
  if (!matchId) error('INVALID_OPERATION', 400);
  const next = action === 'in_progress' ? 'IN_PROGRESS' : action === 'cancel' ? 'CANCELLED' : 'COMPLETED';
  const matchDoc = await getDoc(env, 'matches', matchId);
  const initialMatch = fromDoc(matchDoc) as Record<string, any> | null;
  if (!initialMatch) error('NOT_FOUND', 404);
  const caseId = String(initialMatch.patient_case_id || '');
  const reqId = String(initialMatch.student_request_id || '');
  const paths = [`matches/${matchId}`, ...(caseId ? [`patient_cases/${caseId}`, `case_locks/${caseId}`] : []), ...(reqId ? [`student_requests/${reqId}`] : [])];
  const result = await transaction(env, paths, (docs) => {
    const current = fromDoc(docs[0]) as Record<string, any> | null;
    if (!current) error('NOT_FOUND', 404);
    transition(String(current.status || 'MATCHED'), next, {
      MATCHED: ['MATCHED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
      IN_PROGRESS: ['IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
      COMPLETED: ['COMPLETED'],
      CANCELLED: ['CANCELLED'],
    });
    const now = iso();
    const writes: Write[] = [
      writeUpdate(env, 'matches', matchId, { status: next, ...(next === 'COMPLETED' ? { completed_by: actor.sub, completed_at: now } : {}), updated_at: now }),
      audit(env, actor, `TREATMENT_${next}`, matchId, { case_id: caseId, request_id: reqId }),
    ];
    if (caseId && docs[1]) {
      const currentCase = fromDoc(docs[1]) as Record<string, any> | null;
      const history = Array.isArray(currentCase?.status_history) ? [...currentCase.status_history] : [];
      const caseNext = next === 'CANCELLED' ? 'WAITING_FOR_MATCH' : next;
      history.push({ status: caseNext, actor_id: actor.sub, match_id: matchId, at: now });
      writes.push(writeUpdate(env, 'patient_cases', caseId, {
        status: caseNext,
        is_approved_for_student_view: next === 'CANCELLED',
        ...(next === 'CANCELLED' ? { matched_student_id: null, matched_request_id: null, match_id: null } : {}),
        ...(next === 'COMPLETED' ? { completed_at: now } : {}),
        status_history: history,
        updated_at: now,
      }));
    }
    if (caseId && docs[2]) {
      writes.push(writeUpdate(env, 'case_locks', caseId, { status: next, updated_at: now }));
    }
    const reqDocIndex = caseId ? 3 : 1;
    if (reqId && docs[reqDocIndex]) {
      writes.push(writeUpdate(env, 'student_requests', reqId, { status: next === 'CANCELLED' ? 'VERIFIED' : next, updated_at: now }));
    }
    return { result: { match_id: matchId, status: next, case_id: caseId, request_id: reqId }, writes };
  });
  return json({ match_id: matchId, status: next, case_id: caseId, request_id: reqId, result: result.result });
};

const canAccessCaseMedia = (profileDoc: Record<string, any> | null, caseDoc: Record<string, any> | null, actorSub: string): boolean => {
  if (!caseDoc) return false;
  if (profileDoc?.status === 'VERIFIED' && ['ADMIN', 'SUPER_ADMIN'].includes(String(profileDoc.role))) return true;
  if (caseDoc.patient_id === actorSub) return true;
  if (profileDoc?.status === 'VERIFIED' && profileDoc?.role === 'STUDENT' && caseDoc.matched_student_id === actorSub && ['MATCHED', 'IN_PROGRESS', 'COMPLETED'].includes(String(caseDoc.status))) return true;
  return false;
};

const storage = async (request: Request, env: Env, actor: Claims | null, url: URL) => {
  const operation = url.pathname.split('/').pop();
  if (operation === 'upload' && request.method === 'POST') {
    if (!actor) error('AUTH_REQUIRED', 401);
    checkRateLimit(request, 'storage_upload', 25, 60_000);
    const caseId = (url.searchParams.get('case_id') || '').trim();
    if (!caseId || caseId.includes('..') || caseId.includes('/') || caseId.includes('\\')) error('INVALID_PATH', 400);
    const current = fromDoc(await getDoc(env, 'patient_cases', caseId)) as Record<string, any> | null;
    const profileDoc = fromDoc(await getDoc(env, 'profiles', actor.sub)) as Record<string, any> | null;
    const isAdmin = profileDoc?.status === 'VERIFIED' && ['ADMIN', 'SUPER_ADMIN'].includes(String(profileDoc.role));
    if (!current || (current.patient_id !== actor.sub && !isAdmin)) error('FORBIDDEN', 403);
    const mime = (request.headers.get('Content-Type') || '').split(';')[0].trim();
    const rawBuffer = new Uint8Array(await request.arrayBuffer());
    const size = rawBuffer.byteLength;
    if (!['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(mime) || !Number.isSafeInteger(size) || size < 1 || size > 5 * 1024 * 1024) {
      error('INVALID_IMAGE', 400);
    }
    if (!hasValidMagicBytes(mime, rawBuffer)) {
      error('INVALID_IMAGE_FORMAT', 400);
    }
    const contentHash = await sha(base64Bytes(rawBuffer));
    const existingImages = await listDocs(env, 'case_images', [['case_id', caseId]], 50);
    const duplicate = existingImages.find((img) => img.content_sha256 === contentHash);
    if (duplicate) error('DUPLICATE_IMAGE_UPLOAD', 409);
    const imageId = id();
    const path = `cases/${caseId}/${imageId}`;
    const rawFileName = decodeURIComponent(request.headers.get('x-file-name') || 'medical-attachment').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
    const storageBackend = env.MEDICAL_IMAGES ? 'r2' : 'firestore_private';
    let chunkCount = 0;
    if (env.MEDICAL_IMAGES) {
      await env.MEDICAL_IMAGES.put(path, rawBuffer, { httpMetadata: { contentType: mime } });
    } else {
      const encoded = base64Bytes(rawBuffer);
      const chunkSize = 600_000;
      chunkCount = Math.ceil(encoded.length / chunkSize);
      for (let idx = 0; idx < chunkCount; idx += 1) {
        const chunkData = encoded.slice(idx * chunkSize, (idx + 1) * chunkSize);
        const savedChunk = await firestore(env, `/private_medical_chunks/${encodeURIComponent(`${imageId}_${idx}`)}`, {
          method: 'PATCH',
          body: JSON.stringify({ fields: { image_id: fs(imageId), case_id: fs(caseId), chunk_index: fs(idx), data: fs(chunkData), created_at: fs(iso()) } }),
        });
        if (!savedChunk.ok) error('PRIVATE_STORAGE_WRITE_FAILED', 503);
      }
    }
    try {
      await transaction(env, [], () => ({
        result: imageId,
        writes: [
          writeCreate(env, 'case_images', imageId, {
            id: imageId,
            case_id: caseId,
            patient_id: current.patient_id,
            uploaded_by: actor.sub,
            storage_path: path,
            storage_backend: storageBackend,
            chunk_count: chunkCount,
            content_sha256: contentHash,
            file_name: rawFileName,
            mime_type: mime,
            size,
            is_approved_for_student_view: false,
            created_at: iso(),
          }),
          audit(env, actor, 'CASE_IMAGE_UPLOADED', imageId, { case_id: caseId, mime_type: mime, size }),
        ],
      }));
    } catch (e) {
      if (env.MEDICAL_IMAGES) await env.MEDICAL_IMAGES.delete(path);
      throw e;
    }
    const exp = Math.floor(Date.now() / 1000) + 300;
    const token = await signStorageToken(env, { img: imageId, path, sub: actor.sub, exp });
    return json({
      image_id: imageId,
      path,
      mime_type: mime,
      size,
      signed_url: `${url.origin}/api/storage/download?path=${encodeURIComponent(path)}&token=${encodeURIComponent(token)}`,
      expires_at: new Date(exp * 1000).toISOString(),
    }, 201);
  }

  if (operation === 'signed-url' && request.method === 'POST') {
    if (!actor) error('AUTH_REQUIRED', 401);
    const input = await parseBody(request);
    const requestedPath = String(input.path || '').trim();
    const requestedImageId = String(input.image_id || '').trim();
    if ((requestedPath && (requestedPath.includes('..') || requestedPath.includes('\\'))) || (requestedImageId && (requestedImageId.includes('..') || requestedImageId.includes('/')))) {
      error('INVALID_PATH', 400);
    }
    const image = requestedImageId
      ? fromDoc(await getDoc(env, 'case_images', requestedImageId))
      : (await listDocs(env, 'case_images', [['storage_path', requestedPath]], 1))[0];
    if (!image) error('NOT_FOUND', 404);
    const current = fromDoc(await getDoc(env, 'patient_cases', String(image.case_id))) as Record<string, any> | null;
    const profileDoc = fromDoc(await getDoc(env, 'profiles', actor.sub)) as Record<string, any> | null;
    if (!canAccessCaseMedia(profileDoc, current, actor.sub)) error('FORBIDDEN', 403);
    const rawTtl = input.ttl_seconds !== undefined ? Number(input.ttl_seconds) : 300;
    const ttl = Number.isFinite(rawTtl) ? Math.max(-3600, Math.min(300, Math.floor(rawTtl))) : 300;
    const exp = Math.floor(Date.now() / 1000) + ttl;
    const token = await signStorageToken(env, { img: image.id, path: image.storage_path, sub: actor.sub, exp });
    return json({
      image_id: image.id,
      path: image.storage_path,
      signed_url: `${url.origin}/api/storage/download?path=${encodeURIComponent(String(image.storage_path))}&token=${encodeURIComponent(token)}`,
      expires_at: new Date(exp * 1000).toISOString(),
    });
  }

  if (operation === 'list' && request.method === 'GET') {
    if (!actor) error('AUTH_REQUIRED', 401);
    const caseId = (url.searchParams.get('case_id') || '').trim();
    if (!caseId || caseId.includes('..') || caseId.includes('/')) error('INVALID_PATH', 400);
    const current = fromDoc(await getDoc(env, 'patient_cases', caseId)) as Record<string, any> | null;
    const profileDoc = fromDoc(await getDoc(env, 'profiles', actor.sub)) as Record<string, any> | null;
    if (!canAccessCaseMedia(profileDoc, current, actor.sub)) error('FORBIDDEN', 403);
    const images = await listDocs(env, 'case_images', [['case_id', caseId]], 50);
    const exp = Math.floor(Date.now() / 1000) + 300;
    const data = await Promise.all(images.map(async (img) => {
      const token = await signStorageToken(env, { img: img.id, path: img.storage_path, sub: actor.sub, exp });
      return {
        id: img.id,
        case_id: img.case_id,
        storage_path: img.storage_path,
        file_name: img.file_name || 'medical-image',
        mime_type: img.mime_type,
        size: img.size,
        created_at: img.created_at,
        signed_url: `${url.origin}/api/storage/download?path=${encodeURIComponent(String(img.storage_path))}&token=${encodeURIComponent(token)}`,
        expires_at: new Date(exp * 1000).toISOString(),
      };
    }));
    return json({ data });
  }

  if (operation === 'download' && request.method === 'GET') {
    const path = (url.searchParams.get('path') || '').trim();
    const signedToken = (url.searchParams.get('token') || '').trim();
    if (!path || path.includes('..') || path.includes('\\')) error('INVALID_PATH', 400);
    let effectiveSub = actor?.sub || '';
    if (signedToken) {
      const tokenPayload = await verifyStorageToken(env, signedToken);
      if (tokenPayload.path !== path) error('INVALID_SIGNED_URL', 403);
      if (actor && actor.sub !== tokenPayload.sub) error('FORBIDDEN', 403);
      effectiveSub = String(tokenPayload.sub || '');
    } else if (!actor) {
      error('AUTH_REQUIRED', 401);
    }
    const image = (await listDocs(env, 'case_images', [['storage_path', path]], 1))[0];
    if (!image) error('NOT_FOUND', 404);
    const current = fromDoc(await getDoc(env, 'patient_cases', String(image.case_id))) as Record<string, any> | null;
    const profileDoc = fromDoc(await getDoc(env, 'profiles', effectiveSub)) as Record<string, any> | null;
    if (!canAccessCaseMedia(profileDoc, current, effectiveSub)) error('FORBIDDEN', 403);
    if (image.storage_backend === 'r2' && env.MEDICAL_IMAGES) {
      const object = await env.MEDICAL_IMAGES.get(path);
      if (!object) error('NOT_FOUND', 404);
      return new Response(object.body, { headers: { 'content-type': image.mime_type || 'application/octet-stream', 'cache-control': 'private, no-store, no-cache, must-revalidate', 'x-content-type-options': 'nosniff' } });
    }
    const chunkCount = Number(image.chunk_count || 1);
    let encoded = '';
    for (let idx = 0; idx < chunkCount; idx += 1) {
      const chunkDoc = fromDoc(await getDoc(env, 'private_medical_chunks', `${image.id}_${idx}`));
      if (!chunkDoc?.data) error('NOT_FOUND', 404);
      encoded += String(chunkDoc.data);
    }
    const bytes = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
    return new Response(bytes, { headers: { 'content-type': image.mime_type || 'application/octet-stream', 'cache-control': 'private, no-store, no-cache, must-revalidate', 'x-content-type-options': 'nosniff' } });
  }

  if (operation === 'remove' && request.method === 'POST') {
    if (!actor) error('AUTH_REQUIRED', 401);
    const input = await parseBody(request);
    const paths = Array.isArray(input.paths) ? input.paths.map(String).slice(0, 20) : [];
    const profileDoc = fromDoc(await getDoc(env, 'profiles', actor.sub)) as Record<string, any> | null;
    for (const path of paths) {
      if (path.includes('..') || path.includes('\\')) error('INVALID_PATH', 400);
      const image = (await listDocs(env, 'case_images', [['storage_path', path]], 1))[0];
      const caseDoc = image ? fromDoc(await getDoc(env, 'patient_cases', String(image.case_id))) as Record<string, any> | null : null;
      const allowed = (profileDoc?.status === 'VERIFIED' && ['ADMIN', 'SUPER_ADMIN'].includes(String(profileDoc.role))) || caseDoc?.patient_id === actor.sub;
      if (!allowed) error('FORBIDDEN', 403);
      if (image?.storage_backend === 'r2' && env.MEDICAL_IMAGES) {
        await env.MEDICAL_IMAGES.delete(path);
      } else if (image?.id) {
        const count = Number(image.chunk_count || 1);
        for (let idx = 0; idx < count; idx += 1) {
          await firestore(env, `/private_medical_chunks/${encodeURIComponent(`${image.id}_${idx}`)}`, { method: 'DELETE' });
        }
      }
      if (image?.id) {
        const deleted = await firestore(env, `/case_images/${encodeURIComponent(String(image.id))}`, { method: 'DELETE' });
        if (!deleted.ok && deleted.status !== 404) error('FIRESTORE_DELETE_FAILED', 503);
      }
    }
    return json({ removed: paths.length });
  }
  error('NOT_FOUND', 404);
};

const publicMedia = async (request: Request, env: Env, actor: Claims, url: URL) => {
  await requireRole(env, actor, ['ADMIN', 'SUPER_ADMIN']);
  if (request.method === 'GET') {
    const rows = await listDocs(env, 'public_media_assets', [], 200);
    const data = await Promise.all(rows.map(async (row) => { const references = await listPublicMediaReferences(env, row); return { ...row, references, in_use: references.length > 0 }; }));
    return json({ data });
  }
  const input = await parseBody(request); const operation = String(input.operation || 'upload');
  if (operation === 'link' || operation === 'unlink') return json({ data: await updatePublicMediaReference(env, actor, input, operation === 'link') });
  if (operation === 'delete') {
    const mediaId = String(input.media_id || ''); const record = fromDoc(await getDoc(env, 'public_media_assets', mediaId)) as Record<string, any> | null;
    if (!record?.path || !record.github_sha || !record.public_url) error('MEDIA_NOT_FOUND', 404);
    const references = await listPublicMediaReferences(env, record);
    if (references.length) { const failure = new Error('MEDIA_IN_USE') as ApiError & { details?: unknown }; failure.code = 'MEDIA_IN_USE'; failure.status = 409; failure.details = references; throw failure; }
    await githubContents(env, String(record.path), { method: 'DELETE', body: JSON.stringify({ message: `Delete public staging media ${mediaId}`, sha: record.github_sha }) });
    const deleted = await firestore(env, `/public_media_assets/${encodeURIComponent(mediaId)}`, { method: 'DELETE' }); if (!deleted.ok && deleted.status !== 404) error('MEDIA_METADATA_DELETE_FAILED', 503);
    return json({ ok: true, media_id: mediaId });
  }
  if (!['upload', 'replace'].includes(operation)) error('INVALID_OPERATION', 400);
  const mime = String(input.mime_type || ''); const allowed = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
  if (!allowed.includes(mime) || typeof input.base64 !== 'string') error('INVALID_PUBLIC_MEDIA', 400);
  let bytes: Uint8Array; try { bytes = Uint8Array.from(atob(input.base64), (c) => c.charCodeAt(0)); } catch { error('INVALID_PUBLIC_MEDIA', 400); }
  const max = Math.min(8 * 1024 * 1024, Number(env.PUBLIC_MEDIA_MAX_BYTES || 5 * 1024 * 1024)); if (!bytes.length || bytes.length > max) error('PUBLIC_MEDIA_TOO_LARGE', 400);
  const existingId = operation === 'replace' ? String(input.media_id || '') : ''; const existing = existingId ? fromDoc(await getDoc(env, 'public_media_assets', existingId)) as Record<string, any> | null : null;
  if (operation === 'replace' && (!existing?.path || !existing.github_sha || !existing.public_url)) error('MEDIA_NOT_FOUND', 404);
  const mediaId = existingId || id(); const extension = mime === 'image/svg+xml' ? 'svg' : mime.split('/')[1]; const safeName = String(input.file_name || 'image').replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 80);
  const path = operation === 'replace' ? String(existing.path) : `public/${new Date().toISOString().slice(0, 10)}/${mediaId}-${safeName}.${extension}`;
  const created = await githubContents(env, path, { method: 'PUT', body: JSON.stringify({ message: `${operation === 'replace' ? 'Replace' : 'Add'} public staging media ${mediaId}`, content: base64Bytes(bytes), ...(operation === 'replace' ? { sha: existing.github_sha } : {}) }) });
  const publicUrl = `https://raw.githubusercontent.com/${env.GITHUB_ASSET_REPOSITORY}/${created.commit.sha}/${path}`;
  const metadata: Record<string, unknown> = { id: mediaId, path, github_sha: created.content.sha, commit_sha: created.commit.sha, public_url: publicUrl, mime_type: mime, bytes: bytes.length, section_key: String(input.section_key || existing?.section_key || ''), university_id: String(input.university_id || existing?.university_id || ''), alt_text: String(input.alt_text || existing?.alt_text || ''), updated_by: actor.sub, updated_at: iso() };
  if (operation === 'upload') Object.assign(metadata, { created_by: actor.sub, created_at: iso() });
  const saved = await firestore(env, `/public_media_assets/${encodeURIComponent(mediaId)}`, { method: 'PATCH', body: JSON.stringify({ fields: Object.fromEntries(Object.entries(metadata).map(([key, value]) => [key, fs(value)])) }) });
  if (!saved.ok) { if (operation === 'upload') await githubContents(env, path, { method: 'DELETE', body: JSON.stringify({ message: `Rollback public staging media ${mediaId}`, sha: created.content.sha }) }); error('MEDIA_METADATA_WRITE_FAILED', 503); }
  if (operation === 'replace' && existing?.public_url && existing.public_url !== publicUrl) {
    const references = await listPublicMediaReferences(env, existing);
    for (const reference of references) {
      const fields = { [reference.field]: fs(publicUrl), [mediaIdField(reference.field)]: fs(mediaId), updated_at: fs(iso()) };
      const updated = await firestore(env, `/${reference.collection}/${encodeURIComponent(reference.document_id)}?${firestoreUpdateMask(Object.keys(fields))}`, { method: 'PATCH', body: JSON.stringify({ fields }) });
      if (!updated.ok) error('MEDIA_REFERENCE_UPDATE_FAILED', 503);
    }
  }
  return json({ media_id: mediaId, public_url: publicUrl, mime_type: mime, bytes: bytes.length, operation }, operation === 'upload' ? 201 : 200);
};

const route = async (request: Request, env: Env, actor: Claims | null, url: URL) => {
  const name = url.pathname.replace(/^\/api\//, '');
  if (name === 'registration-request' && request.method === 'POST') return registrationRequest(request, env);
  if (name === 'auth/login' && request.method === 'POST') return phoneLogin(request, env);
  if (url.pathname.startsWith('/api/storage/')) return storage(request, env, actor, url);
  if (!actor) error('AUTH_REQUIRED', 401);
  if (name === 'profile-update' && request.method === 'POST') return profileUpdate(request, env, actor);
  if (name === 'registration-admin') return adminRegistration(request, env, actor);
  if (name === 'admin-user-update' && request.method === 'POST') return adminUserUpdate(request, env, actor);
  if (name === 'manager-invite') return managerInvite(request, env, actor);
  if (name === 'manager-update') return managerUpdate(request, env, actor);
  if (name === 'manager-accept' && request.method === 'POST') return managerAccept(request, env, actor);
  if (name === 'create_patient_case') return createEntity(request, env, actor, 'case');
  if (name === 'patient-case-update' && request.method === 'POST') return patientCaseUpdate(request, env, actor);
  if (name === 'create_student_request') return createEntity(request, env, actor, 'student');
  if (name === 'student-request-update' && request.method === 'POST') return studentRequestUpdate(request, env, actor);
  if (name === 'search_anonymized_patient_cases') return searchCases(env, actor);
  if (name === 'my-matches') return myMatches(env, actor);
  if (name === 'case-approval') return adminStatus(request, env, actor, 'patient_cases');
  if (name === 'student-request-review') return adminStatus(request, env, actor, 'student_requests');
  if (name === 'match') return match(request, env, actor);
  if (name === 'complete-treatment') return complete(request, env, actor);
  if (name === 'public-media') return publicMedia(request, env, actor, url);
  if (name === 'audit-logs' && request.method === 'GET') { await requireRole(env, actor, ['ADMIN', 'SUPER_ADMIN']); return json({ data: await listDocs(env, 'audit_logs', [], 200) }); }
  error('NOT_FOUND', 404);
};

export default {
  async fetch(request: Request, env: Env) {
    const headers = cors(request, env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    try {
      const url = new URL(request.url);
      if (url.pathname === '/health') return json({ ok: true, environment: env.FIREBASE_PROJECT_ID?.includes('prod') ? 'production' : 'staging', productionWrites: Boolean(env.FIREBASE_PROJECT_ID?.includes('prod')), version: 'registration-approval-matching-v1', releaseSha: env.RELEASE_SHA || 'unknown' }, 200, headers);
      if (!url.pathname.startsWith('/api/')) return json({ error: 'NOT_FOUND' }, 404, headers);
      const publicRoute = url.pathname === '/api/registration-request' || url.pathname === '/api/auth/login';
      const optionalAuthRoute = url.pathname === '/api/storage/download';
      const actor = publicRoute ? null : optionalAuthRoute && !tokenFrom(request) ? null : await verifyIdToken(request, env);
      const response = await route(request, env, actor, url);
      Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
      return response;
    } catch (e) {
      const item = e as ApiError & { details?: unknown };
      return json({ error: item.code || 'INTERNAL_ERROR', message: item.code || 'INTERNAL_ERROR', ...(item.details ? { details: item.details } : {}) }, item.status || 500, headers);
    }
  },
};
