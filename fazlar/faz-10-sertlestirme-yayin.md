# Faz 10 — Sertleştirme ve Yayın Hazırlığı

> Kaynak: [`plan.md`](../plan.md), Revizyon 2.1 · Platform: **Web + mobil** · Bağımlılık: [Faz 7](faz-07-senkronizasyon.md), [Faz 8](faz-08-yaklasan-bolum-takvimi.md), [Faz 9](faz-09-disa-aktarma.md) · Karmaşıklık: Orta
>
> Revizyon 1'de bu faz "Faz 9" idi.

- **Amaç:** Üretime hazır kalite.
- **Kullanıcı değeri:** Güvenli, hızlı, erişilebilir ve mağazaya hazır bir uygulama.
- **Teknik teslimler:**
  - OWASP ASVS L1 kontrol listesi ve tehdit modelinin son güncellemesi.
  - CSP ve güvenlik header'ları.
  - Bağımlılık denetimi.
  - Web Vitals bütçeleri.
  - Erişilebilirlik (axe + elle kontrol).
  - Hata izleme önerisi.
  - **EAS build profilleri.** İlk production mobil build burada yapılır; build ve submit'i sen yaparsın.
  - **Mobil E2E için Maestro değerlendirmesi** (K11): kapsam, maliyet ve CI uygunluğu raporlanır, karar sana bırakılır.
  - **Hosting seçimi** (K15): web hosting seçenekleri karşılaştırılır, deploy'u sen yaparsın.
  - Gizlilik politikası taslağı (hesap silme ve veri saklama bölümleriyle).
  - Katalog temizleme cron'unun etkinleştirme değerlendirmesi: `catalog_cache_report` verisi ve dry-run sonucu sunulur. Etkinleştirmeye sen karar verirsin (K7).
- **Bağımlılık:** Faz 7, 8 ve 9.
- **Kabul kriterleri:** Kritik veya yüksek güvenlik bulgusu yok. E2E paketi yeşil. Lighthouse ≥ 90. TR/EN eksik anahtar yok. Mağazaların hesap silme gereksinimi karşılanmış (Faz 4 ve 6'dan).
- **Test stratejisi:** Tam web E2E paketi, `jest-expo` paketi, cihaz kontrol listesinin tamamı, güvenlik testleri, performans ve a11y ölçümleri. Maestro onaylanırsa mobil E2E smoke.
- **Riskler ve güvenlik:** Mağaza politikası reddi (hesap silme ve gizlilik metinleri hazır olmalı), production secret yapılandırması (sen yaparsın), hosting'e özgü header ve CSP farkları.
- **Görevler:** APP: performans ve a11y düzeltmeleri, EAS profilleri · DB: advisor temizliği, index ayarları · SEC: ASVS denetimi, son tehdit modeli · QA: tam regresyon, Maestro değerlendirmesi · DOC: gizlilik politikası taslağı, yayın runbook'u, hosting karşılaştırması.
- **Quality Gate 10 (yayın kararı):** Deploy ve mağaza gönderimini sen yaparsın.

## Revizyon 1'den kaldırılan veya taşınan görevler
- ~~"Önerilen ek: hesap silme (onayına bağlı)"~~ → Kesinleşti ve Faz 1, 4 ve 6'ya dağıtıldı (K5, K13). Bu fazda yalnızca mağaza uyumluluğu doğrulanır.

---
Genel plan, kurallar, veritabanı/RLS, güvenlik ve test kapıları: [../plan.md](../plan.md)
