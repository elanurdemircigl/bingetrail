# BingeTrail

Film ve dizi takip uygulaması: web (Next.js) ve mobil (Expo), Supabase backend.

> **Durum: Faz 5 — Bölüm takibi ve Continue Watching.** Bölüm/sezon/"buraya kadar" işaretleme, ilerleme çubukları, tamamlama önerisi ve ana sayfada "İzlemeye devam et" eklendi. Öncesi: Web'de kimlik doğrulama, TR/EN, film/dizi arama ve detay (`tmdb` Edge Function, önbellekli), izleme listesi (5 durum, 1–10 puan, kişisel notlar, filtre ve sıralama) ve kalıcı hesap silme (`delete-account` Edge Function) çalışıyor. Mobil hâlâ iskelet (Faz 6). Kullanım: [docs/user-guide.md](docs/user-guide.md)
> Yol haritası: [plan.md](plan.md) · Faz dizini: [fazlar/](fazlar/README.md)

## Gereksinimler

| Araç                           | Sürüm                                                         |
| ------------------------------ | ------------------------------------------------------------- |
| Node.js                        | 24 LTS (`.nvmrc`)                                             |
| pnpm                           | 10.x (`corepack enable` ile `packageManager` alanından gelir) |
| Docker Desktop                 | Yerel Supabase için çalışır durumda olmalı                    |
| Supabase CLI                   | Ayrı kurulum gerekmez; `supabase` devDependency (`pnpm exec`) |
| Expo Go veya Android emülatörü | İsteğe bağlı, mobil iskeleti görmek için                      |

## Kurulum

```bash
corepack enable
pnpm install
pnpm db:start   # yerel Supabase (Docker Desktop açık olmalı)
pnpm dev:web    # http://localhost:3000
```

Yerel geliştirmede `.env.local` **gerekmez**: `dev:web`, `build:web:local` ve `test:e2e` yerel Supabase'in public URL'sini ve publishable key'ini otomatik geçirir. Uzak bir Supabase projesine bağlanırken `apps/web/.env.example` dosyasını `apps/web/.env.local` olarak kopyala.

`.env.local` dosyalarına **yalnızca** Supabase URL'si ve publishable key girer. Service-role/secret key ve TMDB anahtarı istemci env dosyalarına asla konmaz (bkz. [SECURITY.md](SECURITY.md)).

## Komutlar

| Komut                                     | Ne yapar                                                                                               |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `pnpm dev:web`                            | Web geliştirme sunucusu, yerel Supabase ile → http://localhost:3000                                    |
| `pnpm --filter @bingetrail/mobile start`  | Expo geliştirme sunucusu (QR kodu Expo Go ile tara)                                                    |
| `pnpm lint`                               | Bütün paketlerde ESLint                                                                                |
| `pnpm typecheck`                          | Bütün paketlerde (Expo dahil) TypeScript + kök tooling                                                 |
| `pnpm test`                               | Bütün paketlerde Vitest                                                                                |
| `pnpm run build:web`                      | Web production build (Turbo üzerinden, önbellekli)                                                     |
| `pnpm build:web:local`                    | Web production build, yerel Supabase'in public ayarlarıyla                                             |
| `pnpm run security:check:local`           | Public env denetimi + istemci bundle secret taraması (build sonrası)                                   |
| `pnpm run test:security`                  | Güvenlik tarayıcılarının testleri                                                                      |
| `pnpm test:functions`                     | Edge Function tip kontrolü + Deno testleri (yerel Deno ya da Docker)                                   |
| `pnpm contracts:sync` / `contracts:check` | Paylaşılan sözleşmeleri Edge Function'lara kopyalar / farkı denetler                                   |
| `pnpm exec playwright install chromium`   | E2E tarayıcısını indirir (bir kez)                                                                     |
| `pnpm run test:e2e`                       | Playwright E2E: auth, erişim, i18n, katalog, liste, bölüm takibi, hesap silme (önce `build:web:local`) |
| `pnpm run format` / `format:check`        | Prettier                                                                                               |
| `pnpm db:start` / `pnpm db:stop`          | Yerel Supabase'i başlatır ve durdurur (Docker gerekir)                                                 |
| `pnpm db:reset`                           | Yerel veritabanını migration'lar + sahte seed ile sıfırdan kurar                                       |
| `pnpm db:test`                            | pgTAP: şema, RLS izolasyonu, hesap silme                                                               |
| `pnpm db:lint` / `pnpm db:advisors`       | SQL fonksiyon denetimi / Supabase güvenlik + performans advisor'ları                                   |
| `pnpm db:types`                           | `packages/db-types` tiplerini şemadan yeniden üretir                                                   |

`pnpm db:start` çıktısı yerel anahtarları ekrana yazar. Bunlar yalnızca senin makinendeki geliştirme ortamına aittir; yine de bir yere yapıştırma. Veri modeli: [docs/data-model.md](docs/data-model.md) · Kimlik doğrulama ve uzak Supabase ayarları: [docs/auth.md](docs/auth.md) · Edge Function secret'ları (`TMDB_API_READ_ACCESS_TOKEN`, `ACCOUNT_DELETION_HASH_SALT`; yalnızca `supabase secrets set` ile, depo sahibi girer): [docs/edge-functions/](docs/edge-functions/tmdb.md) · Hesap silme: [docs/account-deletion.md](docs/account-deletion.md).

> **Not:** `pnpm turbo run <görev> --filter=...` biçimini kullanma. pnpm `--filter`'ı kendi seçeneği olarak yorumluyor ve komut takılıyor (Windows'ta doğrulandı). Filtreli Turbo çalıştırmaları için `build:web` gibi kök script'leri kullan.

## Yapı

```
apps/web        Next.js App Router (web)
apps/mobile     Expo + Expo Router (Faz 6'ya kadar yalnızca iskelet)
packages/       shared · api-client · i18n · db-types · config
supabase/       migration'lar · pgTAP testleri · seed · config.toml
tooling/        güvenlik tarayıcıları
e2e/            Playwright
docs/           ADR, mimari, güvenlik
```

Ayrıntılar: [docs/architecture.md](docs/architecture.md) · Teknoloji kararları: [docs/adr/0001-stack.md](docs/adr/0001-stack.md)

## Git ve deploy

**Git, commit, push ve deploy işlemlerini yalnızca depo sahibi yapar.** Otomasyon ajanları dosya üretir ve commit mesajı önerir, Git komutu çalıştırmaz.

> ⚠️ **Üst Git deposu uyarısı:** Bu klasör `C:\Users\elqnu` altında ve o dizin de bir Git deposu (içinde `.ssh/` gibi hassas dosyalar var). BingeTrail kendi bağımsız deposudur. Git komutlarını her zaman `bingetrail` klasörünün içinde çalıştır; `git rev-parse --show-toplevel` `.../bingetrail` döndürmeli.

## Lisans ve atıf

Uygulama içindeki her sayfanın altında TMDB atfı bulunur: "This product uses the TMDB API but is not endorsed or certified by TMDB." Gerçek TMDB verisi için kendi token'ını `supabase/functions/.env` dosyasına sen girersin ([docs/edge-functions/tmdb.md](docs/edge-functions/tmdb.md)).
