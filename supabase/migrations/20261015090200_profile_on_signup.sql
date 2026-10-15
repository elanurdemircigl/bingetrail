-- Create a profile row for every new auth user (Faz 1).
-- SECURITY DEFINER because the trigger runs as the auth admin role, which cannot
-- write to public.profiles. Kept minimal, with an empty search_path, and not
-- executable by any client role.

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_locale text := new.raw_user_meta_data ->> 'locale';
begin
  insert into public.profiles (id, locale)
  values (
    new.id,
    case when requested_locale in ('tr', 'en') then requested_locale else 'tr' end
  );
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
