# خطة المراحل — Elmaghraby Tracing

> حدّث `docs/STATUS.md` بعد كل مرحلة.  
> لأي مساعد AI: نفّذ **مرحلة واحدة فقط** ثم توقف وحدّث STATUS.

---

## نظرة عامة

| المرحلة | الاسم | الهدف | توكن تقريبي |
|---------|-------|--------|-------------|
| 0 | تأسيس | SPEC + مشروع فارغ + DB | 30–80k |
| 1 | أساس التشغيل | دخول + شحنات CRUD + حالات | 150–400k |
| 2 | تشغيل يومي | حاويات، منتجات، مصاريف، أزرار | 150–350k |
| 3 | تقارير أساسية | 8 تقارير + Excel + طباعة | 100–250k |
| 4 | تقارير وبيانات | باقي التقارير + ملفات | 100–250k |
| 5 | إنتاج | RLS كامل، أداء، PWA، Tauri | 50–200k |

**المجموع التقريبي:** 600k – 1.5M عبر عدة جلسات.

---

## المرحلة 0 — تأسيس

### المخرجات
- [ ] `package.json` + Next.js + Tailwind + shadcn + RTL
- [ ] `supabase/migrations/001_initial_schema.sql`
- [ ] RLS policies أساسية + Storage bucket `container-files`
- [ ] `.env.example`
- [ ] `docs/STATUS.md` مُحدَّث

### لا تفعل في Phase 0
- صفحات تقارير كاملة
- Tauri

### Prompt جاهز (Cursor / Codex)
```
اقرأ docs/PROJECT_SPEC.md و docs/PHASES.md.
نفّذ المرحلة 0 فقط في d:\elmaghraby-tracing:
- أنشئ Next.js 15 App Router + TypeScript + Tailwind RTL (dir=rtl, font Cairo).
- أضف supabase/migrations للجداول والـ 3 حالات.
- لا تبني صفحات business بعد.
شغّل: npm run type-check && npm run lint && npm run build
حدّث docs/STATUS.md.
```

---

## المرحلة 1 — أساس التشغيل

### المخرجات
- [ ] Supabase Auth (login)
- [ ] Layout: Sidebar يمين + Top bar (شكل قريب من V2)
- [ ] `/` Dashboard بسيط (KPI: في البحر، جمارك، مغلقة)
- [ ] `/shipments` قائمة + فلاتر + **زر التالي** + badge عربي
- [ ] `/shipments/new` صفحة واحدة (بيانات أساسية فقط — بدون حاويات كاملة إن ضاق الوقت)
- [ ] `/shipments/[id]` ملخص + تعديل بيانات
- [ ] RPC: `generate_shipment_number`, `transition_shipment_status`
- [ ] Job/دالة: auto `in_sea` → `customs`

### مرجع UI قديم
- `Shipments.tsx`, `ShipmentForm.tsx` (أزرار فقط)

### Prompt
```
اقرأ docs/PROJECT_SPEC.md. المرحلة 1 فقط.
Login + Layout RTL + Dashboard + قائمة شحنات + إنشاء شحنة + تفاصيل.
3 حالات: in_sea, customs, closed. زر التالي بجانب الحالة.
لا تقارير. لا supplier_id على products.
بعد الانتهاء: type-check, lint, build. حدّث STATUS.md.
```

---

## المرحلة 2 — تشغيل يومي

### المخرجات
- [ ] `/shipments/new` كامل: حاويات + منتجات + **QuickProductModal**
- [ ] تبويبات تفاصيل الشحنة: حاويات، منتجات، timeline
- [ ] Dialog إغلاق / مصاريف (5 حقول + ملاحظات) → `closed`
- [ ] تعديل شحنة مغلقة (مصاريف + audit)
- [ ] `/products` قائمة + CRUD
- [ ] `/suppliers`, `/companies` CRUD بسيط
- [ ] Realtime على `shipments` (اختياري إن اتضح الوقت)

