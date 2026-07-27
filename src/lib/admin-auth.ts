import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase'

/** Vérifie le Bearer token Supabase et exige le rôle admin. */
export async function requireAdmin(req: NextRequest): Promise<{ ok: true } | { ok: false; res: NextResponse }> {
  const token = (req.headers.get('authorization') || '').replace('Bearer ', '').trim()
  if (!token) return { ok: false, res: NextResponse.json({ error: 'Non authentifié' }, { status: 401 }) }

  const userClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
  const { data: { user } } = await userClient.auth.getUser(token)
  if (!user) return { ok: false, res: NextResponse.json({ error: 'Token invalide' }, { status: 401 }) }

  const { data: caller } = await supabaseAdmin
    .from('users').select('role').eq('id', user.id).single()
  if (caller?.role !== 'admin') {
    return { ok: false, res: NextResponse.json({ error: 'Réservé aux admins' }, { status: 403 }) }
  }
  return { ok: true }
}
