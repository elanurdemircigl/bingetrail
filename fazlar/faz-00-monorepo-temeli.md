# Faz 0 — Monorepo Temeli

> Kaynak: [`plan.md`](../plan.md), Revizyon 2.1 · Bağımlılık: yok · Sonraki: [Faz 1](faz-01-supabase-cekirdegi.md) · Karmaşıklık: Düşük–Orta

- **Amaç:** Tekrarlanabilir bir geliştirme ortamı. Web ve paketlerde lint, typecheck, test ve build çalışır. Mobil yalnızca açılan bir iskelettir (K1).
- **Kullanıcı değeri:** Doğrudan yok. Sonraki fazların hızını ve güvenliğini sağlar.
- **Teknik teslimler:** pnpm workspace, Turborepo pipeline'ı (`build`, `dev`, `lint`, `typecheck`, `test`, `test:e2e`), ortak tsconfig/eslint/prettier, boş Next.js uygulaması, **yalnızca iskelet Expo uygulaması** (tek ekran, özellik yok), boş paketler, Vitest yapılandırması, Playwright iskeleti, CI iş akışı, bundle-guard ve public-env denetimi, `.env.example` dosyaları, `.gitignore`, ADR-0001.
- **Bağımlılık:** Yok. Bağımsız Git deposunu sen açarsın.
- **Kabul kriterleri:** Aşağıdaki Quality Gate 0 listesi. Production mobil ya da EAS build **istenmez** (K4).
- **Test stratejisi:** Her pakette bir smoke test, Playwright'ta bir web smoke test, Expo için `tsc --noEmit`.
- **Riskler ve güvenlik:**
  - Expo + pnpm hoisting sorunları (Metro monorepo ayarı, `.npmrc`).
  - Secret sızıntısı. Önlem: gitleaks, bundle-guard ve public-env denetimi.
  - Paralel yazım çakışması. Önlem: Dalga A'da yalnızca APP çalışır (K9).
- **Görevler:**
  - APP: Kök yapının tamamı, web ve mobil iskeletleri, paket iskeletleri, gereken bütün devDependency'ler. Tek başına ve önce çalışır.
  - SEC: `tooling/security/**`, `.gitleaks.toml`, `SECURITY.md`, `docs/security/*`.
  - QA: CI ve Playwright.
  - DOC: README, CONTRIBUTING, ADR, mimari doküman.
  - DB: Bu fazda yok (Faz 1).

## Ortam ve sürümler

**Ortam kontrolü (salt okuma, 2026-10-14):**
- ✅ Node `v24.18.1`, pnpm `10.34.7`, corepack `0.35.0`, Docker `29.4.3`
- ❌ **Supabase CLI kurulu değil.** Faz 0'ı engellemez; Faz 1'den önce gerekli.
- ⚠️ **Üst Git deposu `C:/Users/elqnu`.** BingeTrail bağımsız bir depo olmalı (K8). `bingetrail` içinde `git init -b main` komutunu sen çalıştırırsın. Agent'lar Git komutu çalıştırmaz.

**npm'deki güncel sürümler (2026-10-14):** next 16.4.0 · react 19.3.0 · expo 57.0.28 (expo-router 57, react-native 0.87.1) · turbo 2.11.8 · typescript 7.0.2 · vitest 5.0.4 · @playwright/test 1.64.0 · tailwindcss 4.3.3 · nativewind 4.2.7 · eslint 10.12.0 · typescript-eslint 8.71.2 · zod 4.6.7 · prettier 3.9.10.
- **TypeScript:** TS 7 ile başlanır (K14). Next veya ESLint uyumsuzsa uyumlu en güncel sürüme sabitlenir ve ADR'ye yazılır.
- **React:** Mobilde Expo SDK 57 belirleyicidir (`expo install --check`). Web React sürümü bağımsızdır; eşitlik zorlanmaz (K2).
- **Stil:** NativeWind 4 Tailwind 3 tabanlıdır, web ise Tailwind 4 kullanır. Ortak olan yalnızca tasarım token'larıdır.

