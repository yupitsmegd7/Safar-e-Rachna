import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

test('database permissions protect author access and reader records', async t => {
  const db = new PGlite();
  const author = '00000000-0000-4000-8000-000000000001';
  const reader = '00000000-0000-4000-8000-000000000002';
  const other = '00000000-0000-4000-8000-000000000003';
  // Minimal Supabase platform schemas, with PostgreSQL RLS left fully active.
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create schema auth;
    create table auth.users(id uuid primary key, email text, email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth, public to anon, authenticated;
    create schema storage;
    create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text, name text);
    alter table storage.objects enable row level security;
    grant usage on schema storage to anon, authenticated;
    grant select, insert, update, delete on storage.objects to authenticated;
    insert into auth.users values
      ('${author}', 'author@example.test', now()),
      ('${reader}', 'reader@example.test', now()),
      ('${other}', 'other@example.test', now());
  `);
  const setup = await readFile(new URL('../supabase/setup.sql', import.meta.url), 'utf8');
  await db.exec(setup);
  async function as(role, id, fn) {
    assert.ok(['anon', 'authenticated'].includes(role));
    await db.exec(`begin; set local role ${role};`);
    await db.query("select set_config('request.jwt.claim.sub', $1, true)", [id || '']);
    try { const result = await fn(); await db.exec('commit'); return result; }
    catch (error) { await db.exec('rollback'); throw error; }
  }
  const insertPost = (id, status) => db.query('insert into public.posts(id,title,category,body,status) values ($1,$2,$3,$4,$5)', [id, 'A private page', 'Articles', 'Unpublished writing', status]);
  const like = (id, user) => db.query('insert into public.likes(post_id,user_id) values ($1,$2)', [id, user]);
  const comment = (id, user, body='A thoughtful response') => db.query('insert into public.comments(post_id,user_id,name,body) values ($1,$2,$3,$4)', [id,user,'Reader',body]);
  const denied = action => assert.rejects(action, /permission denied|row-level security|Invalid comment account/i);

  try {
    await t.test('the first reader cannot claim the journal', async () => {
      assert.equal((await as('authenticated', reader, () => db.query('select public.is_author() as author'))).rows[0].author, false);
      await denied(() => as('authenticated', reader, () => db.query('insert into public.journal_admins values ($1)', [reader])));
      await denied(() => as('authenticated', reader, () => insertPost('unauthorized', 'published')));
      const result = await as('authenticated', reader, () => db.query("update public.settings set data='{}' where id=1 returning id"));
      assert.equal(result.rows.length, 0);
      const grant = await readFile(new URL('../supabase/set-author.sql', import.meta.url), 'utf8');
      await db.exec(grant.replace('REPLACE_WITH_YOUR_EMAIL', 'author@example.test'));
      assert.equal((await as('authenticated', author, () => db.query('select public.is_author() as author'))).rows[0].author, true);
    });
    await t.test('published writing is public and drafts stay private', async () => {
      await as('authenticated', author, () => insertPost('private-draft', 'draft'));
      assert.equal((await as('anon', null, () => db.query('select id from public.posts'))).rows.length, 6);
      assert.equal((await as('authenticated', reader, () => db.query("select id from public.posts where id='private-draft'"))).rows.length, 0);
      assert.equal((await as('authenticated', author, () => db.query('select id from public.posts'))).rows.length, 7);
      await denied(() => as('anon', null, () => insertPost('anonymous', 'published')));
    });
    await t.test('likes are unique, private by account, and counted publicly', async () => {
      await as('authenticated', reader, () => like('sample-1', reader));
      await assert.rejects(() => as('authenticated', reader, () => like('sample-1', reader)), /duplicate key/i);
      await denied(() => as('authenticated', reader, () => like('sample-2', other)));
      await denied(() => as('authenticated', reader, () => like('private-draft', reader)));
      await as('authenticated', other, () => like('sample-1', other));
      assert.equal((await as('authenticated', reader, () => db.query('select * from public.likes'))).rows.length, 1);
      await denied(() => as('anon', null, () => db.query('select * from public.likes')));
      const counts = await as('anon', null, () => db.query('select * from public.get_like_counts()'));
      assert.equal(Number(counts.rows.find(r => r.post_id === 'sample-1').total), 2);
      await as('authenticated', reader, () => db.query('delete from public.likes where user_id=$1', [other]));
      assert.equal((await db.query('select * from public.likes')).rows.length, 2);
      await as('authenticated', reader, () => db.query('delete from public.likes'));
      assert.equal((await db.query('select * from public.likes')).rows.length, 1);
    });
    await t.test('comments reject spoofing, oversized text, drafts, and rapid repeats', async () => {
      await denied(() => as('anon', null, () => comment('sample-1', reader)));
      await denied(() => as('authenticated', reader, () => comment('sample-1', other)));
      await denied(() => as('authenticated', reader, () => comment('private-draft', reader)));
      await assert.rejects(() => as('authenticated', reader, () => comment('sample-1', reader, 'a'.repeat(3001))), /check constraint/i);
      await as('authenticated', reader, () => comment('sample-1', reader));
      await assert.rejects(() => as('authenticated', reader, () => comment('sample-2', reader)), /Wait before posting/i);
      const publicComments = await as('anon', null, () => db.query('select id,name,body,date from public.comments'));
      assert.equal(publicComments.rows.length, 1);
      await denied(() => as('anon', null, () => db.query('select user_id from public.comments')));
      await denied(() => as('authenticated', reader, () => db.query("update public.comments set body='Changed'")));
      await as('authenticated', other, () => db.query('delete from public.comments'));
      assert.equal((await db.query('select id from public.comments')).rows.length, 1);
      await as('authenticated', author, () => db.query('delete from public.comments'));
      assert.equal((await db.query('select id from public.comments')).rows.length, 0);
    });
    await t.test('image uploads require the author account', async () => {
      const upload = () => db.query("insert into storage.objects(bucket_id,name) values ('journal-images','portrait.jpg')");
      await denied(() => as('authenticated', reader, upload));
      await as('authenticated', author, upload);
      assert.equal((await as('authenticated', reader, () => db.query('select * from storage.objects'))).rows.length, 0);
      await denied(() => as('authenticated', author, () => db.query("insert into storage.objects(bucket_id,name) values ('other-bucket','portrait.jpg')")));
    });
    await t.test('rerunning setup preserves existing writing and settings', async () => {
      await as('authenticated', author, () => db.query("update public.posts set title='My revised writing' where id='sample-1'"));
      await as('authenticated', author, () => db.query("update public.settings set data=jsonb_set(data,'{author}','\"My author name\"') where id=1"));
      await db.exec(setup);
      assert.equal((await db.query("select title from public.posts where id='sample-1'")).rows[0].title, 'My revised writing');
      assert.equal((await db.query('select data from public.settings where id=1')).rows[0].data.author, 'My author name');
    });
  } finally { await db.close(); }
});
