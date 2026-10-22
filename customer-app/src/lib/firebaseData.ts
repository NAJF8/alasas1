import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, limit as limitQuery, orderBy, query, serverTimestamp, updateDoc, where, type DocumentData, type QueryConstraint } from 'firebase/firestore';
import { getIdToken } from 'firebase/auth';
import { apiBaseUrl, auth, db } from './firebase';

type Result<T> = { data: T; error: { message: string; code?: string } | null; count?: number | null };
const errorResult = <T>(error: unknown): Result<T> => ({ data: null as T, error: { message: error instanceof Error ? error.message : String(error) } });
const clean = (value: unknown): any => value && typeof value === 'object' && 'toDate' in (value as object) ? (value as { toDate: () => Date }).toDate().toISOString() : Array.isArray(value) ? value.map(clean) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, clean(v)])) : value;
const mapDoc = (snapshot: { id: string; data: () => DocumentData }) => ({ id: snapshot.id, ...clean(snapshot.data()) });

class ReadQuery implements PromiseLike<Result<any>> {
  private constraints: QueryConstraint[] = [];
  private selected: string[] | null = null;
  private countOnly = false;
  private singleMode: 'single' | 'maybeSingle' | null = null;
  constructor(private readonly table: string) {}
  select(fields?: string, options?: { count?: string; head?: boolean }) { this.selected = fields ? fields.split(',').map((field) => field.trim()) : null; this.countOnly = Boolean(options?.count); return this; }
  eq(field: string, value: unknown) { this.constraints.push(where(field, '==', value)); return this; }
  in(field: string, values: unknown[]) { this.constraints.push(where(field, 'in', values)); return this; }
  gte(field: string, value: unknown) { this.constraints.push(where(field, '>=', value)); return this; }
  lt(field: string, value: unknown) { this.constraints.push(where(field, '<', value)); return this; }
  order(field: string, options?: { ascending?: boolean }) { this.constraints.push(orderBy(field, options?.ascending !== false ? 'asc' : 'desc')); return this; }
  limit(value: number) { this.constraints.push(limitQuery(value)); return this; }
  single() { this.singleMode = 'single'; return this; }
  maybeSingle() { this.singleMode = 'maybeSingle'; return this; }
  async execute(): Promise<Result<any>> { try { const snapshot = await getDocs(query(collection(db, this.table), ...this.constraints)); const rows = snapshot.docs.map(mapDoc).map((row) => this.selected ? Object.fromEntries(this.selected.map((field) => [field, row[field]]).concat([['id', row.id]])) : row); if (this.countOnly) return { data: null, error: null, count: snapshot.size }; if (this.singleMode === 'single' && rows.length !== 1) return errorResult(new Error(rows.length ? 'Expected one document.' : 'Document not found.')); if (this.singleMode === 'maybeSingle' && rows.length > 1) return errorResult(new Error('Expected zero or one document.')); return { data: this.singleMode ? (rows[0] || null) : rows, error: null }; } catch (error) { return errorResult(error); } }
  then<TResult1 = Result<any>, TResult2 = never>(onfulfilled?: ((value: Result<any>) => TResult1 | PromiseLike<TResult1>) | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null): Promise<TResult1 | TResult2> { return this.execute().then(onfulfilled || undefined, onrejected || undefined); }
}

class MutationQuery implements PromiseLike<Result<any>> {
  private returnSelected = false;
  private singleMode: 'single' | 'maybeSingle' | null = null;
  constructor(private readonly operation: () => Promise<string[]>) {}
  select() { this.returnSelected = true; return this; }
  single() { this.singleMode = 'single'; return this; }
  maybeSingle() { this.singleMode = 'maybeSingle'; return this; }
  async execute(): Promise<Result<any>> { try { const ids = await this.operation(); if (!this.returnSelected) return { data: null, error: null }; const rows = await Promise.all(ids.map(async (id) => { const snap = await getDoc(doc(db, id.split('/')[0], id.split('/')[1])); return snap.exists() ? mapDoc(snap) : null; })); const data = rows.filter(Boolean); if (this.singleMode === 'single' && data.length !== 1) return errorResult(new Error('Mutation readback did not return one document.')); return { data: this.singleMode ? (data[0] || null) : data, error: null }; } catch (error) { return errorResult(error); } }
  then<TResult1 = Result<any>, TResult2 = never>(onfulfilled?: ((value: Result<any>) => TResult1 | PromiseLike<TResult1>) | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null): Promise<TResult1 | TResult2> { return this.execute().then(onfulfilled || undefined, onrejected || undefined); }
}

