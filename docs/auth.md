# Kimlik Doğrulama (Web)

> Durum: Faz 2 · Kararlar: [ADR-0002](adr/0002-web-auth.md)

## Akışlar

| Akış              | Sayfa ve uç nokta                                                                                        | Notlar                                                                                                            |
| ----------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Kayıt             | `/[locale]/signup` → `signUpAction` → `/[locale]/home` (oturum hemen açılır)                             | **E-posta doğrulaması kapalı** (ürün kararı, aşağıya bakınız). Dil tercihi `user_metadata.locale` alanına yazılır |
| E-posta doğrulama | Kullanılmıyor. Proje doğrulama isterse kayıt `/check-email`'e düşer; bağlantı `/auth/confirm?type=email` | Yedek yol olarak kodda duruyor                                                                                    |
| Giriş             | `/[locale]/login` → `signInAction` → `next` ya da `/[profil dili]/home`                                  | Hangi hata olursa olsun tek mesaj gösterilir                                                                      |
| Çıkış             | Formdan `signOutAction` çağrılır (JavaScript gerekmez)                                                   | `scope: 'local'`: yalnızca bu cihazın oturumu kapanır                                                             |
| Parolamı unuttum  | `/forgot-password` → `/check-email`                                                                      | Adres kayıtlı olsun olmasın aynı yanıt                                                                            |
| Parola sıfırlama  | E-posta → `/auth/confirm?type=recovery` → `/reset-password` → `/home?passwordUpdated=1`                  | Yalnızca geçerli recovery işareti olan oturum girebilir (aşağıya bakınız)                                         |
| Dil değiştirme    | Misafir: sayfadaki dil bağlantısı. Giriş yapmış: Profil → Uygulama dili                                  | Tercih `profiles.locale` alanına ve `NEXT_LOCALE` cookie'sine yazılır                                             |

**Erişim kuralları** (`src/lib/routes.ts`, `src/proxy.ts`):

- **Korumalı sayfalar** (`/home`, `/search`, `/title/…`, `/list`, `/calendar`, `/profile`): Oturum yoksa `/login?next=…` sayfasına yönlendirir.
- **Yalnızca misafire açık sayfalar** (`/login`, `/signup`, `/forgot-password`): Giriş yapmış kullanıcıyı `/home` sayfasına yönlendirir.
- **`/reset-password`:** Oturum yoksa `/forgot-password` sayfasına, normal bir oturumla gelinmişse `/profile` sayfasına yönlendirir.

## Parola sıfırlama yalnızca recovery akışında

Supabase, recovery bağlantısıyla açılan oturumu da e-posta doğrulama bağlantısıyla açılan oturumu da JWT'de aynı şekilde işaretliyor (`amr: "otp"`). Bu yüzden JWT tek başına ikisini ayırt edemiyor. Ayrım şöyle yapılıyor (`src/lib/auth/recovery.ts`):

1. `/auth/confirm`, **yalnızca `type=recovery` doğrulandıktan sonra** `bt_recovery` cookie'sini yazar. Cookie'nin özellikleri:
   - `HttpOnly`, `SameSite=Lax`, production'da `Secure`.
   - 15 dakika geçerli.
   - İçeriği `{ sub, session_id, exp }`. Bu içerik **sunucuya ait bir anahtarla HMAC-SHA256 ile imzalanır** (`AUTH_COOKIE_SECRET`).
2. Proxy, sayfa ve `resetPasswordAction` üçü de işareti doğrular: imza geçerli mi, kullanıcı aynı mı, **oturum aynı mı**, süresi dolmamış mı. Server Action doğrudan çağrılabildiği için action'daki kontrol de şart.
3. Parola değişince ve çıkış yapılınca cookie silinir; işaret tek kullanımlık.
4. URL'ye hiçbir token ya da değer konmaz. Anahtar yoksa ya da 32 karakterden kısaysa akış kapalı kalır (fail closed) ve bu durum sunucu log'una yazılır.

E2E testleri hem normal oturumun reddedildiğini (e-posta doğrulama ve parola girişi, sahte cookie dahil) hem de gerçek recovery bağlantısının çalıştığını doğruluyor.

## Parola politikası

- En az 8 karakter, en az bir harf ve bir rakam.
- En fazla 72 bayt; bcrypt bundan sonrasını yok sayar.
- Kural iki yerde tanımlı: `supabase/config.toml` (`minimum_password_length`, `password_requirements`) ve `@bingetrail/shared` (`newPasswordSchema`). İki tanım birbirine uygun tutulmalı.

## Yerel geliştirme

```bash
pnpm db:start          # Docker gerekir; Mailpit e-postaları: http://127.0.0.1:54324
pnpm dev:web           # http://localhost:3000 (yerel Supabase'in public ayarlarıyla)
pnpm build:web:local   # production build
pnpm test:e2e          # Playwright (önce build:web:local)
```

