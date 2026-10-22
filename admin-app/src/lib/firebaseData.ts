// Firebase-only data access for the Admin app.
// @ts-nocheck
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, limit as limitQuery, orderBy, query, serverTimestamp, updateDoc, where, type QueryConstraint } from 'firebase/firestore';
import { getIdToken } from 'firebase/auth';
import { apiBaseUrl, auth, db } from './firebase';

type Result<T> = { data: T; error: { message: string; code?: string } | null; count?: number | null };
const fail = <T>(error: unknown): Result<T> => ({ data: null as T, error: { message: error instanceof Error ? error.message : String(error) } });
const clean = (value: any): any => value && typeof value.toDate === 'function' ? value.toDate().toISOString() : Array.isArray(value) ? value.map(clean) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clean(item)])) : value;
const map = (snapshot: any) => ({ id: snapshot.id, ...clean(snapshot.data()) });

class ReadQuery implements PromiseLike<Result<any>> {
  private constraints: QueryConstraint[] = [];
  private fields: string[] | null = null;
  private mode: 'single' | 'maybeSingle' | null = null;
  private counted = false;
  constructor(private readonly table: string) {}
  select(fields?: string, options?: { count?: string; head?: boolean }) { this.fields = fields ? fields.split(',').map((value) => value.trim()) : null; this.counted = Boolean(options?.count); return this; }
  eq(field: string, value: any) { this.constraints.push(where(field, '==', value)); return this; }
  in(field: string, values: any[]) { this.constraints.push(where(field, 'in', values)); return this; }
  gte(field: string, value: any) { this.constraints.push(where(field, '>=', value)); return this; }
  lt(field: string, value: any) { this.constraints.push(where(field, '<', value)); return this; }
  order(field: string, options?: { ascending?: boolean }) { this.constraints.push(orderBy(field, options?.ascending === false ? 'desc' : 'asc')); return this; }
  limit(value: number) { this.constraints.push(limitQuery(value)); return this; }
  single() { this.mode = 'single'; return this; }
  maybeSingle() { this.mode = 'maybeSingle'; return this; }
  async run(): Promise<Result<any>> {
    try {
      const snapshot = await getDocs(query(collection(db, this.table), ...this.constraints));
      const rows = snapshot.docs.map(map).map((row: any) => this.fields ? Object.fromEntries(this.fields.map((field) => [field, row[field]]).concat([['id', row.id]])) : row);
      if (this.counted) return { data: null, error: null, count: snapshot.size };
      if (this.mode === 'single' && rows.length !== 1) return fail(new Error(rows.length ? 'Expected one document.' : 'Document not found.'));
      if (this.mode === 'maybeSingle' && rows.length > 1) return fail(new Error('Expected zero or one document.'));
      return { data: this.mode ? rows[0] || null : rows, error: null };
    } catch (error) { return fail(error); }
  }
  then<TResult1 = Result<any>, TResult2 = never>(onfulfilled?: ((value: Result<any>) => TResult1 | PromiseLike<TResult1>) | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null) { return this.run().then(onfulfilled || undefined, onrejected || undefined); }
}

const authHeaders = async () => { const token = auth.currentUser ? await getIdToken(auth.currentUser, true) : null; return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' }; };
export const callBackend = async <T = any>(path: string, body?: unknown): Promise<T> => { const response = await fetch(`${apiBaseUrl}${path}`, { method: body === undefined ? 'GET' : 'POST', headers: await authHeaders(), body: body === undefined ? undefined : JSON.stringify(body) }); const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.message || data.error || `Backend request failed (${response.status})`); return data as T; };

