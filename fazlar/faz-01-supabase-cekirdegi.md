# Faz 1 — Supabase Çekirdeği (Şema + RLS + Hesap Silme Modeli)

> Kaynak: [`plan.md`](../plan.md), Revizyon 2.1 · Platform: Backend · Bağımlılık: [Faz 0](faz-00-monorepo-temeli.md) · Sonraki: [Faz 2](faz-02-auth-i18n-kabuk.md) · Karmaşıklık: Yüksek

- **Amaç:** Bütün özellikleri taşıyacak veri modelini en baştan RLS ile güvenli kurmak. Hesap silme bu modelin ilk günden parçasıdır (K5).
- **Kullanıcı değeri:** Verilerin yalnızca kullanıcının kendisine görünmesi ve hesap silindiğinde iz bırakmadan kaldırılması.
- **Teknik teslimler:**
  - `plan.md` Bölüm 5'teki tablolar, enum'lar ve indeksler: `profiles`, `titles`, `seasons`, `episodes`, `watchlist_items`, `episode_progress`, `rate_limits`, `account_deletion_log`.
  - `updated_at` tetikleyicileri ve `handle_new_user` profil tetikleyicisi.
  - RLS politikaları.
  - `avatars` storage bucket'ı ve politikaları.
  - Realtime publication.
  - **Hesap silme veri modeli:** Kullanıcıya ait bütün tablolarda `auth.users` FK'si `on delete cascade` olur. Storage temizleme sırası tanımlanır. `account_deletion_log` tablosu yalnızca tuzlu hash ve zaman tutar, kişisel veri içermez.
  - `supabase/config.toml`, pgTAP testleri ve `packages/db-types`.
- **Bağımlılık:** Faz 0. Supabase CLI'yı sen kurarsın; `supabase init` ve `start` komutlarını sen çalıştırırsın.
- **Kabul kriterleri:**
  - `supabase db reset` temiz çalışır.
  - Her tabloda RLS açıktır.
  - A kullanıcısı B'nin verisini okuyamaz, yazamaz, silemez.
  - Katalog tablolarına `authenticated` rolü yazamaz.
  - Bir `auth.users` kaydı silindiğinde kullanıcıya ait bütün satırlar silinir. Katalog tabloları etkilenmez. `account_deletion_log` tablosuna kişisel veri yazılmaz.
  - Supabase advisor'larında kritik bulgu yoktur.
- **Test stratejisi:** pgTAP ile şunlar test edilir: şema, kısıtlar (puan 1–10, not ≤ 5000), RLS pozitif ve negatif senaryoları, anon erişiminin reddi, cascade silme, `user_id` kolonu olan her tablonun cascade FK'ye sahip olması (katalog sorgusuyla), `account_deletion_log` tablosunun istemci rolleri tarafından okunamaması.
- **Riskler ve güvenlik:**
  - RLS performansı için `(select auth.uid())` kalıbı kullanılır.
  - View'larda `security_invoker = true` zorunludur. `SECURITY DEFINER` fonksiyonlarında `search_path` sabitlenir.
  - Unutulan bir FK yetim kişisel veri bırakabilir; pgTAP katalog kontrolü bunu yakalar.
  - Migration'ları prod'a sen uygularsın.
- **Görevler:** DB: migration'lar, `config.toml`, pgTAP, tip üretimi · SEC: `supabase/tests/security/rls_isolation.test.sql`, `account_deletion.test.sql`, tehdit modeli v1 · QA: CI'a pgTAP job'ı · DOC: `docs/data-model.md`, `docs/account-deletion.md` · APP: yazmaz, şemayı inceler.
- **Quality Gate 1:** RLS ve cascade test raporu ile advisor çıktısı incelenir. Migration'ı uzak projeye sen push'larsın.

## Revizyon 1'e göre değişiklikler
- **Eklendi:** Hesap silme veri modeli, `rate_limits`, `account_deletion_log`, `titles.last_referenced_at`, `watchlist_items.title_id` için `restrict` FK, cascade testleri.
- **Taşındı:** `supabase/config.toml` Faz 0'dan bu faza.

---
Genel plan, kurallar, veritabanı/RLS, güvenlik ve test kapıları: [../plan.md](../plan.md)
