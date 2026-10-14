# Faz 6 — Mobil Çekirdek

> Kaynak: [`plan.md`](../plan.md), Revizyon 2.1 · Platform: **Mobil** · Bağımlılık: [Faz 5](faz-05-bolum-takibi-continue-watching.md) (Quality Gate 5 onayı) · Sonraki: [Faz 7](faz-07-senkronizasyon.md) · Paralel: [Faz 8](faz-08-yaklasan-bolum-takvimi.md) ve [Faz 9](faz-09-disa-aktarma.md) için backend ve web işleri · Karmaşıklık: Yüksek
>
> **Yeni faz (Revizyon 2).** Revizyon 1'de bu numarada "Senkronizasyon" vardı; o faz artık [Faz 7](faz-07-senkronizasyon.md).

- **Amaç:** Stabil web çekirdeğini, olgunlaşmış sözleşmeleri yeniden kullanarak mobile taşımak (K1).
- **Kullanıcı değeri:** Telefonda kayıt, giriş, çıkış ve şifre sıfırlama; arama; liste, puan ve not; bölüm takibi; Continue Watching; hesap silme; TR/EN.
- **Teknik teslimler:**
  - `apps/mobile/src/lib/supabase/client.ts` (K3):
    - supabase-js kullanılır. Oturum AES ile şifrelenip AsyncStorage'a yazılır, anahtar SecureStore'da tutulur.
    - `AppState` dinlenerek token yenilenir. Akış PKCE'dir.
  - Expo Router auth grubu ve `bingetrail://` ile şifre sıfırlama deep link'i.
  - i18next + `expo-localization`, `packages/i18n` içindeki ortak TR/EN JSON'larla (K12).
  - Mobil TanStack hook'ları: `api-client` içindeki query key ve veri erişim fonksiyonlarını mobil client ile çağıran ince katman.
  - NativeWind ekranları: arama, detay, liste, puan ve not, bölüm takibi, Continue Watching, profil.
  - **Hesap silme ekranı:** Aynı `delete-account` fonksiyonu kullanılır, parola yeniden doğrulanır, geri alınamazlık uyarısı gösterilir (K13).
- **Bağımlılık:** Faz 5 ve Quality Gate 5 onayı.
- **Kabul kriterleri:**
  - Faz 2–5 akışları ve hesap silme Android emülatöründe ve iOS'ta (Expo Go veya dev build) çalışır.
  - `api-client` paketinde mobil için değişiklik gerekmez; gerekirse bu bir sözleşme hatası sayılır ve raporlanır.
  - Mobil bundle (`expo export` çıktısı) bundle-guard ve public-env denetiminden geçer.
- **Test stratejisi:**
  - Ekran testleri `jest-expo` + React Native Testing Library ile yazılır (K10).
  - Ortak mantık testleri paketlerde Vitest'te kalır.
  - Mobil E2E otomasyonu bu fazda yoktur. Bunun yerine `docs/mobile-device-checklist.md` ile elle cihaz kontrolü yapılır (K11).
- **Riskler ve güvenlik:**
  - SecureStore boyut sınırı (şifreli AsyncStorage + SecureStore anahtarıyla çözülür).
  - Deep link ele geçirme (PKCE ve tek kullanımlık kod).
  - Cihaz yedeklerinde token (`keychainAccessible` ayarı).
  - Expo SDK'nın React sürümünün web'den farklı olması. Bu beklenen bir durum; paylaşılan paketler React'ten bağımsız (K2).
- **Görevler:** APP: mobil uygulama, `jest-expo` kurulumu · DB: değişiklik beklenmez (yalnızca redirect URL'leri) · SEC: mobil oturum depolama ve deep link incelemesi · QA: `jest-expo` CI adımı, mobil bundle-guard adımı, cihaz kontrol listesi · DOC: `docs/mobile.md`, `docs/mobile-device-checklist.md`.
- **Quality Gate 6:** Cihazda sen elle denersin. **EAS build gerekmez.**

---
Genel plan, kurallar, veritabanı/RLS, güvenlik ve test kapıları: [../plan.md](../plan.md)
