# Elmaghraby Tracing

نظام ERP خفيف لتتبع الشحنات والاستيراد، عربي RTL، مبني بـ Next.js وSupabase.

## Stack

- Next.js 16 App Router + TypeScript + Tailwind
- Supabase Auth + Postgres + RLS + Realtime + Storage
- SheetJS `xlsx` لتصدير التقارير
- PWA manifest جاهز
- Desktop عبر Tauri (غلاف لنفس رابط الويب الأونلاين) — انظر [docs/DEPLOY.md](docs/DEPLOY.md)

## قواعد لا تكسر

- الشحنة هي مركز النظام.
- `products` بدون `supplier_id`.
- حالات الشحنة فقط: `in_sea`, `customs`, `closed`.
- المورد يأتي من `shipments.supplier_id`.
- التاريخ يعرض ويدخل بصيغة `YYYY-MM-DD`.

## التشغيل المحلي

```bash
npm install
copy .env.example .env.local
npm run dev
```

افتح:

```text
http://localhost:3000
```

## إعداد Supabase

1. أنشئ مشروع Supabase.
2. انسخ القيم من Project Settings > API إلى `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

3. شغل migrations من `supabase/migrations/` بالترتيب في SQL Editor:

```text
20260522000001_initial_schema.sql
20260522000002_storage_policies.sql
20260522000003_phase1_status_rpc.sql
20260522000004_phase2_daily_ops.sql
20260522000005_production_indexes_grants.sql
20260522000006_phase7_admin_settings.sql
20260522000007_product_categories.sql
20260522000008_ensure_profile.sql
```

   أو من الطرفية (بعد إضافة `SUPABASE_DB_PASSWORD` في `.env.local` من إعدادات Database):

   ```bash
   node scripts/apply-migrations.mjs 20260522000007_product_categories.sql
   ```

4. تأكد أن bucket باسم `container-files` موجود وخاص.
5. أنشئ مستخدمين من Supabase Auth. الدور الافتراضي `viewer`، وللكتابة عدل `profiles.role` إلى `admin` أو `manager`.

   لترقية أول مدير (يحتاج `SUPABASE_SERVICE_ROLE_KEY` في `.env.local`):

   ```bash
   node scripts/promote-admin.mjs your-email@example.com
   ```

## الصفحات

- `/login` تسجيل الدخول
- `/` لوحة التحكم
- `/shipments` قائمة الشحنات
- `/shipments/new` إنشاء شحنة كاملة
- `/shipments/[id]` تفاصيل الشحنة، حاويات، منتجات، ملفات، مصاريف، Timeline
- `/products` المنتجات
- `/products/search` بحث المنتجات الذكي
- `/suppliers` الموردين
- `/companies` شركات الاستيراد
- `/reports` التقارير
- `/reports/[slug]` تفاصيل التقرير + Excel + طباعة PDF

## أوامر التحقق

```bash
npm run type-check
npm run lint
npm test
npm run build
```

اختبارات الواجهة (smoke):

```bash
npm run test:e2e
```

## النشر والديسكتوب

- **رابط أونلاين للفريق:** انشر على Vercel وشارك الرابط — [docs/DEPLOY.md](docs/DEPLOY.md)
- **تطبيق Windows:** بعد النشر، `npm run desktop:build` → ملف `.exe` في `src-tauri/target/release/bundle/nsis/`

## ملاحظات إنتاج

- لا تستخدم service role في المتصفح.
- راجع سياسات RLS بعد إضافة أي جدول جديد.
- عيّن `CRON_SECRET` — بدونها endpoint مزامنة السفن يرفض الطلبات.
- التقارير تطبع PDF من المتصفح باستخدام print CSS.
- `xlsx` قد يظهر في `npm audit` بسبب تحذيرات معروفة؛ راجع قرار الترقية بعناية قبل تغيير المكتبة.
