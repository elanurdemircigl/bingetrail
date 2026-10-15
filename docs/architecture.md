# Mimari

> Kaynak: [plan.md](../plan.md) §1. Bu doküman uygulandıkça güncellenir. Durum: Faz 0.

## Bileşenler

```
apps/web (Next.js)        apps/mobile (Expo)
   │ @supabase/ssr            │ supabase-js + SecureStore      ← Faz 2 / Faz 6
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

| Paket              | Bağımlı olabileceği                                              | Bağımlı olamayacağı                |
| ------------------ | ---------------------------------------------------------------- | ---------------------------------- |
| `shared`           | `zod`                                                            | React, Next, Expo, Supabase        |
| `api-client`       | `db-types`, `@supabase/supabase-js` (yalnızca peer, tipler için) | React, Next, Expo, `@supabase/ssr` |
| `i18n`, `db-types` | —                                                                | React, Next, Expo                  |
| `apps/web`         | Bütün paketler, Next, `@supabase/ssr`                            | Expo, React Native                 |
| `apps/mobile`      | Bütün paketler, Expo                                             | Next, `@supabase/ssr`              |

Paylaşılan paketlerdeki yasaklar ESLint (`no-restricted-imports`) ile zorunlu tutulur.

## Güncel durum (Faz 1)

| Bileşen            | Durum                                                                                                                    |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `apps/web`         | `/` sayfası (TR), temel güvenlik header'ları, TMDB görsel izni                                                           |
| `apps/mobile`      | Tek ekranlı Expo Router iskeleti, NativeWind                                                                             |
| `packages/*`       | İskeletler ve smoke testleri                                                                                             |
| `supabase/`        | Faz 1: şema, RLS, hesap silme modeli, avatars bucket, pgTAP ([veri modeli](data-model.md))                               |
| `tooling/security` | bundle-guard, public-env-check                                                                                           |
| CI                 | lint · typecheck · test · web build · güvenlik taraması · E2E smoke · gitleaks · veritabanı (pgTAP, advisors, tip uyumu) |
