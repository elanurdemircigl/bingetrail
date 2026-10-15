-- profiles.avatar_path may only point into the owner's own storage folder.
-- Storage RLS already limits uploads to "<uid>/…"; this keeps the profile row
-- from referencing someone else's object (or a crafted path) even though the
-- column is client-writable. Forward-only: earlier migrations are untouched.
--
-- Accepted: NULL, or exactly "<profile id>/<file>" where <file> is a single
-- segment of [A-Za-z0-9._-] that starts with a letter or digit (no "..", no
-- nested folders, no other user's id, no absolute URLs).

alter table public.profiles
  add constraint profiles_avatar_path_owner check (
    avatar_path is null
    or avatar_path ~ ('^' || id::text || '/[A-Za-z0-9][A-Za-z0-9._-]{0,199}$')
  );

comment on constraint profiles_avatar_path_owner on public.profiles is
  'avatar_path must be NULL or "<own user id>/<single file name>".';
