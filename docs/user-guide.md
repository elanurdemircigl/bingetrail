# Kullanıcı Rehberi

> Web uygulaması için. Mobil uygulama Faz 6'da aynı özellikleri alacak. Arayüz Türkçe ve İngilizce; dil Profil sayfasından değiştirilir.

## Listem

### Başlık eklemek

1. **Ara** sayfasında bir film ya da dizi ara ve sonuca tıkla.
2. Başlık sayfasındaki **Listem** bölümünde bir durum seç ve **Listeme ekle**'ye bas.
3. Aynı başlık listene ikinci kez eklenemez; listendeyse bölüm doğrudan düzenleme görünümünde açılır.

### Durumlar

| Durum           | Anlamı                  | Tarihler                                                        |
| --------------- | ----------------------- | --------------------------------------------------------------- |
| **İzlenecek**   | Henüz başlamadın        | Başlangıç ve bitiş tarihi temizlenir                            |
| **İzleniyor**   | Şu an izliyorsun        | Başlangıç tarihi ilk kez seçildiğinde kaydedilir, sonra korunur |
| **Tamamlandı**  | Bitirdin                | Bitiş tarihi kaydedilir (başlangıç yoksa o da)                  |
| **Ara verildi** | Bir süreliğine bıraktın | Başlangıç korunur                                               |
| **Bırakıldı**   | Devam etmeyeceksin      | Başlangıç korunur                                               |

Durumu başlık sayfasından ya da **Listem** sayfasındaki her satırdan değiştirebilirsin. Değişiklik ekranda hemen görünür; kaydedilemezse eski haline döner ve bir hata mesajı çıkar.

### Puan ve notlar

- **Puan:** 1 ile 10 arasında; "Puan yok" seçeneğiyle kaldırılabilir.
- **Kişisel notlar:** En fazla 5000 karakter. Sayaç kaç karakter yazdığını gösterir. Notlarını yalnızca sen görebilirsin; düz metin olarak saklanır ve gösterilir.
- Değişiklikleri **Kaydet** ile kaydet.

### Filtreleme ve sıralama

- **Listem** sayfasındaki sekmeler duruma göre filtreler; her sekmede o durumdaki başlık sayısı yazar.
- **Sırala:** son etkinlik, eklenme tarihi, ad (A–Z) ya da puan (puansızlar en sonda). **Uygula**'ya bas.
- Filtre ve sıralama adres çubuğunda tutulur; sayfayı yer imlerine ekleyebilir ya da yenileyebilirsin.

### Listeden çıkarmak

**Listeden çıkar** → **Evet, çıkar**. Başlığın durumu, puanı ve notları silinir. İlk tıklama yalnızca onay ister; **Vazgeç** ile iptal edebilirsin.

## Hesabı silmek

1. **Profil** sayfasının altındaki **Hesabı sil** bölümünde **Hesabımı sil…** bağlantısına tıkla.
2. Açılan sayfa nelerin silineceğini listeler: hesabın ve giriş bilgilerin, profilin ve dil tercihin, listen (durumlar, puanlar, notlar), bölüm ilerlemen ve profil fotoğrafın.
3. Parolanı gir, **"Hesabımın ve verilerimin kalıcı olarak silineceğini anlıyorum"** kutusunu işaretle ve **Hesabımı kalıcı olarak sil**'e bas.

> ⚠️ **Bu işlem geri alınamaz.** Bekleme süresi yoktur; hesap ve verilerin hemen silinir ve geri getirilemez.

- Parola yanlışsa hiçbir şey silinmez. Güvenlik için saatte en fazla 5 deneme yapılabilir.
- Silme tamamlanınca bu cihazdaki oturumun kapanır ve bir onay sayfası görürsün. Aynı e-posta ve parolayla artık giriş yapılamaz.
- Filmler ve diziler hakkındaki ortak katalog bilgisi (TMDB'den) kişisel veri değildir ve silinmez.

## Bölüm takibi

### Bölüm işaretlemek

1. Bir dizinin sayfasında sezonu aç.
2. Bölümün yanındaki kutuyu işaretle. Kutuyu kaldırırsan işaret silinir.
3. **Buraya kadar:** O sezonda bu bölüme kadar yayınlanmış bütün bölümleri tek seferde işaretler.
4. **Sezonu izlendi işaretle / Sezon işaretlerini kaldır:** Bütün sezon için.

- **Henüz yayınlanmamış** (ya da yayın tarihi bilinmeyen) bölümler işaretlenemez.
- Bir dizinin bölümünü işaretlediğinde dizi listende yoksa **İzleniyor** olarak eklenir; **İzlenecek** ise **İzleniyor**'a geçer. Ara verdiğin, bıraktığın ya da tamamladığın dizilerin durumu değişmez.
- Sezon sayfasında ve dizi sayfasında ilerleme çubuğu, yayınlanan bölümlerin kaçını izlediğini gösterir.

### Tamamlandı önerisi

Yayınlanan bütün bölümleri izlediğinde dizi sayfasında **"Tamamlandı olarak işaretlensin mi?"** sorusu çıkar. Durum kendiliğinden değişmez; **Tamamlandı olarak işaretle** ya da **Şimdi değil** seç.

### İzlemeye devam et

Ana sayfada **İzleniyor** durumundaki diziler son etkinliğe göre sıralanır. Her kartta sıradaki bölüm yazar: son izlediğin bölümden sonraki ilk yayınlanmış bölüm. **İzledim** düğmesi o bölümü işaretler ve bir sonrakine geçer.

- Özel bölümler (Sezon 0) burada gösterilmez.
- Sıradaki bölüm henüz açılmamış bir sezondaysa kart seni sezonlara yönlendirir; sezonu bir kez açman yeterli.
