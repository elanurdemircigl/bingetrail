# Tehdit Modeli

> Sahibi: SEC · Sürüm: **v4 (Faz 4)** · Yöntem: STRIDE · Her fazın sonunda güncellenir.

## Kapsam

- **Faz 0:** Araç zinciri ve secret sızıntısı.
- **Faz 1:** Veritabanı şeması, RLS, yetkiler, profil tetikleyicisi, avatar storage ve hesap silme veri modeli.
- **Faz 2:** Web kimlik doğrulama (kayıt, giriş, çıkış, parola sıfırlama), oturum cookie'leri, proxy erişim kuralları, i18n. Ayrıntılar: [Faz 2 eki](#faz-2-eki-web-kimlik-doğrulama).

- **Faz 3:** `tmdb` Edge Function'ı ve katalog önbelleği. Ayrıntılar: [Faz 3 eki](#faz-3-eki-katalog-ve-edge-function-v3).
- **Faz 4:** İzleme listesi (Server Actions), `delete-account` Edge Function'ı ve hesap silme arayüzü. Ayrıntılar: [Faz 4 eki](#faz-4-eki-izleme-listesi-ve-hesap-silme-v4).

## Varlıklar

| Varlık                                                   | Hassasiyet                              | Nerede (Faz 1)                            |
| -------------------------------------------------------- | --------------------------------------- | ----------------------------------------- |
| Kullanıcı hesabı (e-posta, parola hash'i: Supabase Auth) | Yüksek                                  | `auth.users` (Supabase yönetir)           |
| Kişisel notlar, puanlar, izleme geçmişi                  | Orta–Yüksek (kişisel veri)              | `watchlist_items`, `episode_progress`     |
| Profil ve avatar                                         | Orta                                    | `profiles`, `storage.objects` (`avatars`) |
| Supabase secret/service-role key                         | Kritik                                  | Yalnızca Edge Function ortamı             |
| TMDB API token                                           | Yüksek (kota ve hesap kötüye kullanımı) | Edge Function secret (Faz 3)              |
| Katalog önbelleği (TMDB verisi)                          | Düşük                                   | `titles`, `seasons`, `episodes`           |

## Güven sınırları

```
[Tarayıcı / Mobil cihaz]  ──publishable key + kullanıcı JWT──▶  [Supabase PostgREST + RLS]
          │                                                          ▲
          └──JWT──▶ [Edge Functions] ──secret key (yalnızca sunucu)───┘
                         └──TMDB token (secret)──▶ [TMDB API]
```

İstemci tarafındaki her şey güvenilmezdir. Yetki kararı yalnızca RLS, sütun yetkileri ve Edge Function'larda verilir.

## STRIDE (v1)

| Tehdit                     | Örnek                                                          | Önlem                                                                                          | Durum                        |
| -------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------- |
| **S**poofing               | Çalınmış oturum ile başka kullanıcı gibi davranma              | PKCE, HttpOnly cookie, sunucuda `getUser`/`getClaims`, mobilde şifreli depolama                | Faz 2, 6                     |
| **T**ampering              | Başka kullanıcının `user_id`'si ile satır yazmak               | RLS `with check`; `user_id` için insert/update yetkisi yok, varsayılan değer `auth.uid()`      | ✅ Faz 1, pgTAP              |
| **T**ampering              | Var olan satırı başka kullanıcıya ya da başlığa taşımak        | `user_id`, `title_id`, `profiles.id` sütunlarına update yetkisi yok                            | ✅ Faz 1, pgTAP              |
| **T**ampering              | İstemcinin katalogu bozması                                    | `titles`, `seasons` ve `episodes` için istemciye yalnızca `select` yetkisi                     | ✅ Faz 1, pgTAP              |
| **T**ampering              | Bölüm ile başlık arasında tutarsız ilerleme kaydı              | Birleşik FK'ler (`episode_id`, `title_id`)                                                     | ✅ Faz 1, pgTAP              |
| **R**epudiation            | Hesap silme işleminin izlenememesi                             | Kişisel veri içermeyen `account_deletion_log`                                                  | ✅ Faz 1 model · Faz 4 yazma |
| **I**nformation disclosure | Secret'ın istemci bundle'ına sızması                           | bundle-guard, public-env-check, gitleaks                                                       | ✅ Faz 0                     |
| **I**nformation disclosure | Başka kullanıcının liste, not, ilerleme ya da profilini okumak | Sahiplik RLS'i; `(select auth.uid())`                                                          | ✅ Faz 1, pgTAP              |
| **I**nformation disclosure | Anonim ziyaretçinin veri okuması                               | `anon` rolünden bütün tablo yetkileri kaldırıldı                                               | ✅ Faz 1, pgTAP              |
| **I**nformation disclosure | Başkasının avatar klasörüne erişmek                            | Private bucket ve `foldername[1] = auth.uid()` policy'leri                                     | ✅ Faz 1, pgTAP (yükleme)    |
| **I**nformation disclosure | Hesap silindikten sonra kişisel veri kalması                   | `auth.users`'a cascade FK. Her `user_id` sütunu katalog sorgusuyla denetleniyor                | ✅ Faz 1 pgTAP · Faz 4 E2E   |
| **D**enial of service      | TMDB kotasının tüketilmesi                                     | `rate_limits` (yalnızca service role) ve önbellek                                              | Tablo ✅ · uygulama Faz 3    |
| **E**levation of privilege | SECURITY DEFINER fonksiyonunun kötüye kullanımı                | Tek definer fonksiyonu `handle_new_user`: boş `search_path`, istemcilere `execute` yetkisi yok | ✅ Faz 1, pgTAP              |
| **E**levation of privilege | Service role'ün istemciden kullanılması                        | Service role yalnızca 3 Edge Function'da; istemcide denetim                                    | Faz 0, 3, 4                  |

## Doğrulama kanıtları (Faz 1)

- **pgTAP, 71 test:**
  - `supabase/tests/database/01_schema.test.sql` (30)
  - `supabase/tests/security/rls_isolation.test.sql` (29)
  - `supabase/tests/security/account_deletion.test.sql` (12)
- **Mutasyon testi:** Yerelde her şeyi açan bir `select` policy'si ve katalog yazma yetkisi geçici olarak eklendiğinde ilgili testler kırıldı. Sonra veritabanı sıfırlandı.
- **Supabase advisors:** WARN veya ERROR yok. Kalan INFO notları:
  - `unused_index`: boş veritabanında beklenen bir durum.
  - `rls_enabled_no_policy`: `rate_limits` ve `account_deletion_log` için bilinçli tasarım. Bu tablolara yalnızca service role erişiyor, RLS ek savunma katmanı olarak açık.

## Kabul edilen riskler

| Risk                                                      | Gerekçe                                                                                                                |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Profil satırı tetikleyici ile oluşuyor (SECURITY DEFINER) | Supabase'in önerdiği kalıp. Fonksiyon minimal ve istemciden çağrılamıyor                                               |
| `profiles.timezone` yalnızca uzunlukla denetleniyor       | IANA doğrulaması istemcide Zod ile yapılacak (Faz 2). Geçersiz değer yalnızca o kullanıcıyı etkiler                    |
| Storage nesneleri auth cascade ile silinmiyor             | Supabase SQL ile doğrudan silmeyi engelliyor. `delete-account` Storage API ile, kullanıcıdan önce siliyor (Faz 4, E2E) |

## Araç zinciri riskleri

| Risk                                                                    | Durum                                                                                             |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Üst Git deposu (`C:\Users\elqnu`) yüzünden kazara hassas dosya commit'i | ✅ **Kapandı.** `bingetrail` artık bağımsız bir depo (kendi `.git`'i var)                         |
| Bağımlılık install script'leri                                          | pnpm 10 varsayılan olarak engelliyor. Onaylı olanlar: `unrs-resolver`, `supabase` (CLI binary'si) |
| Undeclared bağımlılık yaması                                            | `react-native-css-interop` için `packageExtensions` (yalnızca bir Babel eklentisi)                |
| ESLint 9.x npm'de "deprecated" işaretli                                 | Kabul edildi; eslint-config-next ESLint 10'u desteklediğinde yükseltilecek (ADR-0001)             |
| Yerel Supabase çıktısı yerel anahtarları ekrana yazıyor                 | Bu anahtarlar yalnızca yerel geliştirme içindir; ajanlar bu çıktıyı göstermez ve paylaşmaz        |

