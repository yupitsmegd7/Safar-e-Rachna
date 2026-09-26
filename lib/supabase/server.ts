import 'server-only';
import {createServerClient} from '@supabase/ssr';
import {cookies} from 'next/headers';
import {supabaseConfig} from './config';

export async function createClient() {
  const {url, key} = supabaseConfig();
  const jar = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll(items) {
        try { items.forEach(({name, value, options}) => jar.set(name, value, options)); }
        catch { /* Server Components cannot write cookies; proxy.ts refreshes them. */ }
      },
    },
  });
}
