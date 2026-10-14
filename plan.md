# BingeTrail — Geliştirme Planı

> **Revizyon 2 (2026-10-14):** Mimari düzeltmeler işlendi. Mobil özellikler web çekirdeği stabil olduktan sonraya alındı. Platforma özel Supabase client'ları, hesap silmenin veri modeli, secret bundle denetimi, önbellek saklama politikası ve Faz 0 dalga sırası güncellendi. Faz numaraları değişti (0–10).
>
> **Revizyon 2.1 (2026-10-14):** Revizyon 2 onaylandı. Bekleyen 6 karar kesinleşti (K10–K15). `fazlar/` klasörü 0–10 faz yapısıyla eşleştirildi.

## Bağlam

BingeTrail, film ve dizi takibi için sıfırdan geliştirilecek bir web ve mobil uygulama. Çalışma dizininde (`C:\Users\elqnu\bingetrail`) şu an yalnızca bu plan ve `fazlar/` klasörü var. Bu belge bir plan. Onay gelmeden kod yazılmaz, klasör oluşturulmaz, paket kurulmaz, terminal komutu çalıştırılmaz ve migration üretilmez.

**Strateji:** Önce web gelir. Çekirdek akışlar (auth, arama, izleme listesi, bölüm takibi) web'de stabil hale gelir. Mobil uygulama Faz 0'dan itibaren çalışan bir iskelet olarak durur. Özellik geliştirmesi Faz 6'da, olgunlaşmış veri sözleşmelerinin üzerine kurulur.

**Değişmez kurallar (bütün fazlar için geçerli)**
- **Git, GitHub commit, push ve her türlü deploy işlemini sen yaparsın.** Agent'lar **hiçbir Git komutu çalıştırmaz.** Yalnızca dosya üretirler. Her quality gate'te commit mesajı önerirler ama commit atmazlar.
- ⚠️ **Üst Git deposu uyarısı:** `C:\Users\elqnu` (ev dizininin tamamı) bir Git deposu ve `bingetrail/` bunun içinde bir alt klasör. Ev dizininde `.ssh/`, `firebase-secrets/`, `NTUSER.DAT` gibi hassas dosyalar izlenmemiş halde duruyor. **BingeTrail bağımsız bir depo olmalı.** `bingetrail` içinde `git init -b main` komutunu sen çalıştırırsın. Ev dizinindeki `.git`'in kasıtlı olup olmadığını kontrol etmen önerilir. Bu yapı düzeltilmeden hiçbir ortamda `git add .` çalıştırılmamalı.
- Gizli anahtar, token veya `.env.local` içeriği **hiçbir zaman istenmez**. Agent'lar yalnızca değer içermeyen `.env.example` dosyaları yazar. Gerçek değerleri sen girersin.
- **TMDB anahtarı sadece Supabase Edge Function secret olarak durur** (`TMDB_API_READ_ACCESS_TOKEN`). `supabase secrets set` komutunu sen çalıştırırsın. İstemci kodunda, `.env` dosyalarında, `NEXT_PUBLIC_*` veya `EXPO_PUBLIC_*` değişkenlerinde bu anahtar bulunmaz.
- **Supabase service-role / secret key (`sb_secret_*`) web veya mobil istemciye asla konmaz.** Bu anahtar yalnızca Edge Function ortamında kullanılır, şu üç fonksiyonla sınırlıdır: `tmdb` (katalog önbelleği yazımı), `refresh-upcoming` (zamanlanmış iş), `delete-account` (`auth.admin.deleteUser`). İstemciler yalnızca publishable key kullanır.
- Aynı dosyaya iki agent paralel yazmaz. Sahiplik haritası Bölüm 3'te.

---

## 1. Mimari Özeti

```
bingetrail/
├─ apps/
│  ├─ web/            Next.js (App Router, RSC, Server Actions), Tailwind, next-intl
│  │  └─ src/lib/supabase/   server.ts · browser.ts · middleware.ts  (@supabase/ssr, cookie)
│  └─ mobile/         Expo + React Native (Expo Router), NativeWind, i18next
│     └─ src/lib/supabase/   client.ts  (supabase-js + SecureStore tabanlı storage adapter)
├─ packages/
│  ├─ shared/         Zod şemaları, domain kuralları (durum geçişleri, ilerleme hesabı, export formatlayıcı), tipler. React bağımlılığı yok
│  ├─ api-client/     Platformdan bağımsız veri sözleşmeleri: query key fabrikası, DTO'lar, mapper'lar, enjekte edilen client ile çalışan veri erişim fonksiyonları
│  ├─ db-types/       `supabase gen types` çıktısı (üretilmiş, elle düzenlenmez)
│  ├─ i18n/           tr.json / en.json mesajları + anahtar eşleşme testi
│  └─ config/         tsconfig, eslint, vitest, tasarım token'ları
├─ supabase/
│  ├─ migrations/     SQL migration'lar (şema + RLS + view/fonksiyonlar)
│  ├─ functions/      Deno Edge Functions: tmdb, delete-account, export-user-data, refresh-upcoming; _shared/
│  ├─ tests/          pgTAP testleri (database/, security/)
│  └─ seed.sql        Yalnızca sahte yerel veri
├─ tooling/security/  bundle-guard ve public-env denetim script'leri (SEC sahibi)
├─ e2e/               Playwright (web)
└─ docs/              ADR'ler, mimari, güvenlik, veri saklama politikası, runbook'lar
```

