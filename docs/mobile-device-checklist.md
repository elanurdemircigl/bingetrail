# Mobil Cihaz Kontrol Listesi (Quality Gate 6)

> Mobil E2E otomasyonu Faz 10'da değerlendirilecek (K11). O zamana kadar her mobil sürümden önce bu liste **gerçek cihazda** (Expo Go) elle işaretlenir. Kurulum: [mobile.md](mobile.md).

Cihaz / OS: ____________ · Expo Go sürümü: ________ · Tarih: ________ · Kontrol eden: ________

## Hazırlık

- [ ] `pnpm db:start` ve `pnpm dev:mobile` çalışıyor; QR ile uygulama açıldı
- [ ] Uygulama telefon dilinde açılıyor (TR telefonda Türkçe, EN telefonda İngilizce)

## Hesap

- [ ] Yeni e-postayla kayıt → doğrudan Ana sayfa (e-posta doğrulaması yok)
- [ ] Aynı e-postayla tekrar kayıt → "Bu e-posta adresi zaten kayıtlı" mesajı
- [ ] Parola kuralı: harfsiz/rakamsız/kısa parola alan altında hata gösteriyor
- [ ] Çıkış → Giriş ekranı; geri tuşu uygulamaya geri **götürmüyor**
- [ ] Yanlış parola ile giriş → tek, genel hata mesajı
- [ ] Uygulamayı tamamen kapatıp aç → oturum korunuyor
- [ ] Giriş ekranında dil değiştir → metinler anında değişiyor

## Parola sıfırlama

- [ ] "Parolamı unuttum" → e-posta gir → sıfırlama ekranı açılıyor
- [ ] Mailpit'te (`http://<bilgisayar IP>:54324` veya bilgisayarda `http://127.0.0.1:54324`) gelen e-postada 6 haneli kod var
- [ ] Yanlış kod → "Bağlantı geçersiz" mesajı; doğru kod → yeni parola formu
- [ ] Yeni parola kaydedildi → eski parola reddediliyor, yenisiyle giriş çalışıyor
- [ ] Aynı kod ikinci kez reddediliyor

## Katalog

- [ ] Ara: "breaking" yazınca sonuçlar geliyor (gerçek TMDB token'ı varsa), posterler görünüyor
- [ ] Başlık sayfası: açıklama, tarih, sezon listesi; TMDB atfı görünüyor
- [ ] Sezon sayfası: bölümler ve tarihler

## Liste

- [ ] Başlığı "İzleniyor" olarak ekle → kontroller düzenleme görünümüne geçiyor
- [ ] Durum değiştir (anında değişiyor); puan ver; not yaz ve kaydet → "Kaydedildi."
- [ ] Not içine `<b>kalın</b>` yaz → listede düz metin olarak görünüyor
- [ ] Listem: sekme sayıları doğru; filtre ve sıralama çalışıyor
- [ ] Listeden çıkar → onay soruyor → "Evet, çıkar" ile kayboluyor

## Bölüm takibi

- [ ] Bölüm kutusuna dokun → işaretleniyor; ilerleme çubuğu güncelleniyor
- [ ] Yayınlanmamış bölüm işaretlenemiyor ("Henüz yayınlanmadı")
- [ ] "Buraya kadar" ve "Sezonu izlendi işaretle" tek dokunuşla çalışıyor
- [ ] Ana sayfada dizi "İzlemeye devam et"te, sıradaki bölüm doğru; "İzledim" bir sonrakine geçiyor
- [ ] Bütün bölümler izlenince başlık sayfasında "Tamamlandı olarak işaretlensin mi?" çıkıyor

## Web ile tutarlılık

- [ ] Telefonda yapılan değişiklik (liste, bölüm) web'de sayfa yenilenince görünüyor
- [ ] Profilde dil değiştir → web'de aynı hesapla giriş yapınca o dilde açılıyor

## Hesap silme

- [ ] Profil → Hesabımı sil → uyarı ve silinecekler listesi görünüyor
- [ ] Onay anahtarı kapalıyken gönderilemiyor
- [ ] Yanlış parola → "Parola hatalı."; hesap duruyor
- [ ] Doğru parola + onay → "Hesabın silindi" ekranı; aynı bilgilerle giriş reddediliyor

## Erişilebilirlik (kısa)

- [ ] TalkBack/VoiceOver ile giriş formu, sekmeler ve bölüm kutuları okunuyor
- [ ] Büyük yazı tipi ayarında metinler kesilmiyor

## Senkronizasyon ve çevrimdışı (Faz 7)

- [ ] Profil'de durum "Canlı"
- [ ] Web'de aynı hesapla Listem açıkken telefonda başlık ekle → web 2 sn içinde güncelleniyor (sayfa yenilemeden)
- [ ] Web'de bölüm işaretle → telefonda ana sayfa güncelleniyor
- [ ] Uçak modu: üstte "Çevrimdışısın…" bandı; 3 değişiklik yap → "3 değişiklik … gönderilecek"
- [ ] Uçak modundayken uygulamayı tamamen kapat, aç → değişiklikler ekranda duruyor
- [ ] Uçak modunu kapat → bant kayboluyor, değişiklikler web'de görünüyor
- [ ] Çıkış yap, başka hesapla gir → önceki hesabın verisi görünmüyor
