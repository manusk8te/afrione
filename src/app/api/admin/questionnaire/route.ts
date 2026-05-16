import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// ─── GET /api/admin/questionnaire ──────────────────────────────────────────
// List all questionnaire submissions with artisan + user info
export async function GET(req: NextRequest) {
  const statusFilter = req.nextUrl.searchParams.get('status') // 'pending' | 'approved' | 'rejected' | null

  let query = supabaseAdmin
    .from('artisan_questionnaire_submissions')
    .select(`
      *,
      artisan_pros (
        id,
        metier,
        tarif_min,
        years_experience,
        users!artisan_pros_user_id_fkey (
          id,
          name,
          email,
          phone,
          avatar_url
        )
      )
    `)
    .order('submitted_at', { ascending: false })

  if (statusFilter && ['pending', 'approved', 'rejected'].includes(statusFilter)) {
    query = query.eq('status', statusFilter)
  }

  const { data, error } = await query
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data || [])
}

// ─── POST /api/admin/questionnaire ─────────────────────────────────────────
// action: 'approve' | 'reject'
export async function POST(req: NextRequest) {
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 })
  }

  const { action, submissionId, adminEmail, adminNotes } = body

  if (!submissionId || !action) {
    return NextResponse.json({ error: 'submissionId et action requis' }, { status: 400 })
  }

  // Fetch the submission with artisan info
  const { data: sub, error: subErr } = await supabaseAdmin
    .from('artisan_questionnaire_submissions')
    .select('*, artisan_pros(id, metier, tarif_min, years_experience)')
    .eq('id', submissionId)
    .single()

  if (subErr || !sub) {
    return NextResponse.json({ error: 'Soumission introuvable' }, { status: 404 })
  }

  const artisan = sub.artisan_pros as any

  // ── APPROVE ──────────────────────────────────────────────────────────────
  if (action === 'approve') {
    // 1. Update submission status
    const { error: updateErr } = await supabaseAdmin
      .from('artisan_questionnaire_submissions')
      .update({
        status:      'approved',
        reviewed_at: new Date().toISOString(),
        reviewed_by: adminEmail || 'admin',
        admin_notes: adminNotes || null,
      })
      .eq('id', submissionId)

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    // 2. Update artisan_pros.tarif_min and years_experience
    if (artisan?.id) {
      const artisanUpdates: Record<string, any> = {}
      if (sub.hourly_rate_declared) {
        artisanUpdates.tarif_min = sub.hourly_rate_declared
      }
      if (sub.experience_years) {
        artisanUpdates.years_experience = sub.experience_years
      }
      if (Object.keys(artisanUpdates).length > 0) {
        await supabaseAdmin
          .from('artisan_pros')
          .update(artisanUpdates)
          .eq('id', artisan.id)
      }
    }

    // 3. Upsert into labor_rates
    if (artisan?.metier && sub.hourly_rate_declared) {
      await supabaseAdmin
        .from('labor_rates')
        .upsert(
          { metier: artisan.metier, tarif_horaire: sub.hourly_rate_declared },
          { onConflict: 'metier' }
        )
    }

    // 4. Upsert each material into price_materials
    const materials: any[] = Array.isArray(sub.materials_used) ? sub.materials_used : []
    for (const mat of materials) {
      if (!mat.name || !mat.price_fcfa) continue
      await supabaseAdmin
        .from('price_materials')
        .upsert(
          {
            name:         mat.name,
            category:     mat.category  || 'Divers',
            price_market: mat.price_fcfa,
            unit:         mat.unit       || 'pièce',
            source:       'Artisan AfriOne',
          },
          { onConflict: 'name' }
        )
    }

    return NextResponse.json({ ok: true, action: 'approved' })
  }

  // ── REJECT ───────────────────────────────────────────────────────────────
  if (action === 'reject') {
    const { error: rejectErr } = await supabaseAdmin
      .from('artisan_questionnaire_submissions')
      .update({
        status:      'rejected',
        reviewed_at: new Date().toISOString(),
        reviewed_by: adminEmail || 'admin',
        admin_notes: adminNotes || null,
      })
      .eq('id', submissionId)

    if (rejectErr) {
      return NextResponse.json({ error: rejectErr.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, action: 'rejected' })
  }

  return NextResponse.json({ error: 'Action invalide' }, { status: 400 })
}