## Faz 2 eki: web kimlik doğrulama

| Tehdit                     | Örnek                                                   | Önlem                                                                                               | Kanıt                                   |
| -------------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------- |
| **S**poofing               | XSS ile oturum token'ını çalmak                         | Cookie'ler `HttpOnly` + `SameSite=Lax` (+ prod `Secure`); tarayıcı tarafında Supabase client'ı yok  | E2E: cookie bayrakları kontrol ediliyor |
| **S**poofing               | Sahte veya oynanmış doğrulama bağlantısı                | `/auth/confirm` sunucuda `verifyOtp` çalıştırır; geçersiz token `linkInvalid` sayfasına düşer       | E2E: sahte `token_hash` reddediliyor    |
| **S**poofing               | Oturumu sunucuda yanlış doğrulamak                      | `getClaims()` (JWT doğrulama); `getSession()` hiçbir yerde kullanılmıyor                            | Kod incelemesi                          |
| **T**ampering              | Server Action'a doğrudan, form dışından istek göndermek | Her action girdiyi Zod ile yeniden doğrular; Next.js origin (CSRF) kontrolü                         | Birim + E2E                             |
| **I**nformation disclosure | Hesap varlığını öğrenmek (enumeration)                  | Giriş, kayıt ve parola sıfırlamada aynı yanıtlar; `toAuthErrorCode` hesabı ele veren kodları gizler | Birim + 3 E2E testi                     |
| **I**nformation disclosure | Açık yönlendirme ile oltalama (`?next=//evil`)          | `safeRedirectPath` yalnızca aynı origin'deki göreli yolları kabul eder                              | 13 birim testi + E2E                    |
| **I**nformation disclosure | Oturum içeren yanıtın CDN'de önbelleğe alınması         | `@supabase/ssr`'ın cache başlıkları proxy yanıtına uygulanır                                        | Kod incelemesi                          |
| **E**levation of privilege | Oturum olmadan korumalı sayfaya erişim                  | Proxy kuralı + korumalı layout'ta ikinci kontrol                                                    | E2E                                     |
| **E**levation of privilege | Kurtarma oturumu olmadan parola değiştirmek             | `/reset-password` oturum ister; `secure_password_change = true`                                     | E2E                                     |
| **D**enial of service      | Kaba kuvvet ile parola denemek                          | Supabase Auth hız sınırları (`[auth.rate_limit]`); `rateLimited` mesajı                             | Yapılandırma                            |

