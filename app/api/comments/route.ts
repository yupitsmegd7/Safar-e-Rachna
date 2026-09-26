import {createClient} from '@/lib/supabase/server';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const headers = {'Cache-Control': 'private, no-store'};
  try {
    const id = new URL(request.url).searchParams.get('id');
    if (!id || id.length > 100) return Response.json({error: 'Post not found.'}, {status: 400, headers});
    const db = await createClient();
    const {data, error} = await db.from('comments').select('id,name,body,date').eq('post_id', id).order('date', {ascending: false}).limit(100);
    if (error) throw error;
    return Response.json(data, {headers});
  } catch {
    return Response.json({error: 'Comments unavailable.'}, {status: 503, headers});
  }
}
