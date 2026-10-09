import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const allowedOrigin = Deno.env.get('ALLOWED_ORIGIN') || 'https://alasas.tech'
const cors = { 'Access-Control-Allow-Origin': allowedOrigin, 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const normalizePhone = (value: string) => {
  const digits = value.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[^0-9]/g, '')
  if (digits.startsWith('00964')) return `+${digits.slice(2)}`
  if (digits.startsWith('964')) return `+${digits}`
  if (digits.startsWith('07')) return `+964${digits.slice(1)}`
  if (digits.startsWith('7')) return `+964${digits}`
  return ''
}

const bytesToBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes))
const hashPin = async (pin: string) => {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 600_000 }, key, 256)
  return `pbkdf2-sha256$600000$${bytesToBase64(salt)}$${bytesToBase64(new Uint8Array(bits))}`
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (request.method !== 'POST') return json({ error: 'طريقة الطلب غير مدعومة.' }, 405)
  try {
    const body = await request.json() as Record<string, unknown>
    const fullName = String(body.full_name || '').trim()
    const phone = normalizePhone(String(body.phone || ''))
    const role = body.role === 'STUDENT' ? 'STUDENT' : body.role === 'PATIENT' ? 'PATIENT' : ''
    const gender = body.gender === 'MALE' || body.gender === 'FEMALE' ? body.gender : ''
    const pin = String(body.pin || '')
    const pinConfirmation = String(body.pin_confirmation || '')
    const provinceId = body.province_id ? String(body.province_id) : null
    const universityId = body.university_id ? String(body.university_id) : null
    const stage = body.stage ? String(body.stage).trim() : null
    if (fullName.length < 2 || fullName.length > 160 || !/^\+9647[0-9]{9}$/.test(phone) || !role || !gender || !/^\d{6}$/.test(pin) || pin !== pinConfirmation || (role === 'STUDENT' && (!universityId || !stage))) {
      return json({ error: 'بيانات التسجيل غير مكتملة أو غير صحيحة.' }, 400)
    }
    const url = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const adminClient = createClient(url, serviceKey)
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${phone}|${ip}|${Deno.env.get('RATE_LIMIT_SECRET') || 'missing'}`))
    const rateKey = `registration:${bytesToBase64(new Uint8Array(digest))}`
    const { data: allowed, error: limitError } = await adminClient.rpc('consume_registration_rate_limit', { p_rate_key: rateKey, p_limit: 5, p_window_seconds: 3600 })
    if (limitError || allowed !== true) return json({ error: 'تم تجاوز عدد المحاولات. حاول لاحقاً.' }, 429)
    const pinHash = await hashPin(pin)
    const { data: row, error } = await adminClient.from('registration_requests').insert({ full_name: fullName, phone_e164: phone, role, gender, province_id: provinceId, university_id: universityId, stage, pin_hash: pinHash }).select('id,status,created_at').single()
    if (error) return json({ error: error.code === '23505' ? 'يوجد طلب فعال لهذا الرقم.' : 'تعذر حفظ طلب التسجيل.' }, 400)
    await adminClient.from('registration_audit_logs').insert({ registration_request_id: row.id, action: 'SUBMITTED', metadata: { role } })
    return json({ request_id: row.id, status: row.status, created_at: row.created_at, message: 'تم إرسال طلب تسجيلك، يرجى انتظار موافقة الإدارة.' }, 201)
  } catch (error) {
    console.error('registration-request', error)
    return json({ error: 'تعذر إكمال طلب التسجيل.' }, 500)
  }
})
