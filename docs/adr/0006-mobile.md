# ADR-0006: Mobil çekirdek

- **Durum:** Kabul edildi
- **Tarih:** 2026-10-16
- **Faz:** 6

## Kararlar

### 1. Oturum: şifreli AsyncStorage + SecureStore anahtarı (K3)

SecureStore ~2 KB üzerindeki değerleri desteklemiyor; Supabase oturumu daha büyük. Her yazımda yeni bir AES-256 anahtarı üretilir (`expo-crypto`), oturum AES-CTR ile şifrelenip AsyncStorage'a, anahtar SecureStore'a yazılır. Anahtar her yazımda yenilendiği için sabit sayaçlı CTR anahtar akışını tekrar kullanmaz. `keychainAccessible: WHEN_UNLOCKED_THIS_DEVICE_ONLY`: anahtar cihaz yedeğine girmez, başka cihaza taşınamaz. Biri eksik ya da bozuksa "oturum yok" sayılır. Kütüphane: `aes-js` 3.1.2 (Supabase'in Expo rehberindeki yaklaşım).

### 2. Parola sıfırlama: PKCE bağlantısı + tek kullanımlık kod

Plan `bingetrail://` deep link öngörüyordu. Doğrulama sırasında iki kısıt çıktı:

- Supabase Auth, IP adresli yönlendirmeleri hiçbir izin kalıbıyla kabul etmiyor; Expo Go ise `exp://<LAN IP>` kullanıyor.
- Expo Go özel `bingetrail://` şemasını açamıyor.

Çözüm: Uygulama her zaman `bingetrail://reset-password` ister (izin listesinde yalnızca bu tam adres var). E-posta şablonu `.RedirectTo` `http` ile başlamıyorsa mobil dalı üretir: PKCE bağlantısı (dev/standalone build'de uygulamayı açar, yalnızca isteği yapan cihaz takas edebilir) ve 6 haneli kod (Expo Go). Web dalı değişmedi. Her iki yol da yerelde Auth + Mailpit ile denendi: web bağlantısı aynı, mobil e-postada PKCE bağlantısı ve kod var, kod oturum açıyor, ikinci kullanım 403.

### 3. Veri katmanı: TanStack Query, `api-client` değişmeden

`src/lib/queries.ts` yalnızca `@bingetrail/api-client` fonksiyonlarını ve `queryKeys`'i mobil client ile çağırır. Durum değişikliği ve bölüm işaretleme iyimserdir; hata olursa önbellek geri alınır. Giriş/çıkışta bütün önbellek temizlenir (başka kullanıcının verisi gösterilmez). Faz 7'de Realtime ve offline kuyruk bu katmana eklenecek.

### 4. i18n: i18next + ICU (K12)

Ortak mesajlar ICU biçiminde (`{count, plural, …}`), bu yüzden `i18next-icu` + `intl-messageformat` kullanıldı (Hermes `Intl`'i destekliyor). `CustomTypeOptions` ile anahtarlar tip kontrollü; yanlış anahtar `tsc`'de hata verir.

### 5. Testler: jest-expo + RNTL 13 (K10)

RNTL 14 yeni bir `test-renderer` paketi istiyor; jest-expo 57 henüz `react-test-renderer` kullanıyor. Bu yüzden Jest 29.7 + RNTL 13.3.3 seçildi. Paralel turbo çalıştırmalarında zamanlama dalgalanmasına karşı `asyncUtilTimeout` 5 sn, test süresi 20 sn.

### 6. Yerel geliştirme: LAN IP ile public ayarlar

`pnpm dev:mobile` yerel Supabase'in public URL'sini bilgisayarın LAN IP'siyle kurar (telefon `127.0.0.1`'e ulaşamaz). Değerler yalnızca alt sürecin ortamından geçer, diske yazılmaz.

### 7. Mobil paket taraması

`expo export --no-bytecode` (Hermes bytecode yerine düz JS, metin taraması güvenilir olsun diye) çıktısı bundle-guard'dan geçer; CI'ın e2e işinde çalışır.

## Sonuçlar

- `packages/shared`: `toAuthErrorCode` web'den taşındı (davranış aynı, testleri de taşındı).
- `supabase/config.toml`: `bingetrail://reset-password` izinli; e-posta şablonu iki dallı. **Uzak projede** aynı redirect URL'si ve şablon Dashboard'dan girilmeli ([auth.md](../auth.md)).
- Web'deki not formunda React Compiler uyarısı veren `watch()` `useWatch` ile değiştirildi (mobil ile aynı).
