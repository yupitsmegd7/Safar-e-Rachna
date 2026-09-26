-- Run once in the SQL Editor of a new Supabase project.
-- Safe to run again: existing writing and settings are preserved.
begin;

create table if not exists public.journal_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.journal_admins enable row level security;
revoke all on public.journal_admins from anon, authenticated;

create or replace function public.is_author()
returns boolean language sql stable security definer set search_path = ''
as $$ select exists(select 1 from public.journal_admins where user_id = (select auth.uid())) $$;
revoke all on function public.is_author() from public;
grant execute on function public.is_author() to anon, authenticated;

create table if not exists public.settings (
  id integer primary key check (id = 1),
  data jsonb not null check (jsonb_typeof(data) = 'object' and octet_length(data::text) <= 100000)
);
create table if not exists public.posts (
  id text primary key check (length(id) between 1 and 100),
  title text not null check (length(trim(title)) between 1 and 220),
  category text not null check (category in ('Poems','Articles','Book reviews','Song reviews','Movie reviews','Daily practices')),
  excerpt text not null default '' check (length(excerpt) <= 3000),
  body text not null check (length(trim(body)) between 1 and 120000),
  tags text not null default '' check (length(tags) <= 500),
  image text not null default '' check (length(image) <= 3000),
  date timestamptz not null default now(),
  status text not null default 'draft' check (status in ('draft','published','deleted')),
  sample boolean not null default false
);
create table if not exists public.likes (
  post_id text not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (post_id, user_id)
);
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id text not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 80),
  body text not null check (length(trim(body)) between 1 and 3000),
  date timestamptz not null default now()
);
create index if not exists posts_status_date on public.posts(status, date desc);
create index if not exists comments_post_date on public.comments(post_id, date);
create index if not exists comments_user_date on public.comments(user_id, date desc);
create index if not exists likes_user on public.likes(user_id);

alter table public.settings enable row level security;
alter table public.posts enable row level security;
alter table public.likes enable row level security;
alter table public.comments enable row level security;

revoke all on public.settings, public.posts, public.likes, public.comments from anon, authenticated;
grant select on public.settings, public.posts to anon, authenticated;
grant insert, update, delete on public.settings, public.posts to authenticated;
grant select, insert, delete on public.likes to authenticated;
-- Readers see display names, not the account identifiers behind comments.
grant select (id, post_id, name, body, date) on public.comments to anon, authenticated;
grant insert (post_id, user_id, name, body) on public.comments to authenticated;
grant delete on public.comments to authenticated;

drop policy if exists settings_read on public.settings;
create policy settings_read on public.settings for select to anon, authenticated using (true);
drop policy if exists settings_author on public.settings;
create policy settings_author on public.settings for all to authenticated using ((select public.is_author())) with check ((select public.is_author()));
drop policy if exists posts_read on public.posts;
create policy posts_read on public.posts for select to anon, authenticated using (status = 'published' or (select public.is_author()));
drop policy if exists posts_author on public.posts;
create policy posts_author on public.posts for all to authenticated using ((select public.is_author())) with check ((select public.is_author()));
drop policy if exists likes_read_own on public.likes;
create policy likes_read_own on public.likes for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists likes_insert_own on public.likes;
create policy likes_insert_own on public.likes for insert to authenticated with check (
  user_id = (select auth.uid()) and exists (select 1 from public.posts where id = post_id and status = 'published')
);
drop policy if exists likes_delete_own on public.likes;
create policy likes_delete_own on public.likes for delete to authenticated using (user_id = (select auth.uid()));
drop policy if exists comments_read on public.comments;
create policy comments_read on public.comments for select to anon, authenticated using (
  exists (select 1 from public.posts where id = post_id and (status = 'published' or (select public.is_author())))
);
drop policy if exists comments_insert_own on public.comments;
create policy comments_insert_own on public.comments for insert to authenticated with check (
  user_id = (select auth.uid()) and exists (select 1 from public.posts where id = post_id and status = 'published')
);
drop policy if exists comments_delete on public.comments;
create policy comments_delete on public.comments for delete to authenticated using (user_id = (select auth.uid()) or (select public.is_author()));

-- Only aggregate counts are public; raw reader account IDs stay private.
create or replace function public.get_like_counts()
returns table(post_id text, total bigint)
language sql stable security definer set search_path = ''
as $$
  select l.post_id, count(*) from public.likes l join public.posts p on p.id = l.post_id
  where p.status = 'published' or (select public.is_author()) group by l.post_id
$$;
revoke all on function public.get_like_counts() from public;
grant execute on function public.get_like_counts() to anon, authenticated;

-- Enforce the comment cooldown even for direct calls to the database API.
create or replace function public.limit_comment_frequency()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.user_id is distinct from auth.uid() then
    raise exception 'Invalid comment account' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 0));
  if exists (select 1 from public.comments where user_id = new.user_id and date > clock_timestamp() - interval '20 seconds') then
    raise exception 'Wait before posting another comment' using errcode = 'P0001';
  end if;
  new.date := clock_timestamp();
  return new;
