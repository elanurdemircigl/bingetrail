# Veri Saklama Politikası

> Durum: Faz 3 · Karar: K7

## Katalog önbelleği (`titles`, `seasons`, `episodes`)

Bu tablolar kişisel veri içermez; TMDB'den alınmış film ve dizi bilgilerinin kopyasıdır.

| Kural                                                                             | Uygulama                                                                                                       |
| --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Kayıtlar düzenli tazelenir                                                        | `tmdb` fonksiyonu kayıtları 24 saatten eski bulursa yeniden çeker                                              |
| Bir kullanıcının listesinde ya da izleme geçmişinde olan başlık **asla silinmez** | `watchlist_items` ve `episode_progress` FK'leri `restrict`; temizleme sorgusu da bu kayıtları dışarıda bırakır |
| Silme adayı                                                                       | Hiçbir kullanıcının takip etmediği ve **90 gündür** okunmamış (`last_referenced_at`) başlıklar                 |
| Alt sınır                                                                         | 30 günden kısa saklama süresi fonksiyonda reddedilir                                                           |

### Temizleme henüz AÇIK DEĞİL

`public.catalog_cache_cleanup(older_than, dry_run)` fonksiyonu hazır ve testli, ama **zamanlanmış işi yok**. Açılması için şu koşullar gerekiyor:

1. Bu politikanın onaylanması.
2. En az 4 haftalık `catalog_cache_report` verisinin incelenmesi. Bu iş haftalık çalışır ve sonuçlarını `maintenance_reports` tablosuna yazar.
3. Önce bir deneme çalıştırması (dry run): `select public.catalog_cache_cleanup(interval '90 days', true);`
4. Eşiğin gözlemlenen veriye göre kesinleştirilmesi.
5. Depo sahibinin işi açması:

```sql
select cron.schedule('catalog-cache-cleanup', '41 4 * * 1',
  $$select public.catalog_cache_cleanup(interval '90 days', false)$$);
```

Her çalıştırma, silinen başlık sayısını `maintenance_reports` tablosuna yazar.

## Operasyonel veriler

| Veri                            | Saklama                       | Mekanizma                                  |
| ------------------------------- | ----------------------------- | ------------------------------------------ |
| `rate_limits` (istek sayaçları) | 1 gün                         | Her gün `purge-rate-limits` cron işi       |
| `maintenance_reports`           | Süresiz (küçük)               | Gerekirse Faz 10'da gözden geçirilecek     |
| `account_deletion_log`          | Süresiz, kişisel veri içermez | [account-deletion.md](account-deletion.md) |

## Kişisel veriler

Kullanıcı hesabı silindiğinde profil, izleme listesi, notlar, puanlar, izleme ilerlemesi ve hız sınırı sayaçları cascade ile anında silinir. Avatar dosyaları `delete-account` fonksiyonuyla, kullanıcı silinmeden önce Storage API üzerinden silinir ([account-deletion.md](account-deletion.md)).
