import { supabase } from '@/integrations/supabase/client';

/**
 * Fetch wrapper that automatically attaches the current user's JWT
 * to edge function calls. Throws if user is not authenticated.
 */
export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('Nicht angemeldet – bitte zuerst einloggen.');
  }

  const headers = new Headers(options.headers);
  headers.set('Authorization', `Bearer ${session.access_token}`);

  return fetch(url, { ...options, headers });
}
