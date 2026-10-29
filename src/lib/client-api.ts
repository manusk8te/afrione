import { supabase } from './supabase'
export async function clientApi(url: string, options: RequestInit = {}) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Votre session a expiré. Reconnectez-vous à AfriOne.')
  const headers = new Headers(options.headers)
  headers.set('Authorization', `Bearer ${session.access_token}`)
  return fetch(url, { ...options, headers })
}