**Supabase client mimarisi (platforma özel)**
- **Tek bir ortak client oluşturulmaz.** Her uygulama kendi client fabrikasını yazar:
  - **Web** (`apps/web/src/lib/supabase/`): `@supabase/ssr` ile `createServerClient` (RSC, Server Action, Route Handler; `cookies()` üzerinden), `createBrowserClient` (client component'ler) ve middleware/proxy içinde oturum yenileme. Sunucuda `getUser()`/`getClaims()` ile doğrulama yapılır, `getSession()`'a güvenilmez.
  - **Mobil** (`apps/mobile/src/lib/supabase/`): `@supabase/supabase-js` + SecureStore tabanlı storage adapter. SecureStore'un değer başına boyut sınırı (~2 KB) olduğu için oturum AES ile şifrelenip AsyncStorage'a yazılır, şifre anahtarı SecureStore'da tutulur. `AppState` dinlenerek token otomatik yenilenir. Akış PKCE'dir. Deep link şeması `bingetrail://`.
- **`packages/api-client` yalnızca şunları paylaşır:**
  - `queryKeys` fabrikası (`queryKeys.watchlist.list(filters)` gibi)
  - DTO tipleri ve Zod çıktı şemaları
  - Mapper'lar (DB satırı → DTO)
  - Veri erişim sözleşmeleri, örneğin `getWatchlist(client: TypedSupabaseClient, filters)`. Client'ı parametre olarak alır; client oluşturmaz, oturum yönetmez, platform API'si çağırmaz.
- **TanStack Query hook'ları her uygulamada ince birer katmandır.** Paylaşılan query key'leri ve veri erişim fonksiyonlarını o platformun client'ıyla çağırır. `api-client`, `@supabase/supabase-js`'i yalnızca tip için **peerDependency** olarak tanımlar.

**React ve sürüm politikası**
- Web ve mobil React sürümleri **zorla aynı tutulmaz.**
  - Mobilde Expo SDK belirleyicidir. React Native ve React sürümleri SDK'nın desteklediği değerlere `expo install --check` ile sabitlenir.
  - Web, Next.js'in desteklediği React sürümünü kullanır.
- **Paylaşılan paketler:** `shared`, `api-client`, `db-types` ve `i18n` React'e bağımlı değildir. İleride React'e ihtiyaç duyan bir paket olursa `react` bu pakete yalnızca geniş bir `peerDependencies` aralığıyla girer (ör. `^19.0.0`). Böylece her uygulama kendi React kopyasını kullanır. Kök `pnpm.overrides` ile React zorlanmaz.
- **Kontrol:** CI'da `pnpm why react` çıktısında her uygulamanın tek bir React kopyası çözdüğü doğrulanır.
- Node 24 LTS, pnpm 10.x, Turborepo 2.x. Kesin sürümler Faz 0'ın ilk adımında doğrulanır ve `docs/adr/0001-stack.md` içine yazılır.

**Veri akışı**
- **Katalog:** İstemci → `tmdb` Edge Function (JWT doğrulanır, Zod ile girdi kontrolü yapılır, kullanıcı başına rate limit uygulanır) → TMDB API. Yanıt `titles/seasons/episodes` önbellek tablolarına upsert edilir ve normalize DTO olarak döner.
- **Kullanıcı verisi:** İstemci → Supabase PostgREST (publishable key + kullanıcı JWT'si). Bütün erişimi RLS korur.
- **Senkronizasyon:** Supabase Realtime `postgres_changes` (RLS'e tabi) ile gelen olaylar TanStack Query cache'ini geçersiz kılar ya da yamalar.
- **State:** Sunucu durumu TanStack Query'de, yalnızca UI durumu (filtre, modal, tema) Zustand'da tutulur. Formlar React Hook Form + Zod resolver ile çalışır ve `packages/shared` şemalarını kullanır.
- **Edge Function ↔ paylaşılan şemalar:** `packages/shared/src/contracts` bir script ile `supabase/functions/_shared/contracts` içine kopyalanır (üretilmiş, salt okunur). Bir contract testi iki kopyanın eşit kaldığını doğrular.

---

## 2. Faz Yol Haritası

| # | Faz | Amaç | Platform | Bağımlılık | Karmaşıklık |
|---|-----|------|----------|------------|-------------|
| 0 | Monorepo temeli | Araç zinciri, paket iskeleti, CI, doküman temeli; mobil yalnızca çalışan iskelet | Web + mobil iskelet | — | Düşük–Orta |
| 1 | Supabase çekirdeği | Şema, RLS, profil tetikleyicisi, **hesap silme veri modeli**, pgTAP, tip üretimi | Backend | 0 | Yüksek |
| 2 | Auth + i18n + uygulama kabuğu | Kayıt, giriş, çıkış, şifre sıfırlama; TR/EN; navigasyon | Web | 1 | Orta |
| 3 | TMDB proxy + katalog/arama | `tmdb` fonksiyonu, önbellek, arama ve detay | Web | 1 (backend), 2 (UI) | Yüksek |
| 4 | İzleme listesi, puan, not + **hesap silme UI** | 5 durum, puan, not, `delete-account` | Web | 3 | Orta |
| 5 | Sezon/bölüm takibi + Continue Watching | Bölüm işaretleme, ilerleme, devam et alanı | Web | 4 | Yüksek |
| 6 | **Mobil çekirdek** | Faz 2–5 akışlarının mobile taşınması (hesap silme dahil) | Mobil | 5 | Yüksek |
| 7 | Cihazlar arası senkronizasyon | Realtime, optimistic update, mobil offline kuyruk | Web + mobil | 6 | Yüksek |
| 8 | Yaklaşan bölüm takvimi | Yayın tarihi tazeleme, takvim görünümü | Web → mobil | 5 (web), 6 (mobil) | Orta |
| 9 | JSON/CSV dışa aktarma | `export-user-data`, indirme ve paylaşma | Web → mobil | 4–5 (web), 6 (mobil) | Düşük–Orta |
| 10 | Sertleştirme ve yayın hazırlığı | Güvenlik denetimi, performans, a11y, E2E, EAS build, mağaza | Web + mobil | 7, 8, 9 | Orta |

"Web çekirdeği stabil" kriteri Quality Gate 5'tir. Faz 2–5'in web E2E paketi yeşil olmalı ve iki gate boyunca veri sözleşmelerinde (DTO ve query key) kırıcı değişiklik olmamalı. TR/EN desteği Faz 2'de kurulur, sonraki her faz metinlerini iki dilde teslim eder.

---

## 3. Fazlara Göre Agent Görev Dağılımı

### Dosya sahipliği (paralel yazım çakışmasını önler)

| Agent | Yazabildiği yerler | Yalnızca okuyabildiği yerler |
|---|---|---|
| **Ana uygulama geliştiricisi (APP)** | `apps/web/**`, `apps/mobile/**`, `packages/shared/**`, `packages/api-client/**`, `packages/i18n/**`, `packages/config/**`, kök config (`package.json`, `pnpm-workspace.yaml`, `turbo.json`, `.npmrc`, `.gitignore`, `.editorconfig`, prettier), yanındaki `*.test.ts(x)` birim testleri | supabase/, tooling/ |
| **Veritabanı ve Supabase agentı (DB)** | `supabase/migrations/**`, `supabase/functions/**`, `supabase/tests/database/**`, `supabase/config.toml`, `supabase/seed.sql`, `packages/db-types/**` | apps/ |
| **Güvenlik agentı (SEC)** | `tooling/security/**`, `.gitleaks.toml`, `supabase/tests/security/**`, `docs/security/**`, `SECURITY.md`. Bulgu raporu yazar; düzeltmeyi dosyanın sahibi yapar | her şey |
| **Test / kalite agentı (QA)** | `e2e/**`, `tests/integration/**`, `.github/workflows/**`, `playwright.config.ts` | her şey |
| **Dokümantasyon agentı (DOC)** | `docs/**` (`docs/security` hariç), `README.md`, `CONTRIBUTING.md` | her şey |

- Bir agent başka bir sahibin dosyasında değişiklik gerektiren bir şey bulursa dosyayı düzenlemez. Bulguyu raporlar ve değişikliği sahibi yapar. Örnek: QA veya SEC yeni bir devDependency'ye ihtiyaç duyarsa kök `package.json`'u APP günceller.
- **Hiçbir agent Git komutu çalıştırmaz.**

---

### Faz 0 — Monorepo Temeli
- **Amaç:** Tekrarlanabilir bir geliştirme ortamı. Web ve paketlerde lint, typecheck, test ve build çalışır. Mobil yalnızca açılan bir iskelettir.
- **Kullanıcı değeri:** Doğrudan yok. Sonraki fazların hızını ve güvenliğini sağlar.
- **Teknik teslimler:** pnpm workspace, Turborepo pipeline'ı (`build`, `dev`, `lint`, `typecheck`, `test`, `test:e2e`), ortak tsconfig/eslint/prettier, boş Next.js uygulaması, **yalnızca iskelet Expo uygulaması** (tek ekran, özellik yok), boş paketler, Vitest yapılandırması, Playwright iskeleti, CI iş akışı, bundle-guard ve public-env denetimi, `.env.example` dosyaları, `.gitignore`, ADR-0001.
- **Bağımlılık:** Yok. Ayrı Git deposunu sen açarsın.
- **Kabul kriterleri:** Quality Gate 0 listesine bakınız. Production mobil ya da EAS build **istenmez.**
- **Test stratejisi:** Her pakette bir smoke test, Playwright'ta bir web smoke test, Expo için `tsc --noEmit`.
- **Riskler ve güvenlik:**
  - Expo + pnpm hoisting sorunları (Metro monorepo ayarı, `.npmrc`).
  - Secret sızıntısı. Önlem olarak gitleaks ve bundle-guard kullanılır (Bölüm 6).
  - Paralel yazım çakışması. Önlem: Dalga A'da yalnızca APP çalışır, ardından diğer agent'lar kendi alanlarında çalışır.
- **Karmaşıklık:** Düşük–Orta
- **Görevler:**
  - APP: Kök yapının tamamı, web ve mobil iskeletleri, paket iskeletleri, gereken bütün devDependency'ler (Vitest, Playwright vb.). Tek başına ve önce çalışır.
  - SEC: `tooling/security/**`, `.gitleaks.toml`, `SECURITY.md`, `docs/security/*`.
  - QA: CI ve Playwright.
  - DOC: README, CONTRIBUTING, ADR, mimari doküman.
  - DB: Bu fazda yok. Supabase yapısı Faz 1'de kurulur (CLI kurulumu gerekiyor).
- **Quality Gate 0 (insan onayı):** Bölüm 9'daki liste. Komut çıktıları raporlanır, sen yerelde doğrularsın, commit'i sen atarsın.

### Faz 1 — Supabase Çekirdeği (Şema + RLS + Hesap Silme Modeli)
- **Amaç:** Bütün özellikleri taşıyacak veri modelini en baştan RLS ile güvenli kurmak. Hesap silme bu modelin ilk günden parçasıdır.
- **Kullanıcı değeri:** Verilerin yalnızca kullanıcının kendisine görünmesi ve hesap silindiğinde iz bırakmadan kaldırılması.
- **Teknik teslimler:**
  - Bölüm 5'teki tablolar, enum'lar ve indeksler.
  - `updated_at` tetikleyicileri ve `handle_new_user` profil tetikleyicisi.
  - RLS politikaları.
  - `avatars` storage bucket'ı ve politikaları.
  - Realtime publication.
  - **Hesap silme veri modeli:** Kullanıcıya ait bütün tablolarda `auth.users` FK'si `on delete cascade` olur. Storage temizleme sırası tanımlanır. `account_deletion_log` tablosu kişisel veri içermez (Bölüm 5).
  - pgTAP testleri ve `packages/db-types`.
- **Bağımlılık:** Faz 0. Supabase CLI'yı sen kurarsın; `supabase init` ve `start` komutlarını sen çalıştırırsın.
- **Kabul kriterleri:**
  - `supabase db reset` temiz çalışır.
  - Her tabloda RLS açıktır.
  - A kullanıcısı B'nin verisini okuyamaz, yazamaz, silemez.
  - Katalog tablolarına `authenticated` rolü yazamaz.
  - Bir `auth.users` kaydı silindiğinde kullanıcıya ait bütün satırlar silinir. Katalog tabloları etkilenmez. `account_deletion_log` tablosuna kişisel veri yazılmaz.
  - Supabase advisor'larında kritik bulgu yoktur.
- **Test stratejisi:** pgTAP ile şunlar test edilir: şema, kısıtlar, RLS pozitif ve negatif senaryoları, anon erişiminin reddi, **cascade silme testi**, `account_deletion_log` tablosunun istemci rolleri tarafından okunamaması.
- **Riskler ve güvenlik:**
  - RLS performansı için `(select auth.uid())` kalıbı kullanılır.
  - View'larda `security_invoker = true` zorunludur. `SECURITY DEFINER` fonksiyonlarında `search_path` sabitlenir.
  - Unutulan bir FK yetim kişisel veri bırakabilir. Önlem: pgTAP, `user_id` kolonu olan her tablonun cascade FK'ye sahip olduğunu katalog sorgusuyla doğrular.
  - Migration'ları prod'a sen uygularsın.
- **Karmaşıklık:** Yüksek
- **Görevler:** DB: migration'lar, pgTAP, tip üretimi · SEC: `supabase/tests/security/rls_isolation.test.sql`, `account_deletion.test.sql`, tehdit modeli v1 · QA: CI'a pgTAP job'ı · DOC: `docs/data-model.md`, `docs/account-deletion.md` (akış tasarımı) · APP: yazmaz, şemayı inceler.
- **Quality Gate 1:** RLS ve cascade test raporu ile advisor çıktısı incelenir. Migration'ı uzak projeye sen push'larsın.

### Faz 2 — Auth, i18n ve Uygulama Kabuğu (Web)
- **Amaç:** Web'de hesap yaşam döngüsü ve iki dilli uygulama kabuğu.
- **Kullanıcı değeri:** Kayıt, giriş, çıkış, şifre sıfırlama; TR/EN dil seçimi.
- **Teknik teslimler:**
  - `apps/web/src/lib/supabase/` altında server, browser ve middleware client fabrikaları.
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
  - `api-client` paketinde `@supabase/ssr`, `next/*` veya `expo-*` import'u yoktur (lint kuralı).
- **Test stratejisi:** Vitest ile şemalar ve mapper'lar, RTL ile formlar, Playwright ile auth E2E (yerel Supabase + Mailpit), i18n anahtar eşleşme testi.
- **Riskler ve güvenlik:** Redirect allowlist'i, Auth rate limit, parola politikası, cookie ayarları (`HttpOnly`, `Secure`, `SameSite`), Server Action CSRF koruması.
- **Karmaşıklık:** Orta
- **Görevler:** APP: web auth, i18n, kabuk, ilk sözleşmeler · DB: auth config (`config.toml`: e-posta şablonları, redirect URL'leri) · SEC: auth incelemesi, enumeration ve redirect testleri · QA: auth E2E · DOC: `docs/auth.md`.
- **Quality Gate 2:** Akışları web'de sen elle denersin. Supabase dashboard ayarlarını sen yaparsın.

### Faz 3 — TMDB Proxy ve Katalog/Arama (Web)
- **Amaç:** TMDB verisine güvenli ve önbellekli erişim.
- **Kullanıcı değeri:** Film/dizi arama, detay sayfası, sezon ve bölüm listesi; TR/EN içerik dili.
- **Teknik teslimler:**
  - `tmdb` Edge Function'ın `search`, `title` ve `season` uçları. Her uçta JWT zorunludur, girdi Zod ile doğrulanır, yanıt normalize edilir, `language` parametresi desteklenir.
  - TTL ile önbellek upsert'i ve kullanıcı başına rate limit.
  - `api-client` içinde katalog DTO'ları, mapper'lar ve `queryKeys.catalog`.
  - Web hook'ları ve arama, detay, sezon ekranları.
  - TMDB atıf metni.
- **Bağımlılık:** Fonksiyon için Faz 1, UI için Faz 2.
- **Kabul kriterleri:** İstemci build çıktısı bundle-guard'dan geçer. JWT'siz çağrı 401, geçersiz parametre 400 alır. Tekrarlanan detay isteği önbellekten gelir. Arama TR ve EN'de sonuç döndürür.
- **Test stratejisi:** Deno testleri (TMDB mock'lu fetch), Vitest + MSW ile veri erişim fonksiyonları, Playwright ile arama → detay akışı.
- **Riskler ve güvenlik:** Path'ler beyaz listeden kurulur (SSRF engeli). TMDB kotası için önbellek ve backoff. CORS allowlist'i. TMDB atıf şartı.
- **Karmaşıklık:** Yüksek
- **Görevler:** DB: Edge Function ve `_shared` · APP: sözleşmeler, web hook'ları, UI · SEC: fonksiyon tehdit incelemesi · QA: E2E ve MSW fixture'ları · DOC: `docs/edge-functions/tmdb.md`, secret runbook'u (değer içermez).
- **Quality Gate 3:** TMDB secret'ını sen girersin, fonksiyonu sen deploy edersin.

### Faz 4 — İzleme Listesi, Puan, Notlar ve Hesap Silme (Web)
- **Amaç:** Çekirdek takip deneyimi ve hesap silmenin kullanıcıya açılması.
- **Kullanıcı değeri:** Listeye ekleme; planned/watching/completed/paused/dropped durumları; 1–10 puan; kişisel not; filtreleme ve sıralama. **Profil > Hesabı sil.**
- **Teknik teslimler:**
  - `watchlist_items` sözleşmeleri ve web hook'ları (optimistic update).
  - Durum geçiş kuralları (`packages/shared`).
  - Liste ekranı, durum seçici, puan ve not formu.
  - **`delete-account` Edge Function:** JWT doğrulanır ve parola yeniden girilir (re-auth). Önce `avatars/{uid}/` altındaki dosyalar silinir. Ardından service role ile `auth.admin.deleteUser` çağrılır; cascade bütün kullanıcı verisini temizler. Son olarak `account_deletion_log` tablosuna kişisel veri içermeyen bir kayıt düşer.
  - Web'de iki adımlı onay ekranı. "Silmeden önce verilerini dışa aktar" bağlantısı Faz 9'da eklenir.
- **Bağımlılık:** Faz 3 (veri modeli Faz 1'den gelir).
- **Kabul kriterleri:**
  - Aynı başlık iki kez eklenemez.
  - Puan ve not kısıtları hem DB'de hem istemcide uygulanır.
  - Not güvenle render edilir.
  - Hesap silindikten sonra oturum düşer, aynı e-postayla giriş başarısız olur, DB'de ve storage'da kullanıcı verisi kalmaz.
  - Re-auth olmadan silme reddedilir.
  - Onay ekranı işlemin **geri alınamaz** olduğunu ve neyin silineceğini (liste, puan, not, bölüm geçmişi, avatar) TR ve EN olarak açıkça gösterir. Bekleme süresi yoktur, silme anında gerçekleşir (K13).
- **Test stratejisi:** Vitest ile durum makinesi, RTL ile formlar ve silme onayı. Deno testleri: `delete-account` için yetkisiz çağrı, başka kullanıcının id'si ve re-auth eksik senaryoları. Playwright ile liste akışı ve hesap silme E2E. pgTAP ile kısıtlar.
- **Riskler ve güvenlik:**
  - `delete-account` silinecek hesabı yalnızca JWT'deki `sub`'dan alır, gövdeden gelen kullanıcı id'si kabul edilmez.
  - Service role yalnızca bu işlem için kullanılır.
  - Fonksiyona rate limit uygulanır.
  - Notlar log'lara yazılmaz. `dangerouslySetInnerHTML` yasaktır.
- **Karmaşıklık:** Orta
- **Görevler:** APP: domain, web UI, hesap silme ekranı · DB: `delete-account` fonksiyonu, gerekiyorsa ek kısıt veya indeks · SEC: silme akışı ve IDOR incelemesi · QA: E2E · DOC: kullanıcı rehberi, `docs/account-deletion.md` güncellemesi.
- **Quality Gate 4.**

### Faz 5 — Sezon/Bölüm Takibi ve Continue Watching (Web)
- **Amaç:** Dizilerde bölüm düzeyinde ilerleme.
- **Kullanıcı değeri:** Bölüm, sezon veya "buraya kadar" işaretleme; ilerleme çubuğu; Ana sayfada "Continue Watching".
- **Teknik teslimler:**
  - `mark_episodes_watched(episode_ids[])` ve `unmark_episodes` RPC'leri (security invoker).
  - `get_continue_watching()`.
  - Bölüm işaretlendiğinde `last_activity_at` güncellenir.
  - Tüm yayınlanmış bölümler izlenince "Tamamlandı olarak işaretle?" önerisi çıkar.
  - `api-client` içinde ilerleme sözleşmeleri, web'de UI.
- **Bağımlılık:** Faz 4.
- **Kabul kriterleri:** 100'den fazla bölümlük toplu işaretleme tek istekte biter. Continue Watching doğru bölümü gösterir (sezon 0 hariç). Yayınlanmamış bölüm işaretlenemez.
- **Test stratejisi:** pgTAP ile RPC'ler ve RLS. Vitest ile ilerleme hesabı. Playwright ile E2E.
- **Riskler ve güvenlik:** Security invoker kullanımı, dizi boyutu limiti, N+1 sorguları.
- **Karmaşıklık:** Yüksek
- **Görevler:** DB: RPC'ler ve pgTAP · APP: sözleşmeler ve web UI · SEC: RPC incelemesi · QA: E2E ve performans ölçümü · DOC: veri modeli güncellemesi.
- **Quality Gate 5 = "web çekirdeği stabil" kapısı.** Mobil faza geçiş onayı da bu kapıda verilir.

### Faz 6 — Mobil Çekirdek
- **Amaç:** Stabil web çekirdeğini, olgunlaşmış sözleşmeleri yeniden kullanarak mobile taşımak.
- **Kullanıcı değeri:** Telefonda kayıt, giriş, çıkış ve şifre sıfırlama; arama; liste, puan ve not; bölüm takibi; Continue Watching; hesap silme; TR/EN.
- **Teknik teslimler:**
  - `apps/mobile/src/lib/supabase/client.ts` (SecureStore adapter, AppState ile token yenileme).
  - Expo Router auth grubu ve `bingetrail://` ile şifre sıfırlama deep link'i.
  - i18next + `expo-localization`, `packages/i18n` içindeki ortak TR/EN JSON mesajlarıyla (K12).
  - Mobil TanStack hook'ları: `api-client` içindeki query key ve veri erişim fonksiyonlarını mobil client ile çağıran ince katman.
  - NativeWind ekranları.
  - Hesap silme ekranı (aynı `delete-account` fonksiyonu kullanılır).
- **Bağımlılık:** Faz 5 (Quality Gate 5 onayı).
- **Kabul kriterleri:** Faz 2–5 akışları Android emülatöründe ve iOS'ta (Expo Go veya dev build) çalışır. `api-client` paketinde mobil için değişiklik gerekmez; gerekirse bu bir sözleşme hatası sayılır ve raporlanır. Mobil bundle bundle-guard'dan geçer (`expo export` çıktısı).
- **Test stratejisi:** Ekran testleri `jest-expo` + React Native Testing Library ile yazılır (K10). Ortak mantık testleri paketlerde Vitest'te kalır. Mobil E2E otomasyonu bu fazda yoktur; bunun yerine `docs/mobile-device-checklist.md` ile elle cihaz kontrolü yapılır (K11).
- **Riskler ve güvenlik:**
  - SecureStore boyut sınırı (şifreli AsyncStorage + SecureStore anahtarı ile çözülür).
  - Deep link ele geçirme (PKCE ve tek kullanımlık kod).
  - Cihaz yedeklerinde token (SecureStore `keychainAccessible` ayarı).
  - Expo SDK'nın React sürümünün web'den farklı olması. Bu beklenen bir durum; paylaşılan paketler React'ten bağımsız.
- **Karmaşıklık:** Yüksek
- **Görevler:** APP: mobil uygulama · DB: değişiklik beklenmez (yalnızca redirect URL'leri) · SEC: mobil oturum depolama ve deep link incelemesi · QA: mobil test altyapısı ve kontrol listesi · DOC: `docs/mobile.md`.
- **Quality Gate 6:** Cihazda sen elle denersin. EAS build gerekmez.

### Faz 7 — Cihazlar Arası Senkronizasyon
- **Amaç:** Web ve mobil arasında anlık tutarlılık, mobilde offline dayanıklılık.
- **Kullanıcı değeri:** Telefonda işaretlenen bölüm web'de anında görünür; bağlantı yokken yapılan işlemler sonra senkronlanır.
- **Teknik teslimler:**
  - Realtime abonelik yardımcıları her uygulamada ayrı yazılır. `api-client` yalnızca olay → DTO mapper'ı ve etkilenen query key'leri paylaşır.
  - Mobilde TanStack Query persist ve duraklatılmış mutation kuyruğu.
  - Çakışma politikası: `watchlist_items` için `updated_at` ile last-write-wins; `episode_progress` idempotent.
  - Bağlantı durumu göstergesi.
- **Bağımlılık:** Faz 6.
- **Kabul kriterleri:** Değişiklik 2 saniye içinde öteki istemcide görünür. Offline'da yapılan 10 işlem kayıpsız uygulanır. Başka kullanıcının olayları alınmaz.
- **Test stratejisi:** İki browser context'li Playwright senaryosu, kuyruk ve çakışma mantığı için Vitest, realtime yetki güvenlik testi, web ↔ mobil elle test.
- **Riskler ve güvenlik:** Realtime RLS doğrulaması, kanal sızıntısı, pil tüketimi, saat kayması (sunucu `now()` esas alınır).
- **Karmaşıklık:** Yüksek
- **Görevler:** APP: senkron katmanı · DB: publication ve replica identity · SEC: realtime yetki testi · QA: çoklu istemci E2E · DOC: `docs/sync.md`.
- **Quality Gate 7.**

### Faz 8 — Yaklaşan Bölüm Takvimi
- **Amaç:** Takip edilen dizilerin yaklaşan bölümlerini göstermek.
- **Kullanıcı değeri:** Haftalık ve aylık takvim, "bugün / bu hafta" listesi.
- **Teknik teslimler:**
  - `refresh-upcoming` Edge Function (`pg_cron` + `pg_net`, gizli cron header'ı).
  - `get_upcoming_episodes(from, to)`.
  - Önce web takvimi, Faz 6 tamamlandıktan sonra mobil ekran.
- **Bağımlılık:** Backend ve web için Faz 5 (Faz 6 ile paralel yürüyebilir); mobil ekran için Faz 6.
- **Kabul kriterleri:** Yeni yayın tarihi en geç 24 saat içinde görünür. Fonksiyon anonim olarak tetiklenemez. Tarihler TR ve EN biçiminde gösterilir.
- **Test stratejisi:** Deno ile seçim mantığı, pgTAP ile tarih aralığı fonksiyonu, Vitest ile saat dilimi yardımcıları, Playwright ile takvim görünümü.
- **Riskler ve güvenlik:** TMDB rate limit (batch ve gecikme), yetkisiz cron çağrısı, TMDB'nin saat bilgisi vermemesi.
- **Karmaşıklık:** Orta
- **Görevler:** DB: fonksiyon ve cron migration'ı · APP: takvim UI'ı · SEC: cron yetkilendirme incelemesi · QA: testler · DOC: cron runbook'u.
- **Quality Gate 8:** Cron'u prod'da sen etkinleştirirsin.

### Faz 9 — JSON ve CSV Dışa Aktarma
- **Amaç:** Veri taşınabilirliği.
- **Kullanıcı değeri:** Liste, puan, not ve bölüm geçmişini JSON veya CSV olarak indirmek.
- **Teknik teslimler:**
  - `export-user-data` Edge Function. **Kullanıcının kendi JWT'siyle** çalışır; service role kullanılmaz, RLS uygulanır.
  - Sürümlü JSON şeması (`schemaVersion`).
  - İki CSV dosyası: items ve episodes.
  - Formatlayıcı `packages/shared` içinde.
  - Önce web'de indirme, Faz 6'dan sonra mobilde `expo-sharing` ile paylaşım.
  - Hesap silme ekranına "önce dışa aktar" bağlantısı.
- **Bağımlılık:** Web için Faz 4–5, mobil için Faz 6.
- **Kabul kriterleri:** Çıktıda yalnızca kendi verin bulunur. Excel'de Türkçe karakterler bozulmaz (UTF-8 BOM). Formül enjeksiyonu nötralize edilir.
- **Test stratejisi:** Formatlayıcı için snapshot ve kenar durumu testleri, RLS izolasyon testi, Playwright ile indirme testi.
- **Riskler ve güvenlik:** CSV injection. Büyük hesaplarda zaman aşımı (sayfalama ve streaming). Export dosyası sunucuda saklanmaz.
- **Karmaşıklık:** Düşük–Orta
- **Görevler:** DB: fonksiyon · APP: formatlayıcı ve UI · SEC: injection incelemesi · QA: testler · DOC: export formatı belgesi.
- **Quality Gate 9.**

### Faz 10 — Sertleştirme ve Yayın Hazırlığı
- **Amaç:** Üretime hazır kalite.
- **Teknik teslimler:** OWASP ASVS L1 kontrol listesi, CSP ve güvenlik header'ları, bağımlılık denetimi, Web Vitals bütçeleri, erişilebilirlik (axe + elle kontrol), hata izleme önerisi, **EAS build profilleri** (ilk production mobil build burada; build ve submit'i sen yaparsın), **mobil E2E için Maestro değerlendirmesi** (K11), **hosting seçimi** (K15), gizlilik politikası taslağı (hesap silme ve veri saklama bölümleriyle).
- **Kabul kriterleri:** Kritik veya yüksek güvenlik bulgusu yok. E2E paketi yeşil. Lighthouse ≥ 90. TR/EN eksik anahtar yok. Mağaza hesap silme gereksinimi karşılanmış (Faz 4 ve 6'dan).
- **Karmaşıklık:** Orta
- **Quality Gate 10 (yayın kararı):** Deploy ve mağaza gönderimini sen yaparsın.

---

## 4. Paralel Çalışma Dalgaları

**Fazlar arası:**
```
0 → 1 → 2 → 3 → 4 → 5 ─┬→ 6 (mobil) → 7 (senkron) ─┐
                        ├→ 8 (takvim: backend+web) ──┼→ 10
                        └→ 9 (export: backend+web) ──┘
                 8 ve 9'un mobil ekranları 6 tamamlandıktan sonra eklenir
```

- Faz 2 sürerken DB agentı Faz 3'ün Edge Function'ına başlayabilir (yalnızca `supabase/functions/**`).
- Faz 6 (yalnızca APP'nin `apps/mobile/**` alanı) ile Faz 8 ve 9'un backend ve web işleri paralel yürüyebilir.
  - APP her iki iş akışının da sahibi olduğu için aynı anda tek bir APP oturumu çalışır. İşler sırayla değil, ayrı dosya alanlarında yürür: mobil işler `apps/mobile/**`, web işleri `apps/web/**` içinde kalır.
  - Faz 8 ve 9'un DB işleri tek DB agentında sıralı yapılır. Migration zaman damgası çakışması böylece önlenir.

**Faz içi standart dalga modeli (Faz 1 ve sonrası):**

| Dalga | Paralel işler | Sıralı olma nedeni |
|---|---|---|
| A — Sözleşme | APP: `packages/shared` + `packages/api-client` sözleşmeleri ∥ DB: migration ve RPC imzaları ∥ DOC: tasarım notu | — |
| B — Uygulama | APP: UI ve platform hook'ları ∥ DB: pgTAP ve Edge Function ∥ QA: E2E iskeleti ve fixture'lar | A'daki tiplere bağlı (`db-types` A'nın sonunda üretilir) |
| C — Doğrulama | SEC ∥ QA ∥ DOC | B'nin bitmiş olması gerekir |
| D — Düzeltme | Bulgular dosya sahiplerine gider, sıralı düzeltilir | C'ye bağlı |
| Gate | İnsan onayı | — |

**Faz 0 bu modelden farklıdır:** Önce APP tek başına çalışır, sonra SEC, QA ve DOC kendi alanlarında paralel çalışır (Bölüm 9).

---

## 5. Veritabanı ve RLS Planı

**Enum'lar:** `media_type ('movie','tv')`, `watch_status ('planned','watching','completed','paused','dropped')`

**Tablolar**

| Tablo | Temel kolonlar | RLS |
|---|---|---|
| `profiles` | `id` (pk, `auth.users` FK, **on delete cascade**), `display_name`, `locale ('tr','en')`, `timezone`, `avatar_path`, zaman damgaları | select ve update: `id = (select auth.uid())`. Insert yalnızca tetikleyiciyle |
| `titles` (katalog önbelleği) | `id`, `tmdb_id`, `media_type`, unique(`tmdb_id`,`media_type`), `original_title`, `poster_path`, `backdrop_path`, `release_date`, `tmdb_status`, `number_of_seasons`, `translations jsonb`, `fetched_at`, `last_referenced_at` | select: `authenticated`. Yazma yalnızca service role ile |
| `seasons` | `id`, `title_id` FK, `season_number`, `name`, `air_date`, `episode_count`, `fetched_at` | Yalnızca okuma |
| `episodes` | `id`, `season_id` FK, `title_id` FK, `episode_number`, `season_number`, `name jsonb`, `air_date`, `runtime` | Yalnızca okuma |
| `watchlist_items` | `id`, `user_id` FK (**cascade**), `title_id` FK (**restrict**: listede olan bir başlık önbellekten silinemez), `status`, `rating smallint check 1–10`, `notes text check ≤ 5000`, `started_at`, `completed_at`, `last_activity_at`, zaman damgaları, unique(`user_id`,`title_id`) | Bütün işlemler için `user_id = (select auth.uid())`; insert ve update'te `with check` |
| `episode_progress` | pk(`user_id`,`episode_id`), `user_id` FK (**cascade**), `title_id`, `watched_at` | select, insert, delete: sahiplik. Update yok |
| `rate_limits` | `user_id` FK (**cascade**), `bucket`, `window_start`, `count` | İstemci erişimi yok. Yalnızca Edge Function'lar (service role) |
| `account_deletion_log` | `id`, `deleted_at`, `user_id_hash` (tuzlu SHA-256, geri döndürülemez), `reason_code` (opsiyonel) | **İstemci erişimi yok.** Yalnızca `delete-account` fonksiyonu yazar. E-posta, ad veya not tutulmaz |

**Hesap silme tasarımı (Faz 1'de modellenir, Faz 4'te kullanıcıya açılır):**
1. Kullanıcıya ait her tablonun `auth.users(id)`'ye `on delete cascade` FK'si vardır. pgTAP, `user_id` kolonu olup cascade FK'si olmayan tablo kalmadığını katalog sorgusuyla doğrular.
2. Storage cascade'e girmez. `delete-account` fonksiyonu önce `avatars/{uid}/` altını temizler, sonra kullanıcıyı siler. Storage silme başarısız olursa kullanıcı silinmez ve işlem yeniden denenebilir.
3. Silinecek kullanıcı yalnızca JWT'deki `sub`'dan alınır. Parola yeniden doğrulanır (re-auth).
4. Katalog tabloları kullanıcıya bağlı değildir, etkilenmez.
5. Bekleme süresi yoktur, silme anında ve kalıcı olarak gerçekleşir (K13). Arayüz, işlemin geri alınamaz olduğunu açıkça gösterir.

**Fonksiyonlar ve view'lar (tümü `security invoker`, `search_path` sabit):** `mark_episodes_watched`, `unmark_episodes`, `get_continue_watching`, `get_upcoming_episodes`, `touch_last_activity` tetikleyicisi, `catalog_cache_stats()` (yalnızca okuma raporu, service role), `handle_new_user` (security definer, minimal ve denetlenmiş).

**İndeksler:** `watchlist_items(user_id, status)`, `watchlist_items(user_id, last_activity_at desc)`, `episode_progress(user_id, title_id)`, `episodes(title_id, air_date)`, `titles(tmdb_id, media_type)`, `titles(last_referenced_at)`.

**Storage:** `avatars` bucket'ı private'tır. Politika: `(storage.foldername(name))[1] = (select auth.uid())::text`. Boyut ve MIME limiti var; okuma signed URL ile yapılır.

**Realtime:** publication = `watchlist_items`, `episode_progress`. RLS'e tabidir.

**Katalog önbelleği saklama politikası** (`docs/data-retention.md`, Faz 3'te yazılır):
- Katalog verisi kişisel veri değildir. TMDB şartları gereği önbellek "makul süre" tutulur ve periyodik olarak tazelenir.
- Bir kullanıcının listesinde olan başlık asla silinmez (FK restrict).
- Silme adayı: hiçbir listede olmayan ve `last_referenced_at` değeri 90 günden eski kayıtlar. Bu eşik, gözlem verisi toplandıktan sonra kesinleşir.
- **Temizleme cron'u başlangıçta pasif tutulur.** Bölüm 8'e bakınız.

**Migration kuralları:** Migration'lar ileri yönlüdür ve yayından sonra düzenlenmez. Her migration'ın pgTAP karşılığı vardır. `seed.sql` yalnızca sahte veri içerir. Uzak ortama uygulamayı sen yaparsın.

---

## 6. Güvenlik Planı

1. **Anahtar yönetimi:** İstemcilerde yalnızca Supabase URL'si ve publishable key bulunur. TMDB token'ı Edge Function secret'ıdır. Service role yalnızca `tmdb`, `refresh-upcoming` ve `delete-account` fonksiyonlarında kullanılır.
2. **Secret bundle ve public-env denetimi** (`tooling/security/`, SEC sahibi, her CI çalışmasında):
   - **Taranan yerler:**
     - Web istemci çıktısı: `apps/web/.next/static/**`
     - Mobil bundle: Faz 6'dan sonra `expo export` çıktısı
     - Bütün `.env.example` dosyaları
     - Kaynak koddaki `process.env.NEXT_PUBLIC_*` ve `process.env.EXPO_PUBLIC_*` referansları
   - **Token desenleri (değer tabanlı):**
     - `sb_secret_` önekli Supabase secret key'leri.
     - JWT biçimli diziler (`eyJ…`). Payload decode edilir. `role: service_role` içeren ya da TMDB okuma token'ı imzası taşıyan (`scopes` içinde `api_read`) her JWT hata verir.
     - `service_role` dizesi.
     - `.env.example` dosyalarında boş olmayan herhangi bir değer.
     - Genel yüksek entropili anahtar desenleri, gitleaks'in varsayılan kurallarıyla birlikte.
   - **Public env denetimi (ad tabanlı, allowlist):**
     - İzin verilen public değişkenler yalnızca `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` ve bunların `EXPO_PUBLIC_*` karşılıkları. Listede olmayan her yeni `NEXT_PUBLIC_*`/`EXPO_PUBLIC_*` değişkeni SEC onayı gerektirir.
     - Adında `SECRET|SERVICE|PRIVATE|TOKEN|PASSWORD|TMDB|KEY` geçen ve allowlist'te olmayan bir public değişken doğrudan hata verir.
     - Public key değişkeninin değeri build zamanında kontrol edilir. Değer `sb_secret_` ile başlıyorsa veya `service_role` JWT'siyse build başarısız olur. Bu, yanlış anahtarın public değişkene yapıştırılmasını yakalar.
   - **Yanlış pozitifler:** Yalnızca `tooling/security/allowlist.json` içine gerekçe yazılarak ve SEC onayıyla eklenir.
3. **Kimlik doğrulama:**
   - PKCE akışı.
   - Web'de sunucu tarafı `getUser`/`getClaims` ile doğrulama ve HttpOnly cookie'ler.
   - Mobilde şifreli oturum depolama (SecureStore'da anahtar).
   - Redirect allowlist'i, sızmış parola koruması, minimum parola uzunluğu (Supabase ayarlarını sen yaparsın).
   - Hata mesajları hesap varlığını sızdırmaz.
4. **Yetkilendirme:** Her tabloda RLS açık ve varsayılan olarak her şey reddedilir. Negatif testler zorunlu. View'lar `security_invoker`. Security definer fonksiyonu minimum sayıda tutulur. Hesap silme yalnızca JWT `sub` ve re-auth ile yapılır.
5. **Edge Functions:** JWT doğrulaması, Zod girdi doğrulaması, beyaz listeli TMDB path'leri, kullanıcı başına rate limit, CORS allowlist'i, hata yanıtlarında stack trace yok, log'larda PII ve token yok.
6. **Web:** CSP, `X-Frame-Options`, `Referrer-Policy`, `dangerouslySetInnerHTML` yasağı.
7. **Veri:** CSV injection önlemi. Export dosyası saklanmaz. Notlar log'lara yazılmaz. Hesap silme logunda kişisel veri tutulmaz.
8. **Repo hijyeni:** Bağımsız Git deposu (üst depo uyarısı, Bağlam bölümü). gitleaks hem CI'da hem pre-commit önerisi olarak bulunur; hook'u sen kurarsın.
9. **Tedarik zinciri:** pnpm lockfile, `pnpm audit`, Dependabot veya Renovate önerisi. Yeni bağımlılık eklendiğinde SEC incelemesi yapılır.
10. **Tehdit modeli:** `docs/security/threat-model.md`, her fazda güncellenir (STRIDE).

---

## 7. Test ve Kalite Kapıları

| Katman | Araç | Kapsam |
|---|---|---|
| Domain ve şema | Vitest | `packages/shared` (hedef ≥ %90) |
| Veri sözleşmeleri | Vitest + MSW | `packages/api-client`: mapper'lar, query key'ler, veri erişim fonksiyonları (sahte client ile) |
| Web bileşenleri | Vitest + React Testing Library | Formlar, liste, durum seçici, hesap silme onayı |
| Mobil ekranlar | Faz 0'da yalnızca `tsc --noEmit`. Faz 6'dan itibaren `jest-expo` + React Native Testing Library (K10) | Ekran davranışı |
| Mobil E2E | Faz 6'da elle cihaz kontrol listesi. Faz 10'da Maestro değerlendirmesi (K11) | Uçtan uca mobil akışlar |
| Veritabanı | pgTAP | Şema, kısıtlar, RLS, RPC, cascade silme |
| Edge Functions | Deno test | Doğrulama, normalizasyon, yetki, IDOR |
| E2E | Playwright (web) | Auth, arama, liste, bölüm, hesap silme, takvim, export, çoklu istemci |
| Statik | tsc strict, ESLint (`api-client` içinde platform import yasağı dahil), Prettier, i18n anahtar eşleşmesi, gitleaks, bundle-guard, public-env denetimi | Her CI çalışmasında |

**Her fazın quality gate kontrol listesi (insan onayı zorunlu):**
1. Fazın kapsadığı paketlerde `lint`, `typecheck`, `test` ve `build` yeşil (komut çıktısı raporlanır)
2. Fazın pgTAP ve Deno testleri yeşil
3. Playwright senaryoları yeşil
4. Bundle-guard ve public-env denetimi temiz
5. SEC raporunda açık kritik veya yüksek bulgu yok
6. TR/EN metinleri tamam
7. Dokümantasyon güncel
8. Yeni migration ve secret ihtiyaçları listelenir (değerler değil, yalnızca adlar)
9. Önerilen commit mesajı. **Commit, push ve deploy'u sen yaparsın.** Onayın gelmeden bir sonraki faza geçilmez.

---

## 8. Önerilen Zamanlanmış Rutinler

Hiçbiri senin onayın olmadan kurulmaz. Uygulama içi cron'ları prod'da sen etkinleştirirsin.

**Uygulama içi (Supabase `pg_cron`):**

| Rutin | Sıklık | Başlangıç durumu |
|---|---|---|
| `refresh-upcoming`: takip edilen devam eden dizilerin tarihlerini tazeler | Günlük 03:00 UTC | Faz 8 gate'inde senin onayınla aktif |
| `rate_limits` sayaçlarını temizler (kişisel veri içermeyen operasyonel tablo) | Günlük | Faz 3 gate'inde senin onayınla aktif |
| **`catalog_cache_report`:** `catalog_cache_stats()` sonucunu `maintenance_reports` tablosuna yazar. Ne silinir ne değişir; yalnızca okur | Haftalık | Faz 3'ten itibaren aktif olabilir (yalnızca rapor) |
| **`catalog_cache_cleanup`:** Bir listede olmayan ve eşikten eski kayıtları siler | Haftalık | **Pasif.** Fonksiyon yazılır, cron tanımı yorum satırında veya `active = false` olarak bekler |

**Katalog temizliğinin etkinleştirme koşulları:**
1. `docs/data-retention.md` onaylanmış olmalı.
2. En az 4 haftalık `catalog_cache_report` verisi incelenmiş olmalı: toplam kayıt, yetim kayıt sayısı, yaş dağılımı, haftalık büyüme.
3. Önce kuru çalıştırma yapılır. `catalog_cache_cleanup(dry_run => true)` silinecek kayıt sayısını raporlar.
4. Eşik (90 gün) gözleme göre kesinleşir.
5. Etkinleştirmeye sen karar verirsin ve sen açarsın.
6. Her gerçek çalıştırma silinen kayıt sayısını `maintenance_reports` tablosuna yazar.

**Geliştirme rutinleri (Claude Code `/schedule` ile, yalnızca rapor üretir; commit, PR veya Git işlemi yapmaz):**
- **Haftalık:** Bağımlılık denetimi (`pnpm audit`, güncel olmayan paketler, Expo SDK uyumluluğu).
- **Haftalık:** Supabase advisor çıktısı, RLS kapsam raporu ve `catalog_cache_report` özeti.
- **Gecelik (staging varsa):** Playwright E2E smoke.
- **Aylık:** Secret rotasyon hatırlatması (rotasyonu sen yaparsın) ve TMDB kullanım şartları ve atıf kontrolü.

---

## 9. İlk Uygulanacak Faz: Faz 0, Ayrıntılı Görev Listesi

**Ortam kontrolü (salt okuma, 2026-10-14):**
- ✅ Node `v24.18.1`, pnpm `10.34.7`, corepack `0.35.0`, Docker `29.4.3`
- ❌ **Supabase CLI kurulu değil.** Faz 0'ı engellemez; Faz 1'den önce gerekli.
- ⚠️ **Üst Git deposu:** `C:/Users/elqnu`. Ayrıntısı Bağlam bölümünde. Faz 0'a başlamadan önce `bingetrail` içinde bağımsız depoyu sen açarsın. Agent'lar Git komutu çalıştırmaz.

**npm'deki güncel sürümler (salt okuma `npm view`, 2026-10-14):** next 16.4.0 · react 19.3.0 · expo 57.0.28 (expo-router 57, react-native 0.87.1) · turbo 2.11.8 · typescript 7.0.2 · vitest 5.0.4 · @playwright/test 1.64.0 · tailwindcss 4.3.3 · nativewind 4.2.7 · eslint 10.12.0 · typescript-eslint 8.71.2 · zod 4.6.7 · prettier 3.9.10.
- **Sürüm notları:**
  - TypeScript 7 ile başlanır (K14). typescript-eslint ve Next uyumluluğu Dalga A'da doğrulanır. Uyumsuzluk çıkarsa uyumlu en güncel sürüme sabitlenir ve `docs/adr/0001-stack.md`'ye yazılır.
  - Mobilde React ve React Native sürümlerini Expo SDK 57 belirler (`expo install --check`). Web React sürümü bağımsızdır; eşitlik zorlanmaz.
  - NativeWind 4 Tailwind 3 tabanlıdır, web ise Tailwind 4 kullanır. Bu yüzden ortak olan yalnızca tasarım token'larıdır (`packages/config/tokens`).

**Ön koşullar (sen yaparsın):** `bingetrail` için bağımsız Git deposu, Supabase CLI (Faz 1'den önce), isteğe bağlı olarak Expo Go veya Android emülatörü (iskeletin açıldığını görmek için).

**Dalga A — yalnızca APP, tek başına ve sıralı.** Bu dalga bitene kadar başka hiçbir agent çalışmaz.
1. Güncel sürümler doğrulanır. TS 7 ile ESLint ve Next uyumu kontrol edilir. Sonuçlar Dalga B'de DOC'a not olarak verilir.
2. Kök dosyalar: `package.json` (`packageManager`, `engines.node >=24`, script'ler; QA ve SEC'in ihtiyaç duyacağı devDependency'ler dahil: `@playwright/test`, `vitest` vb.), `pnpm-workspace.yaml`, `turbo.json` (`build` görevi web ve paketleri kapsar, mobil production build'i kapsamaz), `.npmrc`, `.nvmrc`, `.gitignore` (`.env*`, `!.env.example`, build çıktıları), `.editorconfig`, prettier config.
3. `packages/config`: `tsconfig.base.json` (strict, `noUncheckedIndexedAccess`), ESLint flat config (React, a11y, `dangerouslySetInnerHTML` yasağı, `packages/api-client` için `next/*`, `@supabase/ssr`, `expo-*`, `react-native` import yasağı), ortak Vitest config, tasarım token'ları.
4. `apps/web`: Next.js App Router iskeleti, Tailwind 4, `/` sayfası, `next.config` (`images.remotePatterns: image.tmdb.org`, temel güvenlik header'ları), `src/lib/supabase/` için yalnızca boş klasör planı (client'lar Faz 2'de).
5. `apps/mobile`: **Yalnızca çalışan iskelet.** Expo Router ile tek bir ekran ("BingeTrail"), NativeWind kurulumu, monorepo Metro ayarı, `app.config.ts` (scheme `bingetrail`), `typecheck` script'i (`tsc --noEmit`). Auth, navigasyon kabuğu ve özellik ekranı yok. EAS yapılandırması yok.
6. Paket iskeletleri: `packages/shared`, `packages/api-client` (yalnızca `queryKeys` iskeleti ve sözleşme dosya yapısı; client yok), `packages/i18n`, `packages/db-types`. Her birinde `package.json` (React yok; `api-client`'ta `@supabase/supabase-js` yalnızca peerDependency olarak), `tsconfig`, `src/index.ts` ve bir smoke testi bulunur.
7. `.env.example` dosyaları (yalnızca adlar, değer yok):
   - `apps/web/.env.example` → `NEXT_PUBLIC_SUPABASE_URL=`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=`
   - `apps/mobile/.env.example` → `EXPO_PUBLIC_SUPABASE_URL=`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=`
   - Her dosyada "service-role/secret key ve TMDB anahtarı buraya ASLA eklenmez" yorumu yer alır.
8. APP kendi doğrulamasını yapar: `pnpm install`, `pnpm turbo lint typecheck test build`. Yeşil olunca Dalga A kapanır.

**Dalga B — APP bitince. SEC, QA ve DOC paralel, her biri yalnızca kendi alanında.** Hiçbiri `package.json`, `apps/**` veya `packages/**` dosyalarına dokunmaz. İhtiyaçlar APP'ye raporlanır ve Dalga D'de karşılanır.
- **SEC** (`tooling/security/**`, `.gitleaks.toml`, `SECURITY.md`, `docs/security/**`):
  - `tooling/security/bundle-guard.mjs`: token desenleri, `sb_secret_`, `service_role` ve JWT payload kontrolü (Bölüm 6.2).
  - `tooling/security/public-env-check.mjs`: allowlist ve ad/değer denetimi.
  - `tooling/security/allowlist.json`.
  - `.gitleaks.toml`: varsayılan kurallar + `sb_secret_` ve Supabase/TMDB JWT kuralları.
  - `SECURITY.md`, `docs/security/secrets-policy.md`, `docs/security/threat-model.md` (v0).
- **QA** (`.github/workflows/**`, `playwright.config.ts`, `e2e/**`):
  - `playwright.config.ts` ve `e2e/smoke.spec.ts` (web ana sayfa).
  - `.github/workflows/ci.yml`: Node 24, pnpm cache; `lint`, `typecheck` (Expo dahil), `test` ve web `build` adımları; ardından `node tooling/security/bundle-guard.mjs apps/web/.next/static` ve `public-env-check`; gitleaks; Playwright smoke. **Mobil/EAS build adımı yok.** CI'ı GitHub'a sen push'larsın.
- **DOC** (`README.md`, `CONTRIBUTING.md`, `docs/**`, `docs/security` hariç):
  - `README.md`: kurulum, komutlar, "Git ve deploy'u depo sahibi yapar" notu, üst depo uyarısı.
  - `CONTRIBUTING.md`: dosya sahipliği tablosu, agent'ların Git yasağı.
  - `docs/adr/0001-stack.md`: sürümler, web-önce stratejisi, platforma özel client'lar, React sürüm politikası.
  - `docs/architecture.md`.

**Dalga C — doğrulama:**
- **QA çalıştırır:** `pnpm install`, `pnpm turbo lint typecheck test`, web production build, bundle-guard, public-env denetimi, `pnpm exec playwright test`. Bu komutlar Faz 0 uygulanırken çalıştırılır, şu an çalıştırılmaz.
- **SEC inceler:**
  - `.gitignore` kapsamı.
  - `.env.example` dosyalarında değer olmaması.
  - Bundle-guard'ın kasıtlı sahte bir `sb_secret_test…` dizesini yakaladığı. Bu test, geçici bir fixture ile `tooling/security/__fixtures__` içinde yapılır.

**Dalga D:** Bulgular dosya sahiplerine gider ve sıralı düzeltilir.

**Quality Gate 0 kabul listesi:**
- [ ] Temiz klonda `pnpm install` hatasız
- [ ] **Bütün paketlerde** `lint`, `typecheck` ve `test` yeşil
- [ ] **Expo typecheck** (`pnpm --filter mobile typecheck`) yeşil
- [ ] **Web production build** (`pnpm --filter web build`) yeşil
- [ ] Bundle-guard ve public-env denetimi temiz; sahte secret fixture'ı yakalanıyor
- [ ] Playwright web smoke yeşil
- [ ] Repoda secret yok, `.env*` dosyaları ignore ediliyor
- [ ] README adımları sıfırdan uygulanabiliyor
- [ ] *İsteğe bağlı, gate şartı değil:* `pnpm --filter mobile start` ile iskelet Expo Go'da açılıyor
- [ ] **İstenmeyenler:** production mobil build, EAS build, mağaza yapılandırması
- [ ] Önerilen commit: `chore: bootstrap pnpm/turborepo monorepo (web, mobile skeleton, packages)`. Commit'i sen atarsın.

---

## Karar Listesi

**Kesinleşen kararlar (Revizyon 2):**

| # | Karar | Sonuç |
|---|---|---|
| K1 | Mobil zamanlaması | Faz 0'da yalnızca çalışan iskelet. Mobil özellikler Faz 6'da, Quality Gate 5'ten ("web çekirdeği stabil") sonra |
| K2 | React sürümü | Web ve mobilde eşitlik zorlanmaz. Mobilde Expo SDK belirleyicidir. Paylaşılan paketler React'ten bağımsızdır; gerekirse geniş aralıklı peerDependency kullanılır |
| K3 | Supabase client | Platforma özel fabrikalar: web'de `@supabase/ssr`/cookie, mobilde SecureStore. `api-client` yalnızca query key, DTO, mapper ve veri erişim sözleşmelerini paylaşır |
| K4 | Quality Gate 0 | Web production build + bütün paketlerde lint/typecheck/test + Expo typecheck. Mobil ve EAS build istenmez |
| K5 | Hesap silme | Veri modeli ve RLS Faz 1'de (cascade FK, PII içermeyen log), `delete-account` ve web UI Faz 4'te, mobil UI Faz 6'da |
| K6 | Secret denetimi | Token desenleri, `sb_secret_`, `service_role` JWT, TMDB JWT imzası ve public env allowlist'i. Metin araması yapılmaz |
| K7 | Katalog temizliği | Cron pasif başlar. Önce saklama politikası ve haftalık rapor; dry-run ve senin onayınla etkinleşir |
| K8 | Git | BingeTrail bağımsız depodur. Üst depo uyarısı korunur. Agent'lar hiçbir Git işlemi yapmaz |
| K9 | Faz 0 paralelliği | Önce APP tek başına kök yapıyı ve iskeletleri tamamlar. Sonra SEC, QA ve DOC yalnızca kendi alanlarında paralel çalışır |

**Kesinleşen kararlar (Revizyon 2.1):**

| # | Karar | Sonuç | Etkilenen fazlar |
|---|---|---|---|
| K10 | Mobil ekran testleri | `jest-expo` + React Native Testing Library. Ortak mantık testleri Vitest'te kalır | 6, 7, 8, 9 |
| K11 | Mobil E2E | Faz 6'da elle cihaz kontrol listesi. Maestro Faz 10'da değerlendirilir | 6, 10 |
| K12 | i18n | Web'de next-intl, mobilde i18next. TR/EN JSON mesajları `packages/i18n` içinde ortak | 2, 6 |
| K13 | Hesap silme | Parola yeniden doğrulamasıyla beklemesiz, kalıcı silme. Arayüz geri alınamaz olduğunu açıkça gösterir | 1, 4, 6 |
| K14 | TypeScript | TS 7 ile başlanır. Next veya ESLint uyumsuzsa uyumlu en güncel sürüme sabitlenir ve ADR'ye yazılır | 0 |
| K15 | Hosting | Şimdilik açık. Deploy aşamasında (en geç Faz 10) seçilir. Deploy'u sen yaparsın | 10 |

**Onayını bekleyen karar:** Yok.

## Durum: Bekleme

- Yalnızca planlama yapılıyor. Revizyon 2.1'de yalnızca `plan.md` ve `fazlar/` altındaki dokümanlar güncellendi.
- `fazlar/` artık 0–10 faz yapısıyla eşleşiyor. Dizin: `fazlar/README.md`. Revizyon 1'den kalan eski numaralı dört faz dosyası senin onayınla silindi.
- Faz 0, ancak sen açıkça "Faz 0'a başla" yazdığında başlar. Ön koşul: `bingetrail` için bağımsız Git deposu (sen açarsın).
