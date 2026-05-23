# Elmaghraby Tracing — مواصفات المشروع (مصدر الحقيقة)

> أي شات (Cursor / Codex) يقرأ هذا الملف أولاً قبل كتابة كود.

## الهدف

ERP خفيف لتتبع **الشحنات والاستيراد** — عربي RTL — أونلاين (Supabase) — Web أولاً.

## Stack

| الطبقة | التقنية |
|--------|---------|
| Frontend | Next.js 15 (App Router) + TypeScript + Tailwind + shadcn/ui |
| Data | Supabase (Postgres + Auth + Storage + Realtime) |
| State | TanStack Query v5 |
| Forms | React Hook Form + Zod |
| Excel | SheetJS (xlsx) |
| PDF | Phase 1: print CSS — Phase 2: PDF file download |
| Desktop لاحقاً | Tauri 2 (WebView → نفس URL) |
| Mobile | Responsive + PWA |

## قواعد البيانات (إلزامية)

1. **الشحنة مركز النظام** — كل شيء يتبع `shipments`.
2. **`products` بدون `supplier_id`** — المورد من `shipments.supplier_id` فقط.
3. **حالات الشحنة (3 + مغلقة):**
   - `in_sea` — في البحر (افتراضي عند الإنشاء)
   - `customs` — في الجمارك
   - `closed` — مغلقة (بعد إدخال المصاريف)
4. **انتقال تلقائي:** `in_sea` → `customs` عند `today >= eta` أو `today >= shipped_at + duration_days`.
5. **زر "التالي"** بجانب الحالة: بحر→جمارك، جمارك→شاشة مصاريف، مغلقة→تعديل مصاريف فقط.
6. **التعديل مسموح بعد الإغلاق** (خصوصاً المصاريف) + `audit_log`.
7. **تواريخ:** عرض وإدخال `YYYY-MM-DD`.
8. **رقم شحنة تلقائي:** `SH-{YEAR}-{4 digits}`.

## جداول Supabase (أساسية)

- `profiles` (role: admin | manager | viewer)
- `companies`, `suppliers`, `products` (بدون supplier_id)
- `shipments`, `shipment_containers`, `shipment_products`
- `container_files` (bucket: `container-files`, private)
- `shipment_costs` (1:1 مع الشحنة عند الإغلاق)
- `shipment_documents`, `shipment_timeline_events`, `audit_log`

## shipment_costs (حقول)

- customs_cost, shipping_cost, clearance_cost, local_transport_cost, other_expenses
- total_cost (محسوب)
- closing_notes, closed_by, closed_at

## Workflow شحنة جديدة

- **صفحة واحدة** (ليس wizard 4 خطوات): بيانات + حاويات + منتجات.
- زر **"+ منتج جديد"** → Dialog سريع (اسم، SKU، تصنيف) بدون مغادرة الصفحة.
- بعد الحفظ → `/shipments/[id]`.

## UI

- RTL 100%، حالات بالعربي فقط.
- شكل قريب من V2 القديم: cards، btn teal `#0f766e` أو navy `#1e4d7b`.
- مرجع UX قديم: `d:\shiping\tracking-system-v2\frontend\src\pages\`.

## تقارير (17) — انظر `docs/PHASES.md` Phase 3–4

- Excel: `.xlsx` حقيقي (SheetJS)
- PDF: طباعة RTL Phase 1

## أمان

- RLS على كل الجداول
- لا service role في المتصفح

## أوامر التحقق (بعد كل مرحلة)

```bash
npm run type-check
npm run lint
npm run build
```

## مشروع قديم (مرجع فقط — لا تعديل)

- المسار: `d:\shiping\tracking-system-v2`
- Laravel + React Vite — **لا تنسخ المعمارية** — UX وأزرار فقط.
