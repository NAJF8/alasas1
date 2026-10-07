# منصة أسنان الأساس - Asnan Al-Asas

تم بناء المنصة كمشروعين منفصلين (Monorepo-style) لضمان الأمان وقابلية التوسع، وهما يتشاركان نفس قاعدة البيانات (Supabase).

## بنية المشروع

1. **`customer-app/`**: واجهة المرضى والطلاب/الأطباء.
   - مبني باستخدام React + Vite + TypeScript + Tailwind CSS.
   - يدعم RTL بشكل كامل بخطوط عربية (IBM Plex Sans Arabic / Tajawal).
   - يحتوي على معالج (Wizard) لرفع حالات المرضى، وصفحة للطلاب للبحث عن الحالات بدون بيانات شخصية.

2. **`admin-app/`**: لوحة تحكم الإدارة.
   - مبني باستخدام نفس التقنيات، مخصص لإدارة المنصة.
   - يحتوي على إحصائيات، إدارة الحالات، والتحكم بالمطابقات بين الطلاب والمرضى.

3. **`supabase_schema.sql`**: ملف يحتوي على تصميم قاعدة البيانات (الجداول والعلاقات) ليتم تنفيذه في Supabase.

## طريقة التشغيل محلياً

### 1. تطبيق العملاء (المرضى والطلاب)
```bash
cd customer-app
npm install
npm run dev
```
سيعمل التطبيق عادة على `http://localhost:5173`

### 2. لوحة تحكم الإدارة
```bash
cd admin-app
npm install
npm run dev
```
سيعمل التطبيق عادة على منفذ آخر مثل `http://localhost:5174`

## إعداد قاعدة البيانات (Supabase)

1. قم بإنشاء مشروع جديد في [Supabase](https://supabase.com/).
2. انسخ محتوى الملف `supabase_schema.sql` وقم بتشغيله في نافذة **SQL Editor** داخل Supabase لإنشاء الجداول.
3. انسخ `Project URL` و `anon key` من إعدادات Supabase.
4. قم بإنشاء ملف `.env.local` في مجلد `customer-app` ومجلد `admin-app` كالتالي:

```env
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## المطابقة الذكية (AI Matching) و WhatsApp

- **المطابقة الذكية**: تم تصميم الجداول لتخزين الـ Tags ونسبة المطابقة التي سيتم توليدها عبر **Edge Functions** في Supabase (حتى لا يتم فضح مفتاح الـ API في الواجهة الأمامية).
- **إشعارات WhatsApp**: ستتم أيضاً عن طريق الـ Backend/Edge Functions استجابة لتغير حالات الطلبات في قاعدة البيانات (مثل تحول `match_status` إلى `POTENTIAL`).
- **الخصوصية (RLS)**: يجب تفعيل سياسات Row Level Security في Supabase لضمان عدم رؤية الطالب لبيانات المريض الشخصية أبداً، حيث يتم ذلك حالياً عن طريق جلب البيانات المرئية للطلاب فقط (العمر، المحافظة، الأعراض) بدون معلومات الاتصال.
