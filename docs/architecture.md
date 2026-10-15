# Mimari

> Kaynak: [plan.md](../plan.md) §1. Bu doküman uygulandıkça güncellenir. Durum: Faz 7.

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

## Güncel durum (Faz 7)

Senkronizasyon: [sync.md](sync.md) (veritabanı sinyali → web `router.refresh()`, mobil sorgu yenileme; mobil çevrimdışı kuyruk).

| Bileşen               | Durum                                                                                                                                                                                                                                                                                                                                                                                                            |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web`            | next-intl, auth (recovery işaretli parola sıfırlama), arama / başlık / sezon sayfaları, TMDB atfı, izleme listesi (Server Actions + `useOptimistic`, filtreler URL'de), bölüm takibi ve ana sayfada Continue Watching ([ADR-0005](adr/0005-episode-progress.md)), iki adımlı hesap silme ([auth](auth.md), [ADR-0002](adr/0002-web-auth.md), [ADR-0003](adr/0003-catalog.md), [ADR-0004](adr/0004-watchlist.md)) |
| `apps/mobile`         | Expo Router: auth, arama, başlık/sezon, liste, bölüm takibi, İzlemeye devam et, profil, hesap silme; TanStack Query + `api-client`; şifreli oturum ([mobile](mobile.md), [ADR-0006](adr/0006-mobile.md))                                                                                                                                                                                                         |
| `packages/shared`     | Auth Zod şemaları, hata kodları, katalog ve hesap sözleşmeleri (`contracts/`, Edge Function'lara senkronlanır), izleme listesi kuralları (`applyStatusChange`, puan/not şemaları), hesap silme formu                                                                                                                                                                                                             |
| `packages/api-client` | `queryKeys` (profil, katalog, liste, ilerleme), bölüm ilerlemesi (`markEpisodesWatched`, `getContinueWatching`, …), profil, katalog, izleme listesi (`getWatchlist`, `addToWatchlist`, …) ve `deleteAccount`                                                                                                                                                                                                     |
| `packages/i18n`       | TR/EN mesajları (auth, nav, doğrulama, hatalar, profil, katalog, liste, hesap)                                                                                                                                                                                                                                                                                                                                   |
| `supabase/`           | Şema + RLS, hesap silme modeli, avatar yolu kısıtı, hız sınırı ve bakım fonksiyonları, `pg_cron` (rapor işleri), liste tutarlılık kısıtları, bölüm ilerlemesi RPC'leri ve tetikleyicisi, `tmdb` ve `delete-account` Edge Function'ları ([tmdb](edge-functions/tmdb.md), [delete-account](edge-functions/delete-account.md), [saklama](data-retention.md))                                                        |
| `tooling/`            | `security/`: bundle-guard, public-env-check · `scripts/`: yerel Supabase public env aktarıcı                                                                                                                                                                                                                                                                                                                     |
| CI                    | quality (lint · typecheck · birim · sözleşme senkronu · Deno) · e2e (build · güvenlik · Playwright + Edge Function + sahte TMDB) · database (pgTAP · advisors · tip uyumu) · gitleaks                                                                                                                                                                                                                            |
