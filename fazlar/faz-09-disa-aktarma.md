# Faz 9 — JSON ve CSV Dışa Aktarma

> Kaynak: [`plan.md`](../plan.md), Revizyon 2.1 · Platform: **Web → mobil** · Bağımlılık: [Faz 4](faz-04-izleme-listesi.md)–[Faz 5](faz-05-bolum-takibi-continue-watching.md) (web), [Faz 6](faz-06-mobil-cekirdek.md) (mobil) · Sonraki: [Faz 10](faz-10-sertlestirme-yayin.md) · Karmaşıklık: Düşük–Orta
>
> Revizyon 1'de bu faz "Faz 8" idi.

- **Amaç:** Veri taşınabilirliği.
- **Kullanıcı değeri:** Liste, puan, not ve bölüm geçmişini JSON veya CSV olarak indirmek. Hesabını silmeden önce verini dışa aktarabilmek.
- **Teknik teslimler:**
  - `export-user-data` Edge Function. **Kullanıcının kendi JWT'siyle** çalışır; service role kullanılmaz, RLS uygulanır.
  - Sürümlü JSON şeması (`schemaVersion`).
  - İki CSV dosyası: items ve episodes.
  - Formatlayıcı `packages/shared` içinde.
  - Önce web'de indirme, Faz 6'dan sonra mobilde `expo-sharing` ile paylaşım.
  - Web ve mobil hesap silme ekranlarına "önce dışa aktar" bağlantısı.
- **Bağımlılık:** Web için Faz 4–5 (Faz 6 ile paralel yürüyebilir), mobil için Faz 6.
- **Kabul kriterleri:** Çıktıda yalnızca kendi verin bulunur. Excel'de Türkçe karakterler bozulmaz (UTF-8 BOM). Formül enjeksiyonu nötralize edilir (`=`, `+`, `-`, `@` ile başlayan hücreler).
- **Test stratejisi:** Formatlayıcı için snapshot ve kenar durumu testleri (Vitest), RLS izolasyon testi, Playwright ile indirme testi, `jest-expo` + RNTL ile mobil paylaşım ekranı (K10).
- **Riskler ve güvenlik:** CSV injection. Büyük hesaplarda zaman aşımı (sayfalama ve streaming). Export dosyası sunucuda saklanmaz.
- **Görevler:** DB: fonksiyon · APP: formatlayıcı, web ve mobil UI · SEC: injection incelemesi · QA: testler · DOC: export formatı belgesi.
- **Quality Gate 9.**

## Revizyon 1'e göre değişiklikler
- **Eklendi:** Hesap silme ekranına "önce dışa aktar" bağlantısı.
- **Değişti:** Bağımlılık. Mobil kısım artık Faz 6'ya bağlı.

---
Genel plan, kurallar, veritabanı/RLS, güvenlik ve test kapıları: [../plan.md](../plan.md)