### Prompt
```
المرحلة 2 فقط. راجع docs/STATUS.md للملفات الموجودة.
أكمل: حاويات، shipment_products، منتج جديد من صفحة الشحنة، dialog المصاريف، تعديل بعد الإغلاق.
مرجع UX: d:\shiping\tracking-system-v2\frontend\src\pages\ShipmentForm.tsx (QuickProductModal).
build + STATUS.md.
```

---

## المرحلة 3 — تقارير أساسية (8)

| # | slug | التقرير |
|---|------|---------|
| 1 | summary | ملخص الشحنات |
| 2 | in-sea | في البحر |
| 3 | customs | في الجمارك |
| 4 | delayed | متأخرة (فلتر ETA) |
| 5 | arriving-30 | وصول 30 يوم |
| 6 | closed | مغلقة |
| 7 | incoming-products | منتجات واردة |
| 8 | costs | تقرير المصاريف |

### كل تقرير
- `/reports` بطاقات + `/reports/[slug]`
- فلاتر: من–إلى، شركة، مورد
- أزرار: **تصدير Excel (.xlsx)** + **طباعة PDF**

### Prompt
```
المرحلة 3 فقط: 8 تقارير من docs/PHASES.md + SheetJS xlsx + print CSS RTL.
لا تبني تقارير Phase 4. build + STATUS.md.
```

---

## المرحلة 4 — تقارير وبيانات إضافية

| # | slug | التقرير |
|---|------|---------|
| 9 | ready-to-close | جاهزة للإغلاق |
| 10 | containers | الحاويات |
| 11 | container-files | ملفات الحاويات |
| 12 | new-products | منتجات جديدة |
| 13 | duplicate-products | منتجات مكررة |
| 14 | date-range-products | منتجات بفترة |
| 15 | product-history | تاريخ منتج |
| 16 | suppliers | الموردين |
| 17 | companies | شركات الاستيراد |

### إضافي
- [ ] رفع/تحميل Excel حاوية (Storage)
- [ ] `/products/search` بحث ذكي

### Prompt
```
المرحلة 4 فقط. باقي التقارير + ملفات حاوية + بحث منتج.
build + STATUS.md.
```

---

## المرحلة 5 — إنتاج

- [ ] مراجعة RLS كاملة
- [ ] Indexes + تحسين استعلامات
- [ ] PWA manifest
- [ ] Tauri scaffold (اختياري)
- [ ] README تشغيل

### Prompt
```
المرحلة 5: أمان، أداء، PWA، توثيق تشغيل. لا features جديدة.
build + STATUS.md نهائي.
```

---

## تقارير — تفاصيل أعمدة (مرجع)

### شحنات (عام)
`shipment_number`, `acid`, `company`, `supplier`, `shipping_port`, `arrival_port`, `shipped_at`, `eta`, `status_ar`, `containers_count`, `products_count`, `closed_at`

### مصاريف
+ `customs_cost`, `shipping_cost`, `clearance_cost`, `local_transport_cost`, `other_expenses`, `total_cost`, `closing_notes`

### منتجات واردة
`product_name`, `sku`, `total_quantity`, `shipment_count`, `last_seen`

### مكررة
منتج في أكثر من شحنة حيث `status != closed`

---

## Cursor vs Codex — متى تستخدم إيه

| المهمة | Cursor | Codex |
|--------|--------|-------|
| مشروع جديد من الصفر، ملفات كثيرة | ✅ الأفضل | ✅ يقدر |
| إصلاح bug في ملف معروف | ✅ | ✅ |
| مرحلة واحدة بـ prompt من هنا | ✅ | ✅ انسخ Prompt المرحلة |
| شات طويل + MCP browser | ✅ | يختلف |
| استمرار بعد انقطاع | شات جديد + STATUS | نفس الشيء |

**التوصية:** Cursor للبناء الرئيسي — Codex **احتياطي** بنفس الريبو + نفس `docs/` — **لا يشتغلوا على نفس المرحلة في نفس الوقت**.
