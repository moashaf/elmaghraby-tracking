# نشر النظام أونلاين + تطبيق سطح المكتب

النظام **أونلاين** (البيانات على Supabase). تطبيق الديسكتوب مجرد **اختصار** يفتح نفس الموقع — مش نسخة منفصلة من البيانات.

---

## 1) رابط الويب (للمشاركة مع أي حد)

### الخطوة أ — رفع الموقع على Vercel (مجاني)

1. ارفعي المشروع على **GitHub** (لو لسه مش مرفوع).
2. ادخلي [vercel.com](https://vercel.com) → **Add New Project** → اختاري الريبو.
3. في **Environment Variables** حطي نفس قيم `.env.local` (بدون `SUPABASE_SERVICE_ROLE_KEY` وبدون `SUPABASE_DB_PASSWORD`):

| الاسم | القيمة |
|--------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | من Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | نفس الـ anon / publishable key |
| `NEXT_PUBLIC_APP_URL` | هتحطيها بعد ما Vercel يديكي الرابط (خطوة ب) |

4. اضغطي **Deploy** واستني لحد ما يخلص.

5. هتاخدي رابط زي: `https://elmaghraby-tracing.vercel.app`  
   حطيه في `.env.local`:

```env
NEXT_PUBLIC_APP_URL=https://elmaghraby-tracing.vercel.app
```

6. في Vercel → **Settings → Environment Variables** حدّثي `NEXT_PUBLIC_APP_URL` واعملي **Redeploy**.

### الخطوة ب — Supabase (مهم عشان تسجيل الدخول يشتغل)

في [Supabase Dashboard](https://supabase.com/dashboard) → مشروعك → **Authentication** → **URL Configuration**:

| الحقل | القيمة |
|--------|--------|
| **Site URL** | `https://YOUR-APP.vercel.app` |
| **Redirect URLs** | `https://YOUR-APP.vercel.app/**` |

احفظي. بعدها أي حد يفتح الرابط يقدر يسجل دخول عادي.

### الخطوة ج — شاركي الرابط

ابعتي للناس:

```text
https://YOUR-APP.vercel.app
```

يفتحوا من Chrome / Edge / موبايل — نفس البيانات لكل المستخدمين المسجّلين.

---

## 2) تطبيق سطح المكتب (Windows)

التطبيق **ما بيخزّنش داتا لوحده** — بيفتح موقعك الأونلاين جوه نافذة (زي Chrome مختصر).

### بناء ملف التثبيت (.exe)

1. تأكدي إن الموقع شغال على Vercel و`NEXT_PUBLIC_APP_URL` مضبوط في `.env.local`.
2. من مجلد المشروع:

```bash
npm install
npm run desktop:build
```

3. ملف التثبيت يطلع هنا:

```text
src-tauri\target\release\bundle\nsis\
```

ابحثي عن ملف ينتهي بـ `.exe` (مثلاً `Elmaghraby Tracing_0.1.0_x64-setup.exe`).

4. انسخي الـ `.exe` على أي جهاز Windows وثبّتيه — هيشتغل على الرابط الأونلاين (محتاج إنترنت).

### تشغيل للتطوير (محلي)

```bash
npm run desktop:dev
```

يفتح `http://localhost:3000` جوه نافذة الديسكتوب.

---

## 3) ملخص

| الطريقة | الاستخدام | البيانات |
|---------|-----------|----------|
| **رابط Vercel** | تبعته لأي حد في المتصفح | Supabase أونلاين |
| **تطبيق Desktop** | تثبيت على Windows | نفس Supabase أونلاين |

---

## بدائل للنشر

- **Netlify** / **Cloudflare Pages** — نفس فكرة Vercel (متغيرات البيئة + build: `npm run build`).
- **دومين خاص** — اربطيه في Vercel (مثلاً `tracing.elmaghraby.com`).

لو حابة أساعدك خطوة بخطوة على Vercel من حسابك، ابعتي اسم الريبو أو لقطة من إعدادات المشروع.