end
$$;
revoke all on function public.limit_comment_frequency() from public, anon, authenticated;
drop trigger if exists comment_cooldown on public.comments;
create trigger comment_cooldown before insert on public.comments for each row execute function public.limit_comment_frequency();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('journal-images', 'journal-images', true, 5000000, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
drop policy if exists journal_images_author_read on storage.objects;
create policy journal_images_author_read on storage.objects for select to authenticated using (bucket_id = 'journal-images' and (select public.is_author()));
drop policy if exists journal_images_author_insert on storage.objects;
create policy journal_images_author_insert on storage.objects for insert to authenticated with check (bucket_id = 'journal-images' and (select public.is_author()));
drop policy if exists journal_images_author_update on storage.objects;
create policy journal_images_author_update on storage.objects for update to authenticated using (bucket_id = 'journal-images' and (select public.is_author())) with check (bucket_id = 'journal-images' and (select public.is_author()));
drop policy if exists journal_images_author_delete on storage.objects;
create policy journal_images_author_delete on storage.objects for delete to authenticated using (bucket_id = 'journal-images' and (select public.is_author()));

-- Initial content is added below. Existing rows are never replaced.

insert into public.settings(id, data) values (1, '{"title":"Safar-e-Rachna","subtitle":"A journey through words, wonder & everything in between.","author":"Gourav Dutta","bio":"A student of technology, a wanderer in words. I write to notice the things we rush past — in books, in cinema, in life.","headline":"Some journeys begin with a single word.","banner":"/landscape.jpg","photo":"","tagline":"Writer · Student · Curious observer","instagram":"","linkedin":"","twitter":"","github":"","substack":"","website":"","labels":"Poems,Articles,Book reviews,Song reviews,Movie reviews,Daily practices","theme":"parchment"}'::jsonb) on conflict (id) do nothing;
insert into public.posts(id,title,category,excerpt,body,tags,image,date,status,sample) values ('sample-1','The art of paying attention','Articles','Perhaps the world has not grown quieter. Perhaps we have forgotten how to listen.','The late afternoon enters a room without asking permission. It rests on the edge of a book, on the chipped lip of a cup, on all the things we have stopped seeing.

Attention is a small act of return. When we look closely at something ordinary, it begins to resist the word ordinary. A street becomes a collection of lives. A familiar voice carries a hesitation we had missed.

Writing begins here: with the willingness to stay a little longer. Before the argument, before the beautiful sentence, there is the patient work of noticing.

What did you walk past today that might deserve a second look?','attention,life,reflection','/landscape.jpg','2026-09-24','published',true) on conflict (id) do nothing;
insert into public.posts(id,title,category,excerpt,body,tags,image,date,status,sample) values ('sample-2','Where the light stays','Poems','A poem for the small things that refuse to leave us.','There is a light
that does not belong to the sun.

It lives in a cup
you left beside the window,
in the page you folded
to find your way home.

Evening comes.
The room forgets its colours.

Still, some things
keep their own dawn.','light,memory,home','','2026-09-23','published',true) on conflict (id) do nothing;
insert into public.posts(id,title,category,excerpt,body,tags,image,date,status,sample) values ('sample-3','A room, a book, a world beyond','Book reviews','On reading slowly, and letting a book change the questions you ask.','A reading notebook

A useful review begins with a specific encounter. Which passage made you pause? What did the book make possible that its summary could not?

Rather than announcing that a book is good or bad, begin with its choices: the voice, the distance between narrator and character, the things left unsaid. Then ask what those choices cost.

This sample is a starting point for your own review. Add the book title, author, passages you want to discuss, and your considered response.','books,reading,literature','/scholar.jpg','2026-09-22','published',true) on conflict (id) do nothing;
insert into public.posts(id,title,category,excerpt,body,tags,image,date,status,sample) values ('sample-4','The silence between the notes','Song reviews','Sometimes the part of a song that stays with us is the space it leaves.','A listening notebook

Listen once for the voice. Listen again for everything beneath it. Where does the arrangement step back? Where does a repeated line acquire a different meaning?

The strongest music writing joins close listening to a personal response. A feeling is a beginning; a precise description helps another listener discover why it happened.

Replace this sample with your review, including the song, artist, and the moments worth returning to.','music,sound,art','','2026-09-21','published',true) on conflict (id) do nothing;
insert into public.posts(id,title,category,excerpt,body,tags,image,date,status,sample) values ('sample-5','What the camera leaves behind','Movie reviews','An invitation to look beyond the plot and into the frame.','A cinema notebook

A film tells us where to look. It also tells us how long to keep looking. A doorway, an empty chair, a face held in silence: each can carry a story before anyone speaks.

When reviewing a film, choose one scene and describe its work. Consider framing, sound, performance, and the cut that ends it. How does the form shape the feeling?

Use this sample as a place to begin your own review. Name the film and director, and flag spoilers before discussing the ending.','cinema,art,stories','','2026-09-20','published',true) on conflict (id) do nothing;
insert into public.posts(id,title,category,excerpt,body,tags,image,date,status,sample) values ('sample-6','Who decides which stories survive?','Daily practices','A question at the intersection of literature, power, and memory.','Practice notebook

Which stories reach us, and which disappear before they can be heard? Start with a particular time and place, then examine the institutions that publish, translate, preserve, and teach literature.

Research three distinct mechanisms: political restrictions, commercial incentives, and the availability of translation. Find a documented example for each. Avoid assuming that one mechanism explains every absence.

A good essay makes its uncertainties visible. What evidence would change your conclusion?','history,politics,literature','','2026-09-19','published',true) on conflict (id) do nothing;

commit;
