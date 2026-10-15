# Kimlik Doğrulama (Web)

> Durum: Faz 2 · Kararlar: [ADR-0002](adr/0002-web-auth.md)

## Akışlar

| Akış              | Sayfa ve uç nokta                                                                       | Notlar                                                                                      |
| ----------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Kayıt             | `/[locale]/signup` → `signUpAction` → `/check-email`                                    | Dil tercihi `user_metadata.locale` alanına yazılır; profil tetikleyicisi bu değeri kullanır |
| E-posta doğrulama | E-posta → `/auth/confirm?type=email` → `/[locale]/home`                                 | `verifyOtp` sunucuda çalışır, oturum HttpOnly cookie'ye yazılır                             |
| Giriş             | `/[locale]/login` → `signInAction` → `next` ya da `/[profil dili]/home`                 | Hangi hata olursa olsun tek mesaj gösterilir                                                |
| Çıkış             | Formdan `signOutAction` çağrılır (JavaScript gerekmez)                                  | `scope: 'local'`: yalnızca bu cihazın oturumu kapanır                                       |
| Parolamı unuttum  | `/forgot-password` → `/check-email`                                                     | Adres kayıtlı olsun olmasın aynı yanıt                                                      |
| Parola sıfırlama  | E-posta → `/auth/confirm?type=recovery` → `/reset-password` → `/home?passwordUpdated=1` | Kurtarma oturumu yoksa `/forgot-password` sayfasına yönlendirir                             |
| Dil değiştirme    | Misafir: sayfadaki dil bağlantısı. Giriş yapmış: Profil → Uygulama dili                 | Tercih `profiles.locale` alanına ve `NEXT_LOCALE` cookie'sine yazılır                       |

**Erişim kuralları** (`src/lib/routes.ts`, `src/proxy.ts`):

- **Korumalı sayfalar** (`/home`, `/search`, `/list`, `/calendar`, `/profile`): Oturum yoksa `/login?next=…` sayfasına yönlendirir.
- **Yalnızca misafire açık sayfalar** (`/login`, `/signup`, `/forgot-password`): Giriş yapmış kullanıcıyı `/home` sayfasına yönlendirir.

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
   - Confirm email: **açık**
   - Secure password change: **açık**
   - Minimum password length: **8**, Password requirements: **letters and digits**
   - Leaked password protection: **açık** (planın destekliyorsa)
3. **Authentication → Email Templates**
   - "Confirm signup" ve "Reset password" şablonlarına `supabase/templates/confirmation.html` ve `recovery.html` dosyalarının içeriğini yapıştır.
   - Bağlantılar `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=…` biçiminde olmalı.
4. **Authentication → SMTP:** Production için kendi SMTP sağlayıcını tanımla. Supabase'in yerleşik e-posta servisi saatte çok az e-posta gönderebiliyor.
5. **Web uygulaması ortam değişkenleri** (hosting paneli veya `apps/web/.env.local`):
   - Yalnızca `NEXT_PUBLIC_SUPABASE_URL` ve `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (`sb_publishable_…`).
   - **Secret key (`sb_secret_…`) asla bu değişkenlere konmaz.** `security:check` bunu yakalar.

## Testler

| Katman      | Dosya                                                       | Kapsam                                                                                                                         |
| ----------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Şemalar     | `packages/shared/src/auth.test.ts`, `auth-messages.test.ts` | Parola politikası, e-posta normalleştirme, her hata kodunun çevirisi                                                           |
| Sözleşmeler | `packages/api-client/src/profile.test.ts`                   | Profil DTO'su, sorgu biçimi, hata yayılımı                                                                                     |
| Web birim   | `apps/web/src/lib/*.test.ts`                                | Açık yönlendirme, rota sınıflandırma, hata eşleme                                                                              |
| Web bileşen | `apps/web/src/components/auth/auth-forms.test.tsx`          | Doğrulama mesajları, Server Action çağrısı, genel hata mesajı                                                                  |
| E2E         | `e2e/auth.spec.ts`, `e2e/smoke.spec.ts`                     | Kayıt → e-posta doğrulama → giriş/çıkış, sıfırlama, hesap varlığını sızdırmama, HttpOnly cookie, açık yönlendirme, dil tercihi |
