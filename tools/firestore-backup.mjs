import { mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';

const project = process.env.FIRESTORE_PROJECT_ID || 'al-asas-dental-staging';
const database = process.env.FIRESTORE_DATABASE_ID || '(default)';
const outputDir = resolve(process.env.FIRESTORE_BACKUP_DIR || join(process.cwd(), '_backups', `firestore-${new Date().toISOString().replaceAll(':', '').replaceAll('.', '-')}`));
const base = `https://firestore.googleapis.com/v1/projects/${project}/databases/${encodeURIComponent(database)}/documents`;
const token = process.env.FIRESTORE_ACCESS_TOKEN || execFileSync('gcloud.cmd', ['auth', 'print-access-token'], { encoding: 'utf8', shell: process.platform === 'win32' }).trim();

const get = async (url, init = {}) => {
  const response = await fetch(url, { ...init, headers: { Authorization: `Bearer ${token}`, ...(init.headers || {}) } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${response.status} ${url} ${JSON.stringify(body)}`);
  return body;
};
const listCollectionIds = async () => (await get(`${base}:listCollectionIds`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ parent: `projects/${project}/databases/${database}/documents`, pageSize: 300 }) })).collectionIds || [];
const listDocuments = async (collectionId) => {
  const all = [];
  let pageToken = '';
  do {
    const q = new URLSearchParams({ pageSize: '300', showMissing: 'false' });
    if (pageToken) q.set('pageToken', pageToken);
    const body = await get(`${base}/${collectionId}?${q}`);
    all.push(...(body.documents || []));
    pageToken = body.nextPageToken || '';
  } while (pageToken);
  return all;
};

await mkdir(outputDir, { recursive: true });
const collectionIds = (await listCollectionIds()).sort();
const documents = [];
for (const collectionId of collectionIds) documents.push(...await listDocuments(collectionId));
documents.sort((a, b) => a.name.localeCompare(b.name));
const generatedAt = new Date().toISOString();
const serialized = JSON.stringify({ project, database, generatedAt, collectionIds, documents }, null, 2);
const sha256 = createHash('sha256').update(serialized).digest('hex');
await writeFile(join(outputDir, 'firestore-backup.json'), serialized, 'utf8');
await writeFile(join(outputDir, 'manifest.json'), JSON.stringify({ project, database, generatedAt, documentCount: documents.length, collectionCount: collectionIds.length, sha256, backupScope: 'all top-level Firestore collections and documents; database has no nested collection inventory in this backup path', file: 'firestore-backup.json' }, null, 2), 'utf8');
console.log(JSON.stringify({ outputDir, project, database, collectionCount: collectionIds.length, documentCount: documents.length, sha256 }, null, 2));