### Kabul edilen riskler (Faz 2)

| Risk                                                                         | Gerekçe                                                                                                                                  |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Proxy'de yenilenen token, aynı istekteki Server Component'lere ulaşmayabilir | next-intl yanıtı yeniden oluşturulamadığı için bilinen bir sınırlama. `refresh_token_reuse_interval = 10` sn çift yenilemeyi tolere eder |
| Content-Security-Policy henüz yok                                            | Bütün origin'ler (Supabase, TMDB görselleri, hosting) Faz 10'da kesinleşince eklenecek                                                   |
| Sızmış parola kontrolü (HIBP) yerelde yok                                    | Barındırılan Supabase'te panelden açılır ([docs/auth.md](../auth.md))                                                                    |

## Faz 3 eki: katalog ve Edge Function (v3)

| Tehdit                     | Örnek                                                                           | Önlem                                                                                                        | Kanıt                                    |
| -------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------- |
| **I**nformation disclosure | TMDB token'ının istemciye ya da log'lara sızması                                | Token yalnızca fonksiyon secret'ı ve yalnızca `Authorization` başlığında; hata yanıtları yalnızca kod içerir | Deno testleri + bundle-guard             |
| **T**ampering / SSRF       | `tmdbId` ya da arama metniyle TMDB yolunu ya da hostunu değiştirmek             | Yol yalnızca doğrulanmış tam sayılardan kurulur; sorgu yalnızca parametre olarak gider                       | Deno testleri (`../../account` denemesi) |
| **T**ampering              | İstemcinin katalog önbelleğini değiştirmesi                                     | Katalogda yazma politikası yok; yalnızca fonksiyon (service role) yazar                                      | pgTAP (Faz 1)                            |
| **D**enial of service      | TMDB kotasını tüketmek / maliyet artırmak                                       | Kullanıcı başına 60 istek/dk (`rate_limit_hit`), 24 saatlik önbellek, tek yeniden deneme                     | pgTAP + entegrasyon testi (429)          |
| **E**levation of privilege | İstemcinin kendi hız sınırını sıfırlaması ya da bakım fonksiyonlarını çağırması | Bütün bakım ve hız sınırı fonksiyonlarında istemci rollerinden `execute` yetkisi alınmış                     | `maintenance_privileges.test.sql`        |
| **T**ampering              | Önbellek temizliğinin takip edilen başlıkları silmesi                           | FK `restrict` + sorgu filtresi; temizleme cron'u kapalı (K7)                                                 | pgTAP (dry run, gerçek silme)            |

## Faz 2 düzeltmeleri (Faz 3 sırasında)

