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
const hmacRateKey = async (value: string, secret: string) => {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value))
  return `registration:${bytesToBase64(new Uint8Array(digest))}`
}
const hashPassword = async (password: string) => {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
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
    const password = String(body.password || '')
    const passwordConfirmation = String(body.password_confirmation || '')
    const provinceId = body.province_id ? String(body.province_id) : null
    const universityId = body.university_id ? String(body.university_id) : null
    const stage = body.stage ? String(body.stage).trim() : null
    const weakPasswords = new Set(['password', 'password1', 'password123', 'qwerty', 'qwerty123', 'letmein', 'welcome', 'admin123', 'iloveyou', 'abc12345', '12345678', '123456789', '1234567890'])
    const loweredPassword = password.toLowerCase()
    const passwordIsWeak = password.length < 8 || password.length > 128 || weakPasswords.has(loweredPassword) || !/[A-Za-z]/.test(password) || !/[^A-Za-z]/.test(password) || /^([a-z0-9!@#$%^&*])\1+$/.test(loweredPassword)
    if (fullName.length < 2 || fullName.length > 160 || !/^\+9647[0-9]{9}$/.test(phone) || !role || !gender || !provinceId || passwordIsWeak || password !== passwordConfirmation || (role === 'STUDENT' && (!universityId || !stage))) {
      return json({ error: 'بيانات التسجيل غير مكتملة أو غير صحيحة.' }, 400)
    }
    const url = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const adminClient = createClient(url, serviceKey)
    const { data: province } = await adminClient.from('provinces').select('id').eq('id', provinceId).eq('is_active', true).maybeSingle()
    if (!province) return json({ error: 'المحافظة غير متاحة للتسجيل حالياً.' }, 400)
    if (role === 'STUDENT') {
      const { data: university } = await adminClient.from('universities').select('id,province_id').eq('id', universityId).eq('is_active', true).maybeSingle()
      if (!university || (university.province_id && university.province_id !== provinceId)) return json({ error: 'الجامعة غير متاحة مع المحافظة المختارة.' }, 400)
    }
    const rateSecret = Deno.env.get('RATE_LIMIT_SECRET')
    if (!rateSecret || rateSecret.length < 32) return json({ error: 'خدمة التسجيل غير مهيأة بأمان.' }, 503)
    const phoneRateKey = await hmacRateKey(`phone:${phone}`, rateSecret)
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const ipRateKey = await hmacRateKey(`ip:${ip}`, rateSecret)
    const phoneLimit = await adminClient.rpc('consume_registration_rate_limit', { p_rate_key: phoneRateKey, p_limit: 5, p_window_seconds: 3600 })
    const ipLimit = await adminClient.rpc('consume_registration_rate_limit', { p_rate_key: ipRateKey, p_limit: 20, p_window_seconds: 3600 })
    if (phoneLimit.error || ipLimit.error || phoneLimit.data !== true || ipLimit.data !== true) return json({ error: 'تم تجاوز عدد المحاولات. حاول لاحقاً.' }, 429)
    const passwordHash = await hashPassword(password)
    const { data: row, error } = await adminClient.rpc('create_registration_request', { p_full_name: fullName, p_phone_e164: phone, p_role: role, p_gender: gender, p_province_id: provinceId, p_university_id: universityId, p_stage: stage, p_password_hash: passwordHash })
    if (error || !row?.[0]) return json({ error: error?.code === '23505' ? 'يوجد طلب فعال لهذا الرقم.' : 'تعذر حفظ طلب التسجيل.' }, 400)
    const saved = row[0]
    return json({ request_id: saved.id, status: saved.status, created_at: saved.created_at, message: 'تم إرسال طلب تسجيلك، يرجى انتظار موافقة الإدارة.' }, 201)
  } catch (error) {
    console.error('registration-request', error)
    return json({ error: 'تعذر إكمال طلب التسجيل.' }, 500)
  }
})
