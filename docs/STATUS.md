# حالة التنفيذ

> آخر تحديث: 2026-07-14

## المرحلة الحالية

**مكتمل — أمان + إعادة تصميم UI + طبقة اختبارات**

## ما تم إنجازه

- [x] إصلاحات أمنية: `CRON_SECRET` deny-by-default، `require_customs_document`، RLS/redirect للمورد
- [x] Design system + AppShell مجمّع + Dashboard / Shipments / تفاصيل الشحنة
- [x] لمسة بصرية موحّدة (تقارير، فورم شحنة، Login tokens)
- [x] Vitest + Playwright smoke + GitHub Actions CI

## التحقق

```bash
npm run type-check
npm run lint
npm test
npm run build
# اختياري:
npm run test:e2e
```

## ملاحظات

- عيّن `CRON_SECRET` في بيئة التشغيل قبل استدعاء `GET /api/vessel-tracking/sync`
- طبّق migration: `supabase/migrations/20260714000001_restrict_supplier_ops_read.sql`
- لـ E2E المسجّل: `E2E_EMAIL` + `E2E_PASSWORD`
