import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

// Server-side Supabase client that can read the auth cookie
function serverSupabase(req: NextRequest) {
  const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const authHeader   = req.headers.get('authorization') || ''
  const token        = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  return createClient(supabaseUrl, supabaseAnon, {
    global: { headers: token ? { Authorization: `Bearer ${token}` } : {} },
    auth:   { persistSession: false, autoRefreshToken: false },
  })
}

// Admin client (bypasses RLS for server-side writes)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ─── GET  /api/artisan-questionnaire ────────────────────────────────────────
// Returns the current artisan's questionnaire submission (or null)
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization') || ''
  const token      = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''

  if (!token) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  // Verify token and get user
  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token)
  if (authErr || !user) {
    return NextResponse.json({ error: 'Token invalide' }, { status: 401 })
  }

  // Get artisan record
  const { data: artisan, error: artErr } = await supabaseAdmin
    .from('artisan_pros')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (artErr || !artisan) {
    return NextResponse.json({ error: 'Profil artisan introuvable' }, { status: 404 })
  }

  // Get questionnaire submission
  const { data, error } = await supabaseAdmin
    .from('artisan_questionnaire_submissions')
    .select('*')
    .eq('artisan_id', artisan.id)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data || null)
}

// ─── POST /api/artisan-questionnaire ────────────────────────────────────────
// Upsert the artisan's questionnaire submission
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization') || ''
  const token      = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''

  if (!token) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token)
  if (authErr || !user) {
    return NextResponse.json({ error: 'Token invalide' }, { status: 401 })
  }

  // Get artisan record
  const { data: artisan, error: artErr } = await supabaseAdmin
    .from('artisan_pros')
    .select('id, metier')
    .eq('user_id', user.id)
    .maybeSingle()

  if (artErr || !artisan) {
    return NextResponse.json({ error: 'Profil artisan introuvable' }, { status: 404 })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 })
  }

  const {
    experience_years,
    has_id_card,
    has_training_cert,
    zones_travail,
    intervention_types,
    transport_moyen,
    daily_hours,
    daily_earnings,
    hourly_rate_declared,
    materials_used,
    has_own_tools,
    tools_description,
  } = body

  // Upsert (artisan_id is unique)
  const { data, error } = await supabaseAdmin
    .from('artisan_questionnaire_submissions')
    .upsert(
      {
        artisan_id: artisan.id,
        status: 'pending',
        submitted_at: new Date().toISOString(),
        experience_years:    experience_years    ?? null,
        has_id_card:         has_id_card         ?? false,
        has_training_cert:   has_training_cert   ?? false,
        zones_travail:       zones_travail        ?? [],
        intervention_types:  intervention_types  ?? [],
        transport_moyen:     transport_moyen      ?? null,
        daily_hours:         daily_hours          ?? null,
        daily_earnings:      daily_earnings       ?? null,
        hourly_rate_declared: hourly_rate_declared ?? null,
        materials_used:      materials_used       ?? [],
        has_own_tools:       has_own_tools        ?? true,
        tools_description:   tools_description    ?? null,
      },
      { onConflict: 'artisan_id' }
    )
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, submission: data })
}