const pathFor = (table: string, id: string) => `${table}/${id}`;
const withTimestamps = (table: string, payload: Record<string, unknown>) => ({ ...payload, ...(table === 'patient_cases' ? { status: payload.status || 'PENDING', case_number: payload.case_number || `CASE-${Date.now().toString(36).toUpperCase()}` } : {}), ...(table === 'student_requests' ? { status: payload.status || 'PENDING', request_number: payload.request_number || `REQ-${Date.now().toString(36).toUpperCase()}` } : {}), created_at: payload.created_at || serverTimestamp(), updated_at: serverTimestamp() });
const authHeaders = async (): Promise<Record<string, string>> => { const token = auth.currentUser ? await getIdToken(auth.currentUser, true) : null; return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' }; };
export const callBackend = async <T = any>(path: string, body?: unknown): Promise<T> => { const response = await fetch(`${apiBaseUrl}${path}`, { method: body === undefined ? 'GET' : 'POST', headers: await authHeaders(), body: body === undefined ? undefined : JSON.stringify(body) }); const result = await response.json().catch(() => ({})); if (!response.ok) throw new Error(result.message || result.error || `Backend request failed (${response.status})`); return result as T; };

const storageApi = { from: (bucket: string) => ({ upload: async (path: string, file: File) => { try { const token = auth.currentUser ? await getIdToken(auth.currentUser, true) : ''; const caseId = path.split('/')[1] || ''; const response = await fetch(`${apiBaseUrl}/api/storage/upload?bucket=${encodeURIComponent(bucket)}&case_id=${encodeURIComponent(caseId)}`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': file.type, 'x-file-size': String(file.size) }, body: file }); if (!response.ok) throw new Error(`Upload failed (${response.status})`); const result = await response.json() as { path?: string }; return { data: { path: result.path || path }, error: null }; } catch (error) { return { data: null, error: { message: error instanceof Error ? error.message : String(error) } }; } }, remove: async (paths: string[]) => { try { await callBackend('/api/storage/remove', { bucket, paths }); return { data: null, error: null }; } catch (error) { return { data: null, error: { message: error instanceof Error ? error.message : String(error) } }; } }, download: async (path: string) => { try { const token = auth.currentUser ? await getIdToken(auth.currentUser, true) : ''; const response = await fetch(`${apiBaseUrl}/api/storage/download?bucket=${encodeURIComponent(bucket)}&path=${encodeURIComponent(path)}`, { headers: { Authorization: `Bearer ${token}` } }); if (!response.ok) throw new Error(`Download failed (${response.status})`); return { data: await response.blob(), error: null }; } catch (error) { return { data: null, error: { message: error instanceof Error ? error.message : String(error) } }; } } }) };
export const firebaseData: any = {
  storage: storageApi,
  from(table: string) {
    return {
      select: (fields?: string, options?: { count?: string; head?: boolean }) => new ReadQuery(table).select(fields, options),
      insert: (payload: Record<string, unknown> | Record<string, unknown>[]) => new MutationQuery(async () => { const rows = Array.isArray(payload) ? payload : [payload]; const ids: string[] = []; for (const row of rows) { const reference = await addDoc(collection(db, table), withTimestamps(table, row)); ids.push(pathFor(table, reference.id)); } return ids; }),
      update: (payload: Record<string, unknown>) => { let queryBuilder = new ReadQuery(table); const mutation = { eq: (field: string, value: unknown) => { queryBuilder = queryBuilder.eq(field, value); return mutation; }, select: () => new MutationQuery(async () => { const result = await queryBuilder; if (result.error) throw new Error(result.error.message); const ids = (result.data || []).map((row: any) => pathFor(table, row.id)); for (const id of ids) await updateDoc(doc(db, id.split('/')[0], id.split('/')[1]), { ...payload, updated_at: serverTimestamp() }); return ids; }), then: (a?: any, b?: any) => mutation.select().then(a, b) }; return mutation; },
      delete: () => { let queryBuilder = new ReadQuery(table); const mutation = { eq: (field: string, value: unknown) => { queryBuilder = queryBuilder.eq(field, value); return mutation; }, then: (a?: any, b?: any) => new MutationQuery(async () => { const result = await queryBuilder; if (result.error) throw new Error(result.error.message); const ids = (result.data || []).map((row: any) => pathFor(table, row.id)); for (const id of ids) await deleteDoc(doc(db, id.split('/')[0], id.split('/')[1])); return ids; }).then(a, b) }; return mutation; },
    };
  },
  auth: { currentUser: auth.currentUser, onAuthStateChange: (_callback: (event: string, user: any) => void) => ({ data: { subscription: { unsubscribe: () => undefined } } }) },
  rpc: <T = any>(name: string, args?: unknown) => callBackend<T>(`/api/${name}`, args).then((data) => ({ data, error: null })).catch((error) => ({ data: null, error: { message: error.message } })),
  functions: { invoke: async <T = any>(name: string, options?: { body?: unknown }) => { try { return { data: await callBackend<T>(`/api/${name}`, options?.body), error: null }; } catch (error) { return { data: null, error: { message: error instanceof Error ? error.message : String(error) } }; } } },
};
