# منصة أسنان الأساس — AL ASAS Dental

مشروعان React 19 + Vite + TypeScript يتشاركان نفس الواجهة الخلفية:

- **`customer-app/`**: واجهة المرضى والطلبة (RTL عربي).
- **`admin-app/`**: لوحة تحكم الإدارة.
- **`worker/`**: Cloudflare Worker (`alasas-dental-prod-worker`) — يتحقق من Firebase ID tokens، ويكتب إلى Firestore بحساب الخدمة، ويدير الصور الطبية (R2) والوسائط العامة.
- **`firestore.rules` / `firestore.indexes.json`**: قواعد وفهارس Firestore.

> انتقل المشروع من Supabase إلى Firebase + Cloudflare Worker. ملفات `supabase/` و`supabase_*.sql` تاريخية فقط ولا تُستخدم في التشغيل.

## الإعداد المحلي

لا توجد قيم افتراضية للإنتاج: يجب ضبط متغيرات البيئة صراحة، وإلا يفشل التطبيق عند التحميل.

```bash
cd customer-app   # أو admin-app
cp .env.example .env.local   # قيم staging
npm ci
npm run dev
```

المتغيرات المطلوبة: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`, `VITE_FIREBASE_BACKEND_URL`.

## الاختبارات

```bash
cd worker && npm ci && npm test && npm run typecheck
cd customer-app && npm ci && npm run lint && npm run test:registration   # وبقية سكربتات test:*
cd admin-app && npm ci && npm run lint && npm run test:management-display
```

## أسرار الـ Worker (Cloudflare secrets)

- `FIREBASE_SERVICE_ACCOUNT_JSON` — حساب خدمة المشروع.
- `STORAGE_TOKEN_SECRET` — سر عشوائي (32 حرفًا على الأقل) لتوقيع روابط تحميل الصور الطبية. بدونه تفشل التنزيلات الموقعة بـ 503 (fail-closed).

```bash
openssl rand -base64 48 | npx wrangler secret put STORAGE_TOKEN_SECRET --config wrangler.prod.toml
```

## النشر

- النشر إلى الإنتاج يدوي فقط (`deploy-pages.yml` عبر `workflow_dispatch`) بعد المراجعة.
- تغييرات الـ Worker: `npx wrangler deploy --config wrangler.prod.toml` بعد ضبط الأسرار.
- قواعد Firestore: `firebase deploy --only firestore:rules --project al-asas-dental-prod`.
- اتبع `AGENTS.md`: فرع staging وPR قابل للمراجعة لأي تغيير جوهري.