const storageApi = { from: (bucket: string) => ({ upload: async (path: string, file: File) => { try { const token = auth.currentUser ? await getIdToken(auth.currentUser, true) : ''; const response = await fetch(`${apiBaseUrl}/api/storage/upload?bucket=${encodeURIComponent(bucket)}&case_id=${encodeURIComponent(path.split('/')[1] || '')}`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': file.type, 'x-file-size': String(file.size) }, body: file }); if (!response.ok) throw new Error(`Upload failed (${response.status})`); const result = await response.json() as { path?: string }; return { data: { path: result.path || path }, error: null }; } catch (error) { return { data: null, error: { message: error instanceof Error ? error.message : String(error) } }; } }, remove: async (paths: string[]) => { try { await callBackend('/api/storage/remove', { bucket, paths }); return { data: null, error: null }; } catch (error) { return { data: null, error: { message: error instanceof Error ? error.message : String(error) } }; } }, getPublicUrl: (path: string) => ({ data: { publicUrl: path } }) }) };
const listManagers = async () => { const result = await new ReadQuery('profiles').select('*').in('role', ['ADMIN', 'SUPER_ADMIN', 'STAFF']); if (result.error) throw new Error(result.error.message); return (result.data || []).map((row: any) => ({ profile_id: row.id, email: row.email || null, full_name: row.full_name || '', role: row.role, status: row.status, created_at: row.created_at, last_sign_in_at: row.last_sign_in_at || null, permissions: row.permissions || [] })); };
const listInvitations = async () => { const result = await new ReadQuery('manager_invitations').select('*').order('created_at', { ascending: false }).limit(100); if (result.error) throw new Error(result.error.message); return (result.data || []).map((row: any) => ({ invitation_id: row.id, ...row })); };
const rpc = async <T = any>(name: string, args: any = {}) => {
  try {
    if (name === 'search_anonymized_patient_cases') return { data: await callBackend<T>('/api/search_anonymized_patient_cases', args), error: null };
    if (name === 'admin_list_managers') return { data: await listManagers(), error: null };
    if (name === 'admin_list_manager_invitations') return { data: await listInvitations(), error: null };
    if (name === 'admin_create_manager_invitation') return { data: await callBackend<T>('/api/manager-invite', { email: args.email, role: args.role, permissions: args.permissions }), error: null };
    if (name === 'admin_update_manager') return { data: await callBackend<T>('/api/manager-update', { profile_id: args.p_profile_id, role: args.p_role, status: args.p_status, permissions: args.p_permissions }), error: null };
    throw new Error(`Firebase Worker route not implemented: ${name}`);
  } catch (error) { return { data: null, error: { message: error instanceof Error ? error.message : String(error) } }; }
};

export const firebaseData: any = {
  storage: storageApi,
  from(table: string) {
    return {
      select: (fields?: string, options?: any) => new ReadQuery(table).select(fields, options),
      insert: (payload: any) => ({ select: () => ({ single: async () => { try { const reference = await addDoc(collection(db, table), { ...payload, created_at: payload.created_at || serverTimestamp(), updated_at: serverTimestamp() }); const snapshot = await getDoc(reference); return { data: snapshot.exists() ? map(snapshot) : null, error: null }; } catch (error) { return fail(error); } } }) }),
      update: (payload: any) => { let current = new ReadQuery(table); const mutation: any = { eq: (field: string, value: any) => { current = current.eq(field, value); return mutation; }, select: () => mutation, single: async () => { const found = await current; if (found.error || !found.data?.[0]) return fail(found.error || new Error('Document not found.')); await updateDoc(doc(db, table, found.data[0].id), { ...payload, updated_at: serverTimestamp() }); const updated = await getDoc(doc(db, table, found.data[0].id)); return { data: updated.exists() ? map(updated) : null, error: null }; } }; return mutation; },
      delete: () => { let current = new ReadQuery(table); const mutation: any = { eq: (field: string, value: any) => { current = current.eq(field, value); return mutation; }, then: async (onfulfilled?: any, onrejected?: any) => { try { const found = await current; for (const row of found.data || []) await deleteDoc(doc(db, table, row.id)); return onfulfilled?.({ data: null, error: null }); } catch (error) { return onrejected?.(error); } } }; return mutation; },
    };
  },
  rpc,
  functions: { invoke: async <T = any>(name: string, options?: { body?: unknown }) => { const routes: Record<string, string> = { 'admin-invite-manager': '/api/manager-invite', 'registration-admin': '/api/registration-admin', 'case-approval': '/api/case-approval', 'student-request-review': '/api/student-request-review', match: '/api/match', 'complete-treatment': '/api/complete-treatment' }; return routes[name] ? { data: await callBackend<T>(routes[name], options?.body), error: null } : rpc<T>(name, options?.body); } },
};
