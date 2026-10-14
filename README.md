# BingeTrail

Film ve dizi takip uygulaması: web (Next.js) ve mobil (Expo), Supabase backend.

> **Durum: Faz 0 — Monorepo temeli.** Web ana sayfası ve mobil iskelet çalışıyor; henüz özellik yok.
> Yol haritası: [plan.md](plan.md) · Faz dizini: [fazlar/](fazlar/README.md)

## Gereksinimler

| Araç                           | Sürüm                                                         |
| ------------------------------ | ------------------------------------------------------------- |
| Node.js                        | 24 LTS (`.nvmrc`)                                             |
| pnpm                           | 10.x (`corepack enable` ile `packageManager` alanından gelir) |
| Docker                         | Yerel Supabase için (Faz 1'den itibaren)                      |
| Supabase CLI                   | Faz 1'den itibaren                                            |
| Expo Go veya Android emülatörü | İsteğe bağlı, mobil iskeleti görmek için                      |

## Kurulum

```bash
corepack enable
pnpm install
cp apps/web/.env.example apps/web/.env.local        # Faz 2'ye kadar boş kalabilir
cp apps/mobile/.env.example apps/mobile/.env.local  # Faz 6'ya kadar boş kalabilir
```

`.env.local` dosyalarına **yalnızca** Supabase URL'si ve publishable key girer. Service-role/secret key ve TMDB anahtarı istemci env dosyalarına asla konmaz (bkz. [SECURITY.md](SECURITY.md)).

## Komutlar

| Komut                                    | Ne yapar                                                                 |
| ---------------------------------------- | ------------------------------------------------------------------------ |
| `pnpm --filter @bingetrail/web dev`      | Web geliştirme sunucusu → http://localhost:3000                          |
| `pnpm --filter @bingetrail/mobile start` | Expo geliştirme sunucusu (QR kodu Expo Go ile tara)                      |
| `pnpm lint`                              | Bütün paketlerde ESLint                                                  |
| `pnpm typecheck`                         | Bütün paketlerde (Expo dahil) TypeScript + kök tooling                   |
| `pnpm test`                              | Bütün paketlerde Vitest                                                  |
| `pnpm run build:web`                     | Web production build (Turbo üzerinden, önbellekli)                       |
| `pnpm run security:check`                | Public env denetimi + istemci bundle secret taraması (web build sonrası) |
| `pnpm run test:security`                 | Güvenlik tarayıcılarının testleri                                        |
| `pnpm exec playwright install chromium`  | E2E tarayıcısını indirir (bir kez)                                       |
| `pnpm run test:e2e`                      | Playwright smoke (önce web build)                                        |
| `pnpm run format` / `format:check`       | Prettier                                                                 |

> **Not:** `pnpm turbo run <görev> --filter=...` biçimini kullanma. pnpm `--filter`'ı kendi seçeneği olarak yorumluyor ve komut takılıyor (Windows'ta doğrulandı). Filtreli Turbo çalıştırmaları için `build:web` gibi kök script'leri kullan.

## Yapı

```
apps/web        Next.js App Router (web)
apps/mobile     Expo + Expo Router (Faz 0'da yalnızca iskelet)
packages/       shared · api-client · i18n · db-types · config
tooling/        güvenlik tarayıcıları
e2e/            Playwright
docs/           ADR, mimari, güvenlik
```

Ayrıntılar: [docs/architecture.md](docs/architecture.md) · Teknoloji kararları: [docs/adr/0001-stack.md](docs/adr/0001-stack.md)

## Git ve deploy

**Git, commit, push ve deploy işlemlerini yalnızca depo sahibi yapar.** Otomasyon ajanları dosya üretir ve commit mesajı önerir, Git komutu çalıştırmaz.

> ⚠️ **Üst Git deposu uyarısı:** Bu klasör `C:\Users\elqnu` altında. O dizin de bir Git deposu ve içinde `.ssh/` gibi hassas dosyalar var. BingeTrail **bağımsız bir depo** olmalı. İlk commit'ten önce `bingetrail` klasörünün içinde `git init -b main` çalıştırılmalı ve `git rev-parse --show-toplevel` komutunun `.../bingetrail` döndürdüğü doğrulanmalı.

## Lisans ve atıf

TMDB atfı Faz 3'te eklenecek: "This product uses the TMDB API but is not endorsed or certified by TMDB."
