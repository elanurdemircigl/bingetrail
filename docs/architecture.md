# Mimari

> Kaynak: [plan.md](../plan.md) §1. Bu doküman uygulandıkça güncellenir. Durum: Faz 2.

## Bileşenler

```
apps/web (Next.js)        apps/mobile (Expo)
   │ @supabase/ssr (sunucu)   │ supabase-js + SecureStore      ← Faz 2 ✅ / Faz 6
   │ HttpOnly cookie, proxy   │
   │                          │
   └──────┬───────────────────┘
          │ ortak sözleşmeler
          ▼
packages/api-client   query key · DTO · mapper · veri erişim fonksiyonları (client parametre olarak alınır)
packages/shared       Zod şemaları · domain kuralları (React yok)
packages/i18n         TR/EN JSON mesajları (web: next-intl, mobil: i18next)
packages/db-types     supabase gen types çıktısı
packages/config       tsconfig · ESLint · Vitest · tasarım token'ları
          │
          ▼
Supabase: PostgreSQL + RLS · Auth · Storage · Realtime · Edge Functions (tmdb, delete-account, export-user-data, refresh-upcoming)
```

## Bağımlılık kuralları

| Paket              | Bağımlı olabileceği                                         | Bağımlı olamayacağı                |
| ------------------ | ----------------------------------------------------------- | ---------------------------------- |
| `shared`           | `zod`, `i18n` (yalnızca dil listesi)                        | React, Next, Expo, Supabase        |
| `api-client`       | `db-types`, `i18n`, `@supabase/supabase-js` (yalnızca peer) | React, Next, Expo, `@supabase/ssr` |
| `i18n`, `db-types` | —                                                           | React, Next, Expo                  |
| `apps/web`         | Bütün paketler, Next, `@supabase/ssr`                       | Expo, React Native                 |
| `apps/mobile`      | Bütün paketler, Expo                                        | Next, `@supabase/ssr`              |

Paylaşılan paketlerdeki yasaklar ESLint (`no-restricted-imports`) ile zorunlu tutulur.

## Güncel durum (Faz 2)

| Bileşen               | Durum                                                                                                                                                                        |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web`            | next-intl (`/tr`, `/en`), auth akışları (Server Actions + `/auth/confirm`), `proxy.ts` erişim kuralları, uygulama kabuğu ([auth](auth.md), [ADR-0002](adr/0002-web-auth.md)) |
| `apps/mobile`         | Tek ekranlı Expo Router iskeleti, NativeWind (özellikler Faz 6)                                                                                                              |
| `packages/shared`     | Auth Zod şemaları, doğrulama ve hata kodları                                                                                                                                 |
| `packages/api-client` | `queryKeys`, `ProfileDTO`, `getProfile`, `updateProfileLocale`                                                                                                               |
| `packages/i18n`       | TR/EN mesajları (auth, nav, doğrulama, hatalar, profil)                                                                                                                      |
| `supabase/`           | Şema, RLS, hesap silme modeli, avatars bucket, pgTAP ([veri modeli](data-model.md)); auth ayarları ve TR/EN e-posta şablonları                                               |
| `tooling/`            | `security/`: bundle-guard, public-env-check · `scripts/`: yerel Supabase public env aktarıcı                                                                                 |
| CI                    | quality (lint · typecheck · birim) · e2e (web build · güvenlik taraması · Playwright, yerel Supabase ile) · database (pgTAP · advisors · tip uyumu) · gitleaks               |
