import {createClient} from '@/lib/supabase/server';
import {validOrigin} from '@/lib/request';

export async function POST(request: Request) {
  if (!validOrigin(request)) return Response.json({error: 'Invalid request origin.'}, {status: 403});
  try {
    const {error} = await (await createClient()).auth.signOut({scope: 'local'});
    if (error) throw error;
    return Response.json({ok: true}, {headers: {'Cache-Control': 'private, no-store'}});
  } catch {
    return Response.json({error: 'Could not sign out. Please try again.'}, {status: 503});
  }
}
