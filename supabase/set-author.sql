-- First sign in on your deployed website. Then replace the email below
-- with the SAME email and run this in the Supabase SQL Editor.
do $$
declare
  author_email text := 'REPLACE_WITH_YOUR_EMAIL';
  author_id uuid;
begin
  select id into author_id from auth.users
  where lower(email) = lower(author_email) and email_confirmed_at is not null;
  if author_id is null then
    raise exception 'No verified account found. Sign in on your website with this email first.';
  end if;
  insert into public.journal_admins(user_id) values (author_id) on conflict do nothing;
end
$$;
