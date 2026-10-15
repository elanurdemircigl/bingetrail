-- Local development seed: FAKE catalog data only. Never real user data.
-- Real catalog rows arrive through the tmdb Edge Function in Faz 3.
-- Titles, ids and dates are invented. Tests do not depend on this seed (they use tmdb_id >= 990000).

insert into public.titles (tmdb_id, media_type, original_title, translations, release_date, tmdb_status, number_of_seasons)
values
  (101, 'tv', 'Örnek Dizi',
   '{"tr": {"title": "Örnek Dizi", "overview": "Yerel geliştirme için sahte dizi."},
     "en": {"title": "Sample Series", "overview": "Fake series for local development."}}',
   '2024-01-15', 'Returning Series', 2),
  (102, 'movie', 'Örnek Film',
   '{"tr": {"title": "Örnek Film", "overview": "Yerel geliştirme için sahte film."},
     "en": {"title": "Sample Movie", "overview": "Fake movie for local development."}}',
   '2023-06-01', 'Released', null)
on conflict (tmdb_id, media_type) do nothing;

insert into public.seasons (title_id, season_number, name, air_date, episode_count)
select t.id, s.n, jsonb_build_object('tr', 'Sezon ' || s.n, 'en', 'Season ' || s.n),
       ('2024-01-15'::date + (s.n - 1) * 365), 3
from public.titles t, generate_series(1, 2) as s(n)
where t.tmdb_id = 101 and t.media_type = 'tv'
on conflict (title_id, season_number) do nothing;

insert into public.episodes (season_id, title_id, season_number, episode_number, name, air_date, runtime)
select s.id, s.title_id, s.season_number, e.n,
       jsonb_build_object('tr', 'Bölüm ' || e.n, 'en', 'Episode ' || e.n),
       s.air_date + (e.n - 1) * 7, 45
from public.seasons s
join public.titles t on t.id = s.title_id and t.tmdb_id = 101
cross join generate_series(1, 3) as e(n)
on conflict (season_id, episode_number) do nothing;
