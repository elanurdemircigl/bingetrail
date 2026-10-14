# Faz 2 — Auth, i18n ve Uygulama Kabuğu (Web)

> Kaynak: [`plan.md`](../plan.md), Revizyon 2.1 · Platform: **Web** · Bağımlılık: [Faz 1](faz-01-supabase-cekirdegi.md) · Sonraki: [Faz 3](faz-03-tmdb-katalog-arama.md) · Karmaşıklık: Orta

- **Amaç:** Web'de hesap yaşam döngüsü ve iki dilli uygulama kabuğu.
- **Kullanıcı değeri:** Kayıt, giriş, çıkış, şifre sıfırlama; TR/EN dil seçimi.
- **Teknik teslimler:**
  - `apps/web/src/lib/supabase/` altında `server.ts`, `browser.ts` ve `middleware.ts` (`@supabase/ssr`, cookie) (K3).
  - Korumalı route'lar.
  - RHF + Zod ile auth sayfaları ve `/auth/reset` akışı.
  - `packages/i18n` ortak TR/EN JSON'ları ve web'de next-intl (K12). Dil tercihi `profiles.locale` alanında saklanır.
  - Kabuk: Ana sayfa, Ara, Listem, Takvim, Profil.
  - `packages/api-client` içinde ilk sözleşmeler: `queryKeys.profile`, `ProfileDTO`, `getProfile(client)`.
- **Bağımlılık:** Faz 1.
- **Kabul kriterleri:**
  - Dört akış web'de çalışır.
  - Oturumu olmayan kullanıcı korumalı sayfaya erişemez.
  - Dil anında değişir ve kalıcıdır.
  - TR/EN anahtar eşleşmesi tamdır.
  - Hata mesajları hesap varlığını sızdırmaz.
  - `api-client` paketinde `@supabase/ssr`, `next/*` veya `expo-*` import'u yoktur.
- **Test stratejisi:** Vitest ile şemalar ve mapper'lar, RTL ile formlar, Playwright ile auth E2E (yerel Supabase + Mailpit), i18n anahtar eşleşme testi.
- **Riskler ve güvenlik:** Redirect allowlist'i, Auth rate limit, parola politikası, cookie ayarları (`HttpOnly`, `Secure`, `SameSite`), Server Action CSRF koruması.
- **Görevler:** APP: web auth, i18n, kabuk, ilk sözleşmeler · DB: auth config (`config.toml`: e-posta şablonları, redirect URL'leri) · SEC: auth incelemesi, enumeration ve redirect testleri · QA: auth E2E · DOC: `docs/auth.md`.
- **Quality Gate 2:** Akışları web'de sen elle denersin. Supabase dashboard ayarlarını sen yaparsın.

## Revizyon 1'den kaldırılan veya taşınan görevler
- ~~Mobilde Expo Router auth grubu, SecureStore oturumu, deep link ile sıfırlama~~ → **[Faz 6](faz-06-mobil-cekirdek.md)** (K1).
- ~~Mobilde i18next~~ → **Faz 6** (K12).
- ~~Kabul kriteri: "dört akış web ve mobilde çalışır"~~ → yalnızca web.
- ~~Quality Gate 2'de emülatörde elle test~~ → Faz 6.
- ~~`api-client` içinde ortak Supabase client~~ → platforma özel client'lar (K3).

---
Genel plan, kurallar, veritabanı/RLS, güvenlik ve test kapıları: [../plan.md](../plan.md)
