import crypto from 'node:crypto'

const secret = process.env.LOCAL_JWT_SECRET
if (!secret) throw new Error('LOCAL_JWT_SECRET is required')
const base = 'http://127.0.0.1:55421'
const b64 = (value) => Buffer.from(value).toString('base64url')
const token = (role, sub = undefined) => {
  const now = Math.floor(Date.now() / 1000)
  const payload = { iss: 'supabase', ref: 'local', role, aud: role === 'anon' ? 'anon' : 'authenticated', iat: now, exp: now + 3600 }
  if (sub) payload.sub = sub
  const head = b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = b64(JSON.stringify(payload))
  const signature = crypto.createHmac('sha256', secret).update(`${head}.${body}`).digest('base64url')
  return `${head}.${body}.${signature}`
}
const service = token('service_role')
const email = `restore-canary-${Date.now()}@example.invalid`
const password = 'RestoreCanary#2026'
const create = await fetch(`${base}/auth/v1/admin/users`, {
  method: 'POST',
  headers: { apikey: service, authorization: `Bearer ${service}`, 'content-type': 'application/json' },
  body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { role: 'PATIENT', full_name: 'Synthetic Restore Canary', phone: '+9647700000000', whatsapp: '+9647700000000' } }),
})
const created = await create.json()
if (!create.ok || !created.id) throw new Error(`admin create failed ${create.status}: ${JSON.stringify(created)}`)
const login = await fetch(`${base}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: { apikey: token('anon'), 'content-type': 'application/json' },
  body: JSON.stringify({ email, password }),
})
const session = await login.json()
if (!login.ok || !session.access_token) throw new Error(`password sign-in failed ${login.status}: ${JSON.stringify(session)}`)
const userToken = session.access_token
const profile = await fetch(`${base}/rest/v1/profiles?select=id,role,status,full_name,phone&id=eq.${created.id}`, {
  headers: { apikey: token('anon'), authorization: `Bearer ${userToken}` },
})
const profileBody = await profile.json()
if (!profile.ok || profileBody.length !== 1 || profileBody[0].id !== created.id || profileBody[0].role !== 'PATIENT') {
  throw new Error(`profile readback failed ${profile.status}: ${JSON.stringify(profileBody)}`)
}
console.log(JSON.stringify({
  status: 'PASS',
  auth_user_created: true,
  profile_created: true,
  profile_readback: true,
  synthetic_email: email,
  profile_fields: Object.keys(profileBody[0]),
}))
