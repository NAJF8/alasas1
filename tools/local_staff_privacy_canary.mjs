import crypto from 'node:crypto'
const secret = process.env.LOCAL_JWT_SECRET
if (!secret) throw new Error('LOCAL_JWT_SECRET is required')
const base = 'http://127.0.0.1:55421'
const b64 = (value) => Buffer.from(value).toString('base64url')
const token = (role) => { const now = Math.floor(Date.now() / 1000); const h = b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' })); const p = b64(JSON.stringify({ iss: 'supabase', ref: 'local', role, aud: role === 'anon' ? 'anon' : 'authenticated', iat: now, exp: now + 3600 })); return `${h}.${p}.${crypto.createHmac('sha256', secret).update(`${h}.${p}`).digest('base64url')}` }
const service = token('service_role')
const anon = token('anon')
const email = `staff-canary-${Date.now()}@example.invalid`
const password = 'StaffCanary#2026'
const createdResponse = await fetch(`${base}/auth/v1/admin/users`, { method: 'POST', headers: { apikey: service, authorization: `Bearer ${service}`, 'content-type': 'application/json' }, body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { full_name: 'Synthetic Staff Canary' } }) })
const created = await createdResponse.json()
if (!createdResponse.ok || !created.id) throw new Error(`create failed ${createdResponse.status}`)
const update = await fetch(`${base}/rest/v1/profiles?id=eq.${created.id}`, { method: 'PATCH', headers: { apikey: service, authorization: `Bearer ${service}`, 'content-type': 'application/json', prefer: 'return=minimal' }, body: JSON.stringify({ role: 'STAFF', status: 'VERIFIED' }) })
if (!update.ok) throw new Error(`staff profile update failed ${update.status}`)
const login = await fetch(`${base}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: anon, 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) })
const session = await login.json()
if (!login.ok || !session.access_token) throw new Error(`staff sign-in failed ${login.status}`)
const headers = { apikey: anon, authorization: `Bearer ${session.access_token}` }
const direct = await fetch(`${base}/rest/v1/profiles?select=id,full_name,role,status,phone,whatsapp,birth_date&limit=100`, { headers })
const directBody = await direct.json()
const others = directBody.filter((row) => row.id !== created.id)
const directory = await fetch(`${base}/rest/v1/rpc/list_profiles_for_admin`, { method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: '{}' })
const directoryBody = await directory.json()
if (!direct.ok || others.length !== 0) throw new Error(`direct STAFF access leaked rows: ${JSON.stringify(directBody)}`)
if (!directory.ok || !Array.isArray(directoryBody) || directoryBody.some((row) => row.phone !== null)) throw new Error(`limited directory failed: ${JSON.stringify(directoryBody)}`)
console.log(JSON.stringify({ status: 'PASS', direct_profile_rows: directBody.length, direct_other_rows: others.length, directory_rows: directoryBody.length, directory_phone_values: directoryBody.filter((row) => row.phone !== null).length }))