| Bulgu                                                                                                   | Önlem                                                                                                                                                                               | Kanıt                 |
| ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| Normal oturum (e-posta doğrulama ya da parola girişi) `/reset-password` ile parolayı değiştirebiliyordu | Yalnızca `type=recovery` doğrulamasından sonra yazılan, HMAC imzalı, HttpOnly, oturuma bağlı, 15 dakikalık, tek kullanımlık işaret. Proxy, sayfa ve Server Action üçü de doğruluyor | 6 birim + 2 E2E testi |
| `profiles.avatar_path` başka bir kullanıcının storage yolunu gösterebiliyordu                           | `profiles_avatar_path_owner` CHECK kısıtı: yalnızca `<kendi id>/<tek dosya adı>`                                                                                                    | 12 pgTAP testi        |

## Faz 4 eki: izleme listesi ve hesap silme (v4)

| Tehdit                     | Örnek                                                            | Önlem                                                                                                                  | Kanıt                                         |
| -------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| **T**ampering              | Server Action'a başka kullanıcının liste kaydı id'sini göndermek | Yazma kullanıcının kendi oturumuyla; RLS satırı gizler → `not_found`. Girdi Zod ile yeniden doğrulanır                 | pgTAP (RLS) + api-client birim testleri       |
| **T**ampering              | Tutarsız durum/tarih (ör. `planned` + `completed_at`)            | `applyStatusChange` + veritabanı CHECK kısıtları (`watchlist_consistency`)                                             | 9 pgTAP + tablo tabanlı Vitest                |
| **I**nformation disclosure | Notlardaki HTML/JS ile XSS                                       | Notlar metin düğümü; `dangerouslySetInnerHTML` lint ile yasak; oturum cookie'leri HttpOnly                             | E2E (`<script>`/`onerror` metin olarak) + RTL |
| **I**nformation disclosure | Notların ya da parolanın log'lara düşmesi                        | Action'lar ve fonksiyon yalnızca hata sınıfı loglar; `logging.serverFunctions: false` (Faz 2)                          | Deno testi (log içeriği) + kod incelemesi     |
| **S**poofing / IDOR        | Başka bir kullanıcının hesabını silmek                           | Hedef yalnızca JWT `sub`; gövdedeki id alanları atılır; parola ile yeniden doğrulama                                   | Deno testi (IDOR) + E2E                       |
| **S**poofing               | Açık bırakılmış oturumla hesabı silmek                           | Parola zorunlu + açık onay kutusu + iki adımlı arayüz                                                                  | RTL + E2E                                     |
| **D**enial of service      | Silme uç noktasıyla parola denemek                               | Saatte 5 deneme (`delete-account` kovası), parola kontrolünden önce sayılır; Supabase Auth hız sınırları               | Deno testi (429'da parola denenmez)           |
| **I**nformation disclosure | Silinen hesabın kişisel verisinin kalması                        | Önce Storage, sonra `auth.admin.deleteUser` (cascade); Storage hatasında işlem durur                                   | Deno (sıra/hata) + E2E (DB ve Storage boş)    |
| **R**epudiation            | Silmenin izlenememesi / denetim kaydından kimliğin çıkarılması   | `account_deletion_log`: yalnızca `sha256(tuz:uid)`; tuz yalnızca fonksiyon secret'ı, yoksa fonksiyon hiçbir şey silmez | Deno (fail closed) + E2E (kayıtta uid yok)    |
| **S**poofing               | Silmeden sonra eski oturumun kullanılması                        | Bu cihazdaki `sb-*` cookie'leri silinir; kullanıcı silindiği için eski JWT fonksiyonlarda 401 alır                     | E2E                                           |

### Kabul edilen riskler (Faz 4)

| Risk                                                                              | Gerekçe                                                                                                                                                              |
| --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Silinen kullanıcının JWT'si süresi dolana kadar (≤ 1 saat) imza olarak geçerli    | Kullanıcı satırı ve bütün verisi silindiği için JWT hiçbir veriye erişmez; fonksiyonlar `getUser` ile 401 döner. Diğer cihazlar bir sonraki istekte oturumu kaybeder |
| Denetim kaydı yazılamazsa silme yine "başarılı" döner                             | Hesap gerçekten silinmiştir; kullanıcıya hata göstermek yanıltıcı olur. Durum log'a yazılır                                                                          |
| Storage silindikten sonra `deleteUser` başarısız olursa avatar gider, hesap kalır | Kişisel veri sızıntısı değil, veri kaybı; kullanıcı işlemi tekrarlayabilir. Ters sıra sahipsiz kişisel dosya bırakırdı                                               |