**Ön koşullar (sen yaparsın):** Bağımsız Git deposu, Supabase CLI (Faz 1'den önce), isteğe bağlı olarak Expo Go veya Android emülatörü.

## Ayrıntılı görev listesi

**Dalga A — yalnızca APP, tek başına ve sıralı.** Bu dalga bitene kadar başka hiçbir agent çalışmaz.
1. Güncel sürümler doğrulanır. TS 7 ile ESLint ve Next uyumu kontrol edilir.
2. Kök dosyalar: `package.json` (`packageManager`, `engines.node >=24`, script'ler; QA ve SEC'in ihtiyaç duyacağı devDependency'ler dahil), `pnpm-workspace.yaml`, `turbo.json` (`build` görevi web ve paketleri kapsar, mobil production build'i kapsamaz), `.npmrc`, `.nvmrc`, `.gitignore` (`.env*`, `!.env.example`, build çıktıları), `.editorconfig`, prettier config.
3. `packages/config`: `tsconfig.base.json` (strict, `noUncheckedIndexedAccess`), ESLint flat config (React, a11y, `dangerouslySetInnerHTML` yasağı, `packages/api-client` için `next/*`, `@supabase/ssr`, `expo-*`, `react-native` import yasağı), ortak Vitest config, tasarım token'ları.
4. `apps/web`: Next.js App Router iskeleti, Tailwind 4, `/` sayfası, `next.config` (`images.remotePatterns: image.tmdb.org`, temel güvenlik header'ları). Supabase client'ları Faz 2'de eklenir.
5. `apps/mobile`: **Yalnızca çalışan iskelet.** Expo Router ile tek ekran, NativeWind kurulumu, monorepo Metro ayarı, `app.config.ts` (scheme `bingetrail`), `typecheck` script'i. Auth, navigasyon kabuğu, özellik ekranı ve EAS yapılandırması yoktur.
6. Paket iskeletleri: `packages/shared`, `packages/api-client` (yalnızca `queryKeys` iskeleti; client yok), `packages/i18n`, `packages/db-types`. Her birinde `package.json` (React yok; `api-client`'ta `@supabase/supabase-js` yalnızca peerDependency olarak), `tsconfig`, `src/index.ts` ve bir smoke testi bulunur.
7. `.env.example` dosyaları (yalnızca adlar, değer yok): web için `NEXT_PUBLIC_SUPABASE_URL=` ve `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=`, mobil için `EXPO_PUBLIC_*` karşılıkları. Her dosyada "service-role/secret key ve TMDB anahtarı buraya ASLA eklenmez" yorumu yer alır.
8. APP kendi doğrulamasını yapar: `pnpm install`, `pnpm turbo lint typecheck test build`. Yeşil olunca Dalga A kapanır.

**Dalga B — APP bitince. SEC, QA ve DOC paralel, her biri yalnızca kendi alanında.** Hiçbiri `package.json`, `apps/**` veya `packages/**` dosyalarına dokunmaz.
- **SEC:** `tooling/security/bundle-guard.mjs` (token desenleri, `sb_secret_`, `service_role` ve TMDB `api_read` JWT payload kontrolü), `tooling/security/public-env-check.mjs` (allowlist ve ad/değer denetimi), `tooling/security/allowlist.json`, `.gitleaks.toml`, `SECURITY.md`, `docs/security/secrets-policy.md`, `docs/security/threat-model.md` (v0).
- **QA:** `playwright.config.ts`, `e2e/smoke.spec.ts`, `.github/workflows/ci.yml`. CI şunları çalıştırır: lint, typecheck (Expo dahil), test, web build, bundle-guard, public-env-check, gitleaks ve Playwright smoke. **Mobil/EAS build adımı yoktur.** CI'ı GitHub'a sen push'larsın.
- **DOC:** `README.md`, `CONTRIBUTING.md` (dosya sahipliği tablosu ve agent'ların Git yasağı), `docs/adr/0001-stack.md` (sürümler, web-önce stratejisi, platforma özel client'lar, React politikası, TS kararı), `docs/architecture.md`.

**Dalga C — doğrulama:**
- QA çalıştırır: `pnpm install`, `pnpm turbo lint typecheck test`, web production build, bundle-guard, public-env-check, Playwright.
- SEC inceler: `.gitignore` kapsamı, `.env.example` dosyalarında değer olmaması, bundle-guard'ın sahte bir `sb_secret_test…` fixture'ını yakalaması.

**Dalga D:** Bulgular dosya sahiplerine gider ve sıralı düzeltilir.

## Quality Gate 0 (insan onayı)
- [ ] Temiz klonda `pnpm install` hatasız
- [ ] Bütün paketlerde `lint`, `typecheck` ve `test` yeşil
- [ ] Expo typecheck (`pnpm --filter mobile typecheck`) yeşil
- [ ] Web production build (`pnpm --filter web build`) yeşil
- [ ] Bundle-guard ve public-env denetimi temiz; sahte secret fixture'ı yakalanıyor
- [ ] Playwright web smoke yeşil
- [ ] Repoda secret yok, `.env*` dosyaları ignore ediliyor
- [ ] README adımları sıfırdan uygulanabiliyor
- [ ] *İsteğe bağlı, gate şartı değil:* İskelet Expo Go'da açılıyor
- [ ] **İstenmeyenler:** production mobil build, EAS build, mağaza yapılandırması
- [ ] Önerilen commit: `chore: bootstrap pnpm/turborepo monorepo (web, mobile skeleton, packages)`. Commit'i sen atarsın.

## Revizyon 1'den kaldırılan veya taşınan görevler
- ~~DB: `supabase/config.toml` taslağı ve klasör planı~~ → **Faz 1'e taşındı** (Supabase CLI gerektiriyor).
- ~~Bundle guard'ın `packages/config/scripts/` altında APP tarafından yazılması~~ → `tooling/security/**`, SEC sahibi.
- ~~Bundle guard'ın "TMDB" metnini araması~~ → token desenleri, JWT payload kontrolü ve public env allowlist'i (K6).
- ~~Gate şartı olarak "Expo `start` ile açılıyor"~~ → isteğe bağlı. Gate şartı Expo typecheck (K4).
- ~~Web ve mobilde aynı React sürümü~~ → kaldırıldı (K2).
- ~~`app/[locale]` yer tutucusu~~ → i18n yönlendirmesi Faz 2'de kurulur.

---
Genel plan, kurallar, veritabanı/RLS, güvenlik ve test kapıları: [../plan.md](../plan.md)
