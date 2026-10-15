# ADR-0002: Web kimlik doğrulama ve i18n mimarisi

- **Durum:** Kabul edildi
- **Tarih:** 2026-10-15
- **Faz:** 2

## Bağlam

Faz 2'de web uygulamasına e-posta ve parolayla kayıt, giriş, çıkış ve parola sıfırlama ile TR/EN desteği ekleniyor. Plan (K3), Supabase client'larının platforma özel olmasını öngörüyor. Güvenlik planı da HttpOnly cookie, PKCE ve hesap varlığının sızdırılmamasını istiyor.

## Kararlar

### 1. Oturum yalnızca sunucuda, cookie'ler HttpOnly

- Auth işlemlerinin hepsi sunucuda yapılır: **Server Actions** (`src/lib/auth/actions.ts`), **Route Handler** (`/auth/confirm`) ve **proxy** (`src/proxy.ts`).
- `@supabase/ssr` cookie'leri varsayılan olarak tarayıcının okuyabileceği şekilde yazar. `hardenCookieOptions` bunları `HttpOnly`, `SameSite=Lax`, production'da `Secure` ve `Path=/` olarak zorunlu kılar.
- **Planla fark:** Planda yer alan `browser.ts` (tarayıcı client'ı) oluşturulmadı. Tarayıcı oturumu okuyamadığı için böyle bir client çalışmazdı; gereksinimi de yok. Realtime ihtiyacı doğduğunda (Faz 7) ayrı bir karar verilecek; seçenekler kısa ömürlü bir access token endpoint'i ya da sunucu aracılı abonelik.
- Server Action'larda CSRF koruması Next.js'in origin kontrolüyle sağlanıyor; cookie'ler ayrıca `SameSite=Lax`.

### 2. Doğrulama: `getClaims()`, asla `getSession()`

Proxy, sunucu bileşenleri ve action'lar kullanıcıyı `auth.getClaims()` ile doğrular. Bu çağrı JWT'yi JWKS ile, simetrik anahtar kullanılıyorsa Auth sunucusuna sorarak denetler. Korumalı layout'lar proxy'ye ek olarak oturumu bir kez daha kontrol eder (derinlemesine savunma).

### 3. E-posta bağlantıları: `token_hash` ve sunucuda `verifyOtp`

- Doğrulama ve sıfırlama e-postaları `/auth/confirm?token_hash=…&type=…&locale=…` adresine gider. Token sunucuda doğrulanır ve oturum doğrudan HttpOnly cookie'ye yazılır.
- URL fragment'inde token taşınmaz; bu PKCE ile uyumlu bir akış.
- E-posta şablonları `supabase/templates/` içinde, TR ve EN birlikte.

### 4. Hesap varlığını sızdırmama (account enumeration)

- **Giriş:** Hangi hata olursa olsun tek mesaj gösterilir: "E-posta veya parola hatalı" (`toAuthErrorCode`).
- **Kayıt ve parola sıfırlama:** Adres kayıtlı olsun ya da olmasın aynı "E-postanı kontrol et" sayfası gösterilir.
- **Kullanıcıya özel gösterilen hatalar:** Yalnızca hesabın varlığını ele vermeyenler: zayıf parola, aynı parola, yeniden giriş gerekli, hız sınırı.

### 5. Açık yönlendirme koruması

`next` parametresi `safeRedirectPath` fonksiyonundan geçer. Fonksiyon yalnızca aynı origin'e işaret eden göreli yolları kabul eder. `//evil`, `/\evil`, mutlak URL'ler ve kontrol karakterleri reddedilir.

### 6. i18n: next-intl ve URL'de dil öneki

- Her URL dil önekiyle başlar: `/tr/...`, `/en/...` (`localePrefix: 'always'`).
- Misafir ziyaretçi `/` adresine geldiğinde tarayıcı dili (`Accept-Language`) algılanır. Varsayılan dil `tr`.
- Giriş yapmış kullanıcının dili `profiles.locale` alanında saklanır:
  - Girişten sonra kullanıcı bu dile yönlendirilir.
  - Profil sayfasındaki dil değişikliği bu alana ve `NEXT_LOCALE` cookie'sine yazılır.
- Mesajlar `@bingetrail/i18n` içinde. `AppConfig` tip genişletmesi sayesinde eksik bir çeviri anahtarı derleme hatası verir.

### 7. Doğrulama şemaları ve hata kodları paylaşımlı

- `@bingetrail/shared` içindeki Zod şemaları hem formda (React Hook Form) hem Server Action'da kullanılır. Server Action'lar herkese açık uç noktalar olduğu için girdiyi her seferinde yeniden doğrular.
- Hata mesajları metin değil kod olarak tutulur (`validation.*`, `errors.*`). Her kodun iki dilde de karşılığı olduğunu bir test doğrular.

### 8. Next.js 16 `proxy`

`middleware`'in yerini `src/proxy.ts` aldı. Proxy şunları yapar:

- next-intl ile dil yönlendirmesi.
- Oturum yenileme.
- Korumalı, yalnızca misafire açık ve kurtarma (recovery) sayfaları için erişim kuralları.

Hangi yolun hangi kurala girdiği `classifyPath` fonksiyonunda tanımlı ve birim testleriyle doğrulanıyor.

## Sonuçlar

- İstemci JavaScript'i oturum token'ına hiçbir zaman erişemez. Bir XSS açığı oluşsa bile token çalınamaz.
- Faz 6'daki mobil uygulama kendi SecureStore tabanlı client'ını kullanacak. `api-client` sözleşmeleri değişmeden yeniden kullanılacak.
- Uzak Supabase projesindeki auth ayarlarını depo sahibi panelden yapar ([docs/auth.md](../auth.md)).
