-- Clients cannot call maintenance/rate-limit functions or read reports (Faz 3, SEC).
begin;
create extension if not exists pgtap with schema extensions;

select plan(8);

insert into auth.users (id, email) values ('a1000000-0000-4000-8000-0000000000a1', 'priv@test.local');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub": "a1000000-0000-4000-8000-0000000000a1", "role": "authenticated"}', true);

select throws_ok(
  $$ select public.rate_limit_hit('a1000000-0000-4000-8000-0000000000a1', 'tmdb', 60, 1000000) $$,
  '42501', null, 'clients cannot reset or inflate their own rate limit'
);
select throws_ok($$ select public.catalog_cache_cleanup(interval '90 days', false) $$, '42501', null,
  'clients cannot delete catalog data');
select throws_ok($$ select public.catalog_cache_stats() $$, '42501', null, 'clients cannot read cache stats');
select throws_ok($$ select public.catalog_cache_report() $$, '42501', null, 'clients cannot write reports');
select throws_ok($$ select public.purge_rate_limits() $$, '42501', null, 'clients cannot purge rate limits');
select throws_ok($$ select * from public.maintenance_reports $$, '42501', null, 'clients cannot read reports');

reset role;
set local role anon;
select throws_ok(
  $$ select public.rate_limit_hit('a1000000-0000-4000-8000-0000000000a1', 'tmdb', 60, 1) $$,
  '42501', null, 'anon cannot call rate_limit_hit'
);
select throws_ok($$ select * from public.maintenance_reports $$, '42501', null, 'anon cannot read reports');

reset role;
select * from finish();
rollback;
