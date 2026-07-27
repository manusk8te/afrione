/**
 * GET /api/admin/agent-runs?limit=30
 * Journal des exécutions de l'agent IA (table agent_runs) — admin uniquement.
 */
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.res

  const limit = Math.min(100, Math.max(1, parseInt(req.nextUrl.searchParams.get('limit') || '30')))

  const { data, error } = await supabaseAdmin
    .from('agent_runs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    // Table absente → guider vers la migration
    const hint = error.message.includes('agent_runs')
      ? 'Table agent_runs absente — exécutez database/agent_runs.sql dans Supabase SQL Editor.'
      : error.message
    return NextResponse.json({ error: hint }, { status: 500 })
  }

  return NextResponse.json({ runs: data || [] })
}
