# BingeTrail

Film ve dizi takip uygulaması: web (Next.js) ve mobil (Expo), Supabase backend.

> **Durum: Faz 2 — Web kimlik doğrulama ve i18n.** Web'de kayıt, e-posta doğrulama, giriş, çıkış, parola sıfırlama ve TR/EN dil seçimi çalışıyor; uygulama kabuğu (Ana sayfa, Ara, Listem, Takvim, Profil) hazır. Mobil hâlâ iskelet (Faz 6).
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

| Komut                                    | Ne yapar                                                             |
| ---------------------------------------- | -------------------------------------------------------------------- |
| `pnpm dev:web`                           | Web geliştirme sunucusu, yerel Supabase ile → http://localhost:3000  |
| `pnpm --filter @bingetrail/mobile start` | Expo geliştirme sunucusu (QR kodu Expo Go ile tara)                  |
| `pnpm lint`                              | Bütün paketlerde ESLint                                              |
| `pnpm typecheck`                         | Bütün paketlerde (Expo dahil) TypeScript + kök tooling               |
| `pnpm test`                              | Bütün paketlerde Vitest                                              |
| `pnpm run build:web`                     | Web production build (Turbo üzerinden, önbellekli)                   |
| `pnpm build:web:local`                   | Web production build, yerel Supabase'in public ayarlarıyla           |
| `pnpm run security:check:local`          | Public env denetimi + istemci bundle secret taraması (build sonrası) |
| `pnpm run test:security`                 | Güvenlik tarayıcılarının testleri                                    |
| `pnpm exec playwright install chromium`  | E2E tarayıcısını indirir (bir kez)                                   |
| `pnpm run test:e2e`                      | Playwright E2E: auth akışları, erişim, i18n (önce `build:web:local`) |
| `pnpm run format` / `format:check`       | Prettier                                                             |
| `pnpm db:start` / `pnpm db:stop`         | Yerel Supabase'i başlatır ve durdurur (Docker gerekir)               |
| `pnpm db:reset`                          | Yerel veritabanını migration'lar + sahte seed ile sıfırdan kurar     |
| `pnpm db:test`                           | pgTAP: şema, RLS izolasyonu, hesap silme                             |
| `pnpm db:lint` / `pnpm db:advisors`      | SQL fonksiyon denetimi / Supabase güvenlik + performans advisor'ları |
| `pnpm db:types`                          | `packages/db-types` tiplerini şemadan yeniden üretir                 |

`pnpm db:start` çıktısı yerel anahtarları ekrana yazar. Bunlar yalnızca senin makinendeki geliştirme ortamına aittir; yine de bir yere yapıştırma. Veri modeli: [docs/data-model.md](docs/data-model.md) · Kimlik doğrulama ve uzak Supabase ayarları: [docs/auth.md](docs/auth.md).

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

TMDB atfı Faz 3'te eklenecek: "This product uses the TMDB API but is not endorsed or certified by TMDB."