`dev:web`, `build:web:local` ve `test:e2e`, yerel Supabase'in **yalnızca** URL'sini ve publishable key'ini `supabase status` çıktısından alır ve çalıştırdıkları komuta ortam değişkeni olarak geçer (`tooling/scripts/with-local-supabase-env.mjs`). Hiçbir değer ekrana yazılmaz, diske kaydedilmez ve `.env.local` dosyası gerekmez.

## Uzak Supabase projesi için ayarlar (depo sahibi yapar)

`config.toml` yalnızca yerel ortamı yönetir. Bir Supabase projesi oluşturduğunda **Dashboard** üzerinden şunları ayarla:

1. **Authentication → URL Configuration**
   - Site URL: production adresin (ör. `https://bingetrail.example`).
   - Redirect URLs: `https://bingetrail.example/**`. Gerekirse preview adreslerini de ekle.
2. **Authentication → Sign In / Providers → Email**
   - Confirm email: **kapalı** (yerel `config.toml` ile aynı olmalı; aşağıdaki karara bakınız)
   - Secure password change: **açık**
   - Minimum password length: **8**, Password requirements: **letters and digits**
   - Leaked password protection: **açık** (planın destekliyorsa)
3. **Authentication → Email Templates**
   - "Reset password" (ve doğrulama ileride açılırsa "Confirm signup") şablonlarına `supabase/templates/confirmation.html` ve `recovery.html` dosyalarının içeriğini yapıştır.
   - Bağlantılar `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=…` biçiminde olmalı.
4. **Authentication → SMTP:** Production için kendi SMTP sağlayıcını tanımla. Supabase'in yerleşik e-posta servisi saatte çok az e-posta gönderebiliyor.
5. **Web uygulaması ortam değişkenleri** (hosting paneli veya `apps/web/.env.local`):
   - Public olarak yalnızca `NEXT_PUBLIC_SUPABASE_URL` ve `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (`sb_publishable_…`).
   - **Secret key (`sb_secret_…`) asla bu değişkenlere konmaz.** `security:check` bunu yakalar.
   - Yalnızca sunucuda: `AUTH_COOKIE_SECRET`, 32 karakterden uzun rastgele bir dize. Üretmek için: `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`. Bu değişken tanımlı değilse parola sıfırlama çalışmaz. Değiştirildiğinde, o sırada süren recovery akışları da geçersiz olur.

## Testler

| Katman      | Dosya                                                       | Kapsam                                                                                                                         |
| ----------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Şemalar     | `packages/shared/src/auth.test.ts`, `auth-messages.test.ts` | Parola politikası, e-posta normalleştirme, her hata kodunun çevirisi                                                           |
| Sözleşmeler | `packages/api-client/src/profile.test.ts`                   | Profil DTO'su, sorgu biçimi, hata yayılımı                                                                                     |
| Web birim   | `apps/web/src/lib/*.test.ts`                                | Açık yönlendirme, rota sınıflandırma, hata eşleme                                                                              |
| Web bileşen | `apps/web/src/components/auth/auth-forms.test.tsx`          | Doğrulama mesajları, Server Action çağrısı, genel hata mesajı                                                                  |
| E2E         | `e2e/auth.spec.ts`, `e2e/smoke.spec.ts`                     | Kayıt → e-posta doğrulama → giriş/çıkış, sıfırlama, hesap varlığını sızdırmama, HttpOnly cookie, açık yönlendirme, dil tercihi |

## Karar: kayıtta e-posta doğrulaması yok (2026-10-15)

Depo sahibinin isteğiyle kayıt olan kullanıcı e-postasını doğrulamadan hemen giriş yapar.

- **Yerel:** `supabase/config.toml` → `[auth.email] enable_confirmations = false`. Değişiklik `pnpm db:stop && pnpm db:start` ile geçerli olur.
- **Uzak proje:** Dashboard → Authentication → Sign In / Providers → Email → **Confirm email kapalı**. Bunu depo sahibi yapar.
- `signUpAction` oturum dönerse `/home`'a yönlendirir. Proje yine de doğrulama isterse eski davranışa (`/check-email`) düşer.
- **Kabul edilen riskler:**
  - **Kayıtta hesap varlığı anlaşılabilir.** Kayıtlı bir adresle kayıt denendiğinde "Bu e-posta adresi zaten kayıtlı" mesajı gösterilir. Başarılı kayıt kullanıcıyı içeri aldığı için bu durum zaten gizlenemezdi. Giriş ve parola sıfırlama ekranları hesap varlığını hâlâ ele vermez.
  - **E-posta sahipliği kanıtlanmaz.** Biri başkasının adresiyle hesap açabilir. Adresin gerçek sahibi "Parolamı unuttum" ile hesabı ele geçirebilir. Parola sıfırlama e-postası gerçek adrese gittiği için başkası bu yolla hesaba giremez.
  - Bu adreslere sıfırlama e-postası gönderilebilmesi için production'da SMTP ayarı yine gerekir.
