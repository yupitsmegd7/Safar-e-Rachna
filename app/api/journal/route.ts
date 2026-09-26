import {createClient} from '@/lib/supabase/server';
import {defaults, categories, type Post} from '@/lib/content';
import {socialFields, socialUrl, themes} from '@/lib/profile';
import {InputError, object, textField, imageUrl, validOrigin} from '@/lib/request';
export const dynamic = 'force-dynamic';
const reply = (data: unknown, status = 200) => Response.json(data, {status, headers: {'Cache-Control': 'private, no-store'}});

export async function GET() {
  try {
    const db = await createClient();
    const {data: {user}, error: authError} = await db.auth.getUser();
    if (authError && authError.name !== 'AuthSessionMissingError') throw authError;
    const author = user ? await db.rpc('is_author') : {data: false, error: null};
    if (author.error) throw author.error;
    const [settings, posts, counts, mine] = await Promise.all([
      db.from('settings').select('data').eq('id', 1).single(),
      db.from('posts').select('*').neq('status', 'deleted').order('date', {ascending: false}),
      db.rpc('get_like_counts'),
      user ? db.from('likes').select('post_id').eq('user_id', user.id) : Promise.resolve({data: [], error: null}),
    ]);
    for (const result of [settings, posts, counts, mine]) if (result.error) throw result.error;
    const totals = new Map((counts.data ?? []).map((r: {post_id: string; total: number}) => [r.post_id, Number(r.total)]));
    const liked = new Set((mine.data ?? []).map(r => r.post_id));
    return reply({
      posts: (posts.data ?? []).map((p: Post) => ({...p, likes: totals.get(p.id) ?? 0, liked: liked.has(p.id)})),
      settings: {...defaults, ...settings.data?.data}, owner: !!author.data,
      user: user ? {name: user.user_metadata?.display_name || 'Reader'} : null,
    });
  } catch (error) {
    console.error('Journal load failed', error);
    return reply({error: 'The journal could not be loaded. For a new deployment, complete the Supabase setup in DEPLOYMENT.md.'}, 503);
  }
}

export async function POST(request: Request) {
  if (!validOrigin(request)) return reply({error: 'Invalid request origin.'}, 403);
  try {
    if (Number(request.headers.get('content-length') || 0) > 600000) return reply({error: 'This request is too large.'}, 413);
    const payload = await request.text();
    if (payload.length > 600000) return reply({error: 'This request is too large.'}, 413);
    let raw: unknown;
    try { raw = JSON.parse(payload); } catch { throw new InputError('Invalid request.'); }
    const input = object(raw);
    const db = await createClient();
    const {data: {user}, error: authError} = await db.auth.getUser();
    if (authError || !user) return reply({error: 'Sign in to continue.'}, 401);
    const action = input.action;
    if (['save', 'settings', 'delete'].includes(String(action))) {
      const author = await db.rpc('is_author');
      if (author.error) throw author.error;
      if (!author.data) return reply({error: 'Only the author can edit this journal.'}, 403);
    }
    if (action === 'settings') {
      const incoming = object(input.data);
      const current = await db.from('settings').select('data').eq('id', 1).single();
      if (current.error) throw current.error;
      const config: Record<string, string> = {...defaults, ...current.data.data};
      for (const key of Object.keys(defaults)) if (incoming[key] !== undefined) config[key] = textField(incoming[key], key, 3000);
      for (const [key, label] of socialFields) {
        const url = socialUrl(config[key]);
        if (url === null) throw new InputError('Enter a valid website URL for ' + label);
        config[key] = url;
      }
      config.banner = imageUrl(config.banner); config.photo = imageUrl(config.photo);
      if (!themes.some(t => t[0] === config.theme)) throw new InputError('Choose an available theme.');
      const saved = await db.from('settings').update({data: config}).eq('id', 1);
      if (saved.error) throw saved.error;
    } else if (action === 'save') {
      const p = object(input.post);
      const id = p.id === undefined ? crypto.randomUUID() : textField(p.id, 'Post ID', 100, true);
      const title = textField(p.title, 'Title', 220, true);
      const body = textField(p.body, 'Writing', 120000, true);
      const category = textField(p.category, 'Section', 80, true);
      if (!categories.includes(category) || !['draft', 'published'].includes(String(p.status))) throw new InputError('Choose a valid section and status.');
      const date = p.date ? new Date(String(p.date)) : new Date();
      if (Number.isNaN(date.getTime())) throw new InputError('Use a valid publication date.');
      const existing = await db.from('posts').select('date').eq('id', id).maybeSingle();
      if (existing.error) throw existing.error;
      const saved = await db.from('posts').upsert({id, title, body, category,
        excerpt: textField(p.excerpt || body.slice(0, 150), 'Introduction', 3000),
        tags: textField(p.tags || '', 'Labels', 500), image: imageUrl(p.image || ''),
        date: existing.data?.date || date.toISOString(), status: p.status, sample: false,
      }, {onConflict: 'id'});
      if (saved.error) throw saved.error;
      return reply({ok: true, id});
    } else if (action === 'delete') {
      const id = textField(input.id, 'Post ID', 100, true);
      const result = await db.from('posts').update({status: 'deleted'}).eq('id', id);
      if (result.error) throw result.error;
    } else if (action === 'like' || action === 'comment') {
      const id = textField(input.id, 'Post ID', 100, true);
      const post = await db.from('posts').select('id').eq('id', id).eq('status', 'published').maybeSingle();
      if (post.error) throw post.error;
      if (!post.data) return reply({error: 'Post not found.'}, 404);
      if (action === 'like') {
        if (typeof input.liked !== 'boolean') throw new InputError('Invalid appreciation.');
        const result = input.liked
          ? await db.from('likes').upsert({post_id: id, user_id: user.id}, {onConflict: 'post_id,user_id', ignoreDuplicates: true})
          : await db.from('likes').delete().eq('post_id', id).eq('user_id', user.id);
        if (result.error) throw result.error;
      } else {
        const body = textField(input.body, 'Comment', 3000, true);
        const name = textField(input.name || 'Reader', 'Display name', 80, true);
        const result = await db.from('comments').insert({post_id: id, user_id: user.id, name, body});
        if (result.error) {
          if (result.error.code === 'P0001') return reply({error: 'Please wait 20 seconds before posting another thought.'}, 429);
          throw result.error;
        }
      }
    } else throw new InputError('Unknown action.');
    return reply({ok: true});
  } catch (error) {
    if (error instanceof InputError) return reply({error: error.message}, 400);
    console.error('Journal save failed', error);
    return reply({error: 'Could not save. Your writing is still here; please try again.'}, 503);
  }
}
