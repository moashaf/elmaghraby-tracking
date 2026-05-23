# تسليم لـ Codex (أو أي AI) — ابدأ من هنا

## 1) افتح المجلد

```
d:\elmaghraby-tracing
```

## 2) اقرأ بالترتيب

1. `docs/PROJECT_SPEC.md` — القواعد الثابتة (لا تكسرها)
2. `docs/STATUS.md` — أين توقفنا
3. `docs/PHASES.md` — نفّذ **مرحلة واحدة** فقط

## 3) انسخ هذا الـ Prompt

```
أنت Senior Full-Stack. مشروع Elmaghraby Tracing.

اقرأ:
- docs/PROJECT_SPEC.md
- docs/STATUS.md
- docs/PHASES.md

نفّذ المرحلة المذكورة في STATUS كـ "المرحلة الحالية" فقط.
لا تغيّر قرارات SPEC (3 حالات، بدون supplier_id على products، RTL عربي).
بعد الانتهاء:
1. npm run type-check && npm run lint && npm run build
2. حدّث docs/STATUS.md (ما تم، الملفات، المرحلة التالية)
3. لا تبدأ المرحلة التالية إلا إذا طُلب صراحة.
```

## 4) قواعد لا تُكسر

- لا `supplier_id` في `products`
- الحالات: `in_sea`, `customs`, `closed` فقط
- لا Laravel — Supabase + Next.js فقط
- لا تحذف `docs/` عند refactor

## 5) مرجع UX (قراءة فقط)

```
d:\shiping\tracking-system-v2\frontend\src\pages\
```

## 6) Mockups

```
assets/ui-*.png
```

## 7) بعد كل جلسة

حدّث `STATUS.md` بهذا الشكل:

```markdown
## المرحلة الحالية
2 — ...

## ما تم إنجازه
- [x] ...

## الملفات المضافة/المعدلة
- path/to/file

## الخطوة التالية
→ Phase 3
```
