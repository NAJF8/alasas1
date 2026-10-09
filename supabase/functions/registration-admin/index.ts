import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const allowedOrigin = Deno.env.get('ALLOWED_ORIGIN') || 'https://alasas.tech'
const cors = { 'Access-Control-Allow-Origin': allowedOrigin, 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const whatsapp = (phone: string, name: string) => {
  const text = `أهلاً وسهلاً بك، ${name} 🌷\n\nيسعدنا الترحيب بك في عيادات الأساس لرعاية الأسنان 🦷\n\nتمت الموافقة المبدئية على طلب تسجيلك.\n\nلإكمال تفعيل حسابك، يرجى اتباع تعليمات التحقق التي ستصلك من الإدارة.\n\n🌐 https://alasas.tech\n\nفريق عيادات الأساس 💙`
  return `https://wa.me/${phone.replace('+', '')}?text=${encodeURIComponent(text)}`
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const authorization = request.headers.get('Authorization')
    if (!authorization?.startsWith('Bearer ')) return json({ error: 'جلسة مدير مطلوبة.' }, 401)
    const url = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } })
    const adminClient = createClient(url, serviceKey)
    const { data: userData, error: userError } = await userClient.auth.getUser()
    if (userError || !userData.user) return json({ error: 'تعذر التحقق من الجلسة.' }, 401)
    const { data: actor } = await adminClient.from('profiles').select('role,status').eq('id', userData.user.id).single()
    if (!actor || !['ADMIN', 'SUPER_ADMIN', 'STAFF'].includes(actor.role) || actor.status !== 'VERIFIED') return json({ error: 'لا تملك صلاحية إدارة طلبات التسجيل.' }, 403)
    const body = await request.json() as { action?: string; request_id?: string; reason?: string }
    if (body.action === 'list') {
      const { data, error } = await adminClient.from('registration_requests').select('id,full_name,phone_e164,role,gender,province_id,university_id,stage,status,rejection_reason,reviewed_at,created_at').order('created_at', { ascending: false }).limit(100)
      if (error) return json({ error: 'تعذر تحميل الطلبات.' }, 500)
      return json({ requests: data || [] })
    }
    if (!body.request_id || !['approve', 'reject'].includes(body.action || '')) return json({ error: 'عملية غير صحيحة.' }, 400)
    const nextStatus = body.action === 'approve' ? 'VERIFIED' : 'REJECTED'
    const { data: current } = await adminClient.from('registration_requests').select('id,status,full_name,phone_e164').eq('id', body.request_id).single()
    if (!current || current.status !== 'PENDING') return json({ error: 'الطلب غير موجود أو تمت معالجته سابقاً.' }, 409)
    const { data: updated, error } = await adminClient.from('registration_requests').update({ status: nextStatus, rejection_reason: nextStatus === 'REJECTED' ? (body.reason || null) : null, reviewed_by: userData.user.id, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', body.request_id).eq('status', 'PENDING').select('id,status,reviewed_at').single()
    if (error || !updated) return json({ error: 'فشل حفظ القرار.' }, 500)
    await adminClient.from('registration_audit_logs').insert({ registration_request_id: current.id, actor_id: userData.user.id, action: body.action === 'approve' ? 'APPROVED' : 'REJECTED', reason: body.reason || null })
    return json({ request_id: updated.id, status: updated.status, reviewed_at: updated.reviewed_at, activation: 'PENDING_VERIFICATION', whatsapp_url: nextStatus === 'VERIFIED' ? whatsapp(current.phone_e164, current.full_name) : null })
  } catch (error) {
    console.error('registration-admin', error)
    return json({ error: 'تعذر إكمال العملية.' }, 500)
  }
})
