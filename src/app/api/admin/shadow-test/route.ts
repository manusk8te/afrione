import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// GET — retourne tous les cas de test + dernier résultat pour chacun
export async function GET() {
  const { data: cases } = await supabaseAdmin
    .from('pricing_test_cases')
    .select('*')
    .eq('active', true)
    .order('category')

  if (!cases?.length) return NextResponse.json([])

  // Récupère le dernier résultat pour chaque cas
  const caseIds = cases.map(c => c.id)
  const { data: results } = await supabaseAdmin
    .from('shadow_test_results')
    .select('*')
    .in('test_case_id', caseIds)
    .order('run_at', { ascending: false })

  type ResultRow = NonNullable<typeof results>[number]
  const byCase: Record<string, {
    last: ResultRow | null
    count: number
    within_count: number
  }> = {}

  for (const r of results || []) {
    if (!byCase[r.test_case_id]) {
      byCase[r.test_case_id] = { last: r, count: 0, within_count: 0 }
    }
    byCase[r.test_case_id].count++
    if (r.within_range) byCase[r.test_case_id].within_count++
  }

  const enriched = cases.map(c => ({
    ...c,
    last_result:   byCase[c.id]?.last  ?? null,
    run_count:     byCase[c.id]?.count ?? 0,
    within_count:  byCase[c.id]?.within_count ?? 0,
  }))

  return NextResponse.json(enriched)
}

// POST { action: 'run_all' | 'run_one', test_case_id? }
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { action, test_case_id } = body

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

  let cases: any[] = []

  if (action === 'run_one' && test_case_id) {
    const { data } = await supabaseAdmin
      .from('pricing_test_cases')
      .select('*')
      .eq('id', test_case_id)
      .single()
    if (data) cases = [data]
  } else {
    const { data } = await supabaseAdmin
      .from('pricing_test_cases')
      .select('*')
      .eq('active', true)
    cases = data || []
  }

  if (!cases.length) return NextResponse.json({ ok: false, error: 'Aucun cas trouvé' })

  const results = await Promise.all(
    cases.map(async (tc) => {
      try {
        const res = await fetch(`${baseUrl}/api/pricing-agent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            category:       tc.category,
            description:    tc.description,
            items_needed:   tc.items_needed,
            hours_estimate: tc.hours,
            quartier:       tc.quartier,
            urgency:        tc.urgency,
          }),
        })

        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const agentRaw = await res.json()
        const agentPrice = agentRaw.total || 0

        // within_range et deviation_pct sont des colonnes GENERATED → pas d'insert
        await supabaseAdmin.from('shadow_test_results').insert({
          test_case_id:    tc.id,
          agent_price:     agentPrice,
          agent_breakdown: agentRaw.breakdown || null,
          expected_min:    tc.expected_min,
          expected_max:    tc.expected_max,
          agent_raw:       agentRaw,
        })

        const withinRange = agentPrice >= tc.expected_min && agentPrice <= tc.expected_max
        return { id: tc.id, label: tc.label, agent_price: agentPrice, within_range: withinRange, ok: true }
      } catch (e) {
        return { id: tc.id, label: tc.label, ok: false, error: String(e) }
      }
    })
  )

  const ran      = results.filter(r => r.ok).length
  const inRange  = results.filter(r => r.ok && r.within_range).length

  return NextResponse.json({ ok: true, ran, in_range: inRange, results })
}
