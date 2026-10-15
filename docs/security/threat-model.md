# Tehdit Modeli

> Sahibi: SEC · Sürüm: **v1 (Faz 1)** · Yöntem: STRIDE · Her fazın sonunda güncellenir.

## Kapsam

- **Faz 0:** Araç zinciri ve secret sızıntısı.
- **Faz 1:** Veritabanı şeması, RLS, yetkiler, profil tetikleyicisi, avatar storage ve hesap silme veri modeli.

Auth akışları Faz 2'de, Edge Function'lar Faz 3 ve 4'te kapsama girecek.

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

| Tehdit                     | Örnek                                                          | Önlem                                                                                          | Durum                           |
| -------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------- |
| **S**poofing               | Çalınmış oturum ile başka kullanıcı gibi davranma              | PKCE, HttpOnly cookie, sunucuda `getUser`/`getClaims`, mobilde şifreli depolama                | Faz 2, 6                        |
| **T**ampering              | Başka kullanıcının `user_id`'si ile satır yazmak               | RLS `with check`; `user_id` için insert/update yetkisi yok, varsayılan değer `auth.uid()`      | ✅ Faz 1, pgTAP                 |
| **T**ampering              | Var olan satırı başka kullanıcıya ya da başlığa taşımak        | `user_id`, `title_id`, `profiles.id` sütunlarına update yetkisi yok                            | ✅ Faz 1, pgTAP                 |
| **T**ampering              | İstemcinin katalogu bozması                                    | `titles`, `seasons` ve `episodes` için istemciye yalnızca `select` yetkisi                     | ✅ Faz 1, pgTAP                 |
| **T**ampering              | Bölüm ile başlık arasında tutarsız ilerleme kaydı              | Birleşik FK'ler (`episode_id`, `title_id`)                                                     | ✅ Faz 1, pgTAP                 |
| **R**epudiation            | Hesap silme işleminin izlenememesi                             | Kişisel veri içermeyen `account_deletion_log`                                                  | Model ✅ Faz 1 · yazma Faz 4    |
| **I**nformation disclosure | Secret'ın istemci bundle'ına sızması                           | bundle-guard, public-env-check, gitleaks                                                       | ✅ Faz 0                        |
| **I**nformation disclosure | Başka kullanıcının liste, not, ilerleme ya da profilini okumak | Sahiplik RLS'i; `(select auth.uid())`                                                          | ✅ Faz 1, pgTAP                 |
| **I**nformation disclosure | Anonim ziyaretçinin veri okuması                               | `anon` rolünden bütün tablo yetkileri kaldırıldı                                               | ✅ Faz 1, pgTAP                 |
| **I**nformation disclosure | Başkasının avatar klasörüne erişmek                            | Private bucket ve `foldername[1] = auth.uid()` policy'leri                                     | ✅ Faz 1, pgTAP (yükleme)       |
| **I**nformation disclosure | Hesap silindikten sonra kişisel veri kalması                   | `auth.users`'a cascade FK. Her `user_id` sütunu katalog sorgusuyla denetleniyor                | ✅ Faz 1, pgTAP · storage Faz 4 |
| **D**enial of service      | TMDB kotasının tüketilmesi                                     | `rate_limits` (yalnızca service role) ve önbellek                                              | Tablo ✅ · uygulama Faz 3       |
| **E**levation of privilege | SECURITY DEFINER fonksiyonunun kötüye kullanımı                | Tek definer fonksiyonu `handle_new_user`: boş `search_path`, istemcilere `execute` yetkisi yok | ✅ Faz 1, pgTAP                 |
| **E**levation of privilege | Service role'ün istemciden kullanılması                        | Service role yalnızca 3 Edge Function'da; istemcide denetim                                    | Faz 0, 3, 4                     |

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

| Risk                                                      | Gerekçe                                                                                             |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Profil satırı tetikleyici ile oluşuyor (SECURITY DEFINER) | Supabase'in önerdiği kalıp. Fonksiyon minimal ve istemciden çağrılamıyor                            |
| `profiles.timezone` yalnızca uzunlukla denetleniyor       | IANA doğrulaması istemcide Zod ile yapılacak (Faz 2). Geçersiz değer yalnızca o kullanıcıyı etkiler |
| Storage nesneleri auth cascade ile silinmiyor             | Supabase SQL ile doğrudan silmeyi engelliyor. `delete-account` Storage API ile siliyor (Faz 4)      |

## Araç zinciri riskleri

| Risk                                                                    | Durum                                                                                             |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Üst Git deposu (`C:\Users\elqnu`) yüzünden kazara hassas dosya commit'i | ✅ **Kapandı.** `bingetrail` artık bağımsız bir depo (kendi `.git`'i var)                         |
| Bağımlılık install script'leri                                          | pnpm 10 varsayılan olarak engelliyor. Onaylı olanlar: `unrs-resolver`, `supabase` (CLI binary'si) |
| Undeclared bağımlılık yaması                                            | `react-native-css-interop` için `packageExtensions` (yalnızca bir Babel eklentisi)                |
| ESLint 9.x npm'de "deprecated" işaretli                                 | Kabul edildi; eslint-config-next ESLint 10'u desteklediğinde yükseltilecek (ADR-0001)             |
| Yerel Supabase çıktısı yerel anahtarları ekrana yazıyor                 | Bu anahtarlar yalnızca yerel geliştirme içindir; ajanlar bu çıktıyı göstermez ve paylaşmaz        |
