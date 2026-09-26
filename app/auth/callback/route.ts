import {NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase/server';
import {safeReturnPath} from '@/lib/request';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = safeReturnPath(url.searchParams.get('next'));
  const code = url.searchParams.get('code');
  if (code) {
    try {
      const {error} = await (await createClient()).auth.exchangeCodeForSession(code);
      if (!error) return NextResponse.redirect(new URL(next, url.origin));
    } catch { /* Return a recoverable sign-in error without exposing credentials. */ }
  }
  const login = new URL('/login', url.origin);
  login.searchParams.set('error', 'callback');
  login.searchParams.set('next', next);
  return NextResponse.redirect(login);
}
