# Architecture — Elmaghraby Tracing

## Stack

- **Next.js 16** App Router (`src/app/`)
- **Supabase** Auth + Postgres + Storage + Realtime
- **Tauri 2** (`src-tauri/`) — dev loads `http://localhost:3000`

## Layers

| Layer | Path |
|-------|------|
| UI pages | `src/app/**/page.tsx` |
| Components | `src/components/` |
| Client Supabase | `src/lib/supabase/client.ts` |
| Server admin API | `src/lib/supabase/server.ts` + `src/app/api/` |
| Permissions | `src/lib/permissions.ts` + `src/context/profile-context.tsx` |
| Schema | `supabase/migrations/` |

## Auth & roles

- `profiles.role`: `admin` | `manager` | `viewer`
- RLS: `can_write()` in DB for admin/manager
- `/api/users`, `/api/settings` (PUT): **admin only** via `requireAdmin()`
- UI: `ProfileProvider` + `useProfile()` + `AdminGuard` on `/users`

## Shipment statuses

`in_sea` → `customs` → `closed` (costs dialog before close)

## Spec source of truth

`docs/PROJECT_SPEC.md`
