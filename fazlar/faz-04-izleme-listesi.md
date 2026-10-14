# Faz 4 — İzleme Listesi, Puan, Notlar ve Hesap Silme (Web)

> Kaynak: [`plan.md`](../plan.md), Revizyon 2.1 · Platform: **Web** + backend · Bağımlılık: [Faz 3](faz-03-tmdb-katalog-arama.md) (veri modeli [Faz 1](faz-01-supabase-cekirdegi.md)'den) · Sonraki: [Faz 5](faz-05-bolum-takibi-continue-watching.md) · Karmaşıklık: Orta

- **Amaç:** Çekirdek takip deneyimi ve hesap silmenin kullanıcıya açılması (K5).
- **Kullanıcı değeri:** Listeye ekleme; planned/watching/completed/paused/dropped durumları; 1–10 puan; kişisel not; filtreleme ve sıralama. **Profil > Hesabı sil.**
- **Teknik teslimler:**
  - `watchlist_items` sözleşmeleri (`api-client`) ve web hook'ları (optimistic update).
  - Durum geçiş kuralları (`packages/shared`). Durum `completed` olunca `completed_at`, `watching` olunca `started_at` set edilir.
  - Liste ekranı (filtre durumu Zustand'da), durum seçici, puan ve not formu (RHF + Zod).
  - **`delete-account` Edge Function:**
    1. JWT doğrulanır. Silinecek hesap yalnızca JWT'deki `sub`'dan alınır.
    2. Parola yeniden doğrulanır (re-auth).
    3. `avatars/{uid}/` altındaki dosyalar silinir.
    4. `auth.admin.deleteUser` çağrılır (service role); cascade bütün kullanıcı verisini temizler.
    5. `account_deletion_log` tablosuna kişisel veri içermeyen bir kayıt düşer.
  - **Web hesap silme ekranı:** İki adımlı onay ve parola girişi. Ekran işlemin **geri alınamaz** olduğunu ve neyin silineceğini TR ve EN olarak açıkça gösterir. Bekleme süresi yoktur (K13).
- **Bağımlılık:** Faz 3.
- **Kabul kriterleri:**
  - Aynı başlık iki kez eklenemez.
  - Puan ve not kısıtları hem DB'de hem istemcide uygulanır.
  - Not güvenle render edilir.
  - Listeden silme onay ister.
  - Hesap silindikten sonra oturum düşer, aynı e-postayla giriş başarısız olur, DB'de ve storage'da kullanıcı verisi kalmaz.
  - Re-auth olmadan silme reddedilir.
  - Geri alınamazlık uyarısı silme düğmesinden önce görünür.
- **Test stratejisi:**
  - Vitest ile durum makinesi.
  - RTL ile formlar ve silme onayı (uyarı metninin varlığı dahil).
  - Deno testleri, `delete-account` için: yetkisiz çağrı, gövdede başka kullanıcının id'si, re-auth eksik.
  - Playwright ile liste akışı ve hesap silme E2E.
  - pgTAP ile kısıtlar.
- **Riskler ve güvenlik:** IDOR (yalnızca JWT `sub` kullanılarak önlenir), service role yalnızca silme işleminde, fonksiyona rate limit, notlar log'lara yazılmaz, `dangerouslySetInnerHTML` yasak.
- **Görevler:** APP: domain, web UI, hesap silme ekranı · DB: `delete-account` fonksiyonu, gerekiyorsa ek kısıt veya indeks · SEC: silme akışı ve IDOR incelemesi · QA: E2E · DOC: kullanıcı rehberi, `docs/account-deletion.md`.
- **Quality Gate 4.**

## Revizyon 1'den kaldırılan veya taşınan görevler
- ~~`api-client` içinde CRUD hook'ları~~ → Hook'lar `apps/web` içinde; `api-client` yalnızca sözleşmeleri tutar (K3).
- **Eklendi:** Hesap silme. Revizyon 1'de "Faz 9 önerisi" olarak duruyordu.

---
Genel plan, kurallar, veritabanı/RLS, güvenlik ve test kapıları: [../plan.md](../plan.md)
