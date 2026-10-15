# Mobil Uygulama (Expo)

> Durum: Faz 6 · Kod: `apps/mobile` · Kararlar: [ADR-0006](adr/0006-mobile.md), K3, K10–K13

## Çalıştırma (yerel)

1. Docker Desktop açıkken yerel Supabase'i başlat: `pnpm db:start`.
2. Telefona **Expo Go**'yu yükle (App Store / Google Play). Telefon ve bilgisayar aynı Wi-Fi ağında olmalı.
3. `pnpm dev:mobile` çalıştır. Terminalde çıkan QR kodu Expo Go ile (iOS'ta kamerayla) okut.

`dev:mobile`, yerel Supabase'in **public** ayarlarını (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) uygulamaya verir. Telefon `127.0.0.1`'e ulaşamadığı için adres bilgisayarın LAN IP'siyle kurulur; terminalde `Mobile app will use local Supabase at http://192.168.x.x:54321` satırını görürsün. `.env` dosyası gerekmez.

- **Android emülatörü:** `BINGETRAIL_SUPABASE_HOST=10.0.2.2 pnpm dev:mobile`
- **Bağlanamıyorsa:** Windows Güvenlik Duvarı, Docker'ın 54321 portuna yerel ağdan erişime izin vermeli (ilk çalıştırmada sorabilir). Bilgisayarda birden çok ağ varsa `BINGETRAIL_SUPABASE_HOST=<doğru IP>` ver.
- Gerçek TMDB verisi için `supabase/functions/.env` dosyasındaki token yeterli (web ile aynı).

## Mimari

| Katman          | Dosya                                    | Not                                                                                                                                |
| --------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Supabase client | `src/lib/supabase/client.ts`             | Publishable key + kullanıcı oturumu; PKCE; `AppState` ile token yenileme yalnızca ön planda                                        |
| Oturum deposu   | `src/lib/supabase/large-secure-store.ts` | Her yazımda yeni AES-256 anahtarı → SecureStore (`WHEN_UNLOCKED_THIS_DEVICE_ONLY`, yedeğe girmez); şifreli oturum → AsyncStorage   |
| Oturum durumu   | `src/lib/auth/session.tsx`               | Giriş/çıkışta önbellek temizlenir; profil dili uygulanır                                                                           |
| Auth işlemleri  | `src/lib/auth/actions.ts`                | Web Server Action'larıyla aynı Zod şemaları ve hata kodları (`toAuthErrorCode` artık `packages/shared`'da)                         |
| Veri            | `src/lib/queries.ts`                     | TanStack Query; `@bingetrail/api-client` fonksiyonları ve `queryKeys` **değişmeden** kullanılır; durum ve bölüm işaretleme iyimser |
| i18n            | `src/lib/i18n.ts`                        | i18next + ICU eklentisi, `packages/i18n` JSON'ları (K12); anahtarlar tip kontrollü                                                 |
| Ekranlar        | `src/screens/*`, `app/*`                 | Expo Router: `(auth)` misafir, `(app)` oturumlu, `(app)/(tabs)` sekmeler                                                           |

`api-client` paketinde mobil için **hiçbir değişiklik gerekmedi** (Faz 6 kabul kriteri). `packages/shared`'a yalnızca web'deki `toAuthErrorCode` taşındı.

## Ekranlar

Giriş · Kayıt · Parolamı unuttum · Parola sıfırlama · Ana sayfa (İzlemeye devam et) · Ara · Başlık (liste, puan, not, ilerleme, tamamlama önerisi, sezonlar) · Sezon (bölüm işaretleme, "buraya kadar", sezonun tamamı) · Listem (filtre, sıralama, durum değiştirme) · Profil (dil, çıkış) · Hesabı sil · Hesap silindi.

## Parola sıfırlama (mobil)

Uygulama sıfırlamayı her zaman `bingetrail://reset-password` yönlendirmesiyle ister. E-posta şablonu (`supabase/templates/recovery.html`) bu durumda iki yol sunar:

1. **Bağlantı (PKCE):** Development/standalone build'de uygulamayı açar; kod yalnızca isteği yapan cihazdaki doğrulayıcıyla takas edilebilir, yani ele geçirilmiş bir deep link işe yaramaz.
2. **6 haneli kod:** Expo Go özel şemaları açamadığı için kod, sıfırlama ekranına e-posta adresiyle birlikte girilir.

Yeni parola formu yalnızca bu ekran bağlantıyı ya da kodu doğruladıktan sonra görünür; sıradan bir oturum parolayı bu yoldan değiştiremez. Supabase Auth IP adresli yönlendirmeleri (`exp://192.168…`) reddettiği için Expo Go'da bağlantı yerine kod kullanılır.

## Testler

| Komut                                                    | Kapsam                                                                                                                                                    |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm --filter @bingetrail/mobile test`                  | jest-expo + RNTL (K10): oturum deposu şifreleme, ICU mesajları, tema token uyumu, giriş/kayıt doğrulaması, sıfırlama akışı (kod + deep link), hesap silme |
| `pnpm export:mobile:local && pnpm security:check:mobile` | Android paketini (düz JS) üretir ve bundle-guard ile tarar; CI'da da çalışır                                                                              |
| [mobile-device-checklist.md](mobile-device-checklist.md) | Cihazda elle kontrol (K11)                                                                                                                                |
