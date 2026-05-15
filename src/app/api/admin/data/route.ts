import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// GET /api/admin/data?type=kyc|artisans|missions|transactions
export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get('type')

  if (type === 'kyc' || type === 'artisans') {
    const { data, error } = await supabaseAdmin
      .from('artisan_pros')
      .select('id, metier, kyc_status, created_at, is_available, users!artisan_pros_user_id_fkey(name, email, avatar_url), kyc_security(id, cni_front_url, cni_back_url, diploma_urls, status, reviewed_at)')
      .order('created_at', { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  if (type === 'missions') {
    const { data, error } = await supabaseAdmin
      .from('missions')
      .select('*, users!missions_client_id_fkey(name), artisan_pros(id, metier, users!artisan_pros_user_id_fkey(name))')
      .order('created_at', { ascending: false })
      .limit(20)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  if (type === 'transactions') {
    const { data, error } = await supabaseAdmin
      .from('transactions')
      .select('id, amount, platform_fee, artisan_amount, status, payment_method, wave_transaction_id, created_at, released_at, mission_id, missions(id, category, quartier, client_id, users!missions_client_id_fkey(name, email))')
      .order('created_at', { ascending: false })
      .limit(50)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data || [])
  }

  if (type === 'users') {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('id, name, email, phone, role, is_active, created_at, avatar_url, artisan_pros(id, metier, kyc_status)')
      .order('created_at', { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data || [])
  }

  if (type === 'stats') {
    const [{ count: missionCount }, { count: artisanCount }, { data: txData }, { count: litigeCount }] = await Promise.all([
      supabaseAdmin.from('missions').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('artisan_pros').select('*', { count: 'exact', head: true }).eq('kyc_status', 'approved'),
      supabaseAdmin.from('transactions').select('amount').eq('status', 'released'),
      supabaseAdmin.from('missions').select('*', { count: 'exact', head: true }).eq('status', 'disputed'),
    ])
    const revenue = (txData || []).reduce((s: number, t: any) => s + (t.amount || 0), 0)
    return NextResponse.json({ missions: missionCount, artisans: artisanCount, revenue, litiges: litigeCount })
  }

  if (type === 'prices') {
    const { data, error } = await supabaseAdmin
      .from('price_materials')
      .select('*')
      .order('category').order('tier').order('name')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  if (type === 'litiges') {
    const { data, error } = await supabaseAdmin
      .from('missions')
      .select('*, users!missions_client_id_fkey(name, avatar_url), artisan_pros(id, metier, users!artisan_pros_user_id_fkey(name))')
      .eq('status', 'disputed')
      .order('updated_at', { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  if (type === 'entreprises') {
    const { data, error } = await supabaseAdmin
      .from('entreprises')
      .select('*, users!entreprises_owner_id_fkey(name, email, avatar_url), artisan_pros(id, metier, kyc_status, users!artisan_pros_user_id_fkey(name, avatar_url))')
      .order('created_at', { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data || [])
  }

  return NextResponse.json({ error: 'type requis: kyc | artisans | missions | transactions | stats | litiges | entreprises' }, { status: 400 })
}

// POST /api/admin/data  { action, artisanId, kycId?, favor? }
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { action, artisanId, kycId, missionId, favor, adminId } = body

  if (action === 'approve_kyc') {
    if (kycId) await supabaseAdmin.from('kyc_security').update({ status: 'approved', reviewed_at: new Date().toISOString() }).eq('id', kycId)
    await supabaseAdmin.from('artisan_pros').update({ kyc_status: 'approved', is_available: true }).eq('id', artisanId)
    return NextResponse.json({ ok: true })
  }

  if (action === 'reject_kyc') {
    if (kycId) await supabaseAdmin.from('kyc_security').update({ status: 'rejected', reviewed_at: new Date().toISOString() }).eq('id', kycId)
    await supabaseAdmin.from('artisan_pros').update({ kyc_status: 'rejected', is_available: false }).eq('id', artisanId)
    return NextResponse.json({ ok: true })
  }

  if (action === 'revoke_kyc') {
    await supabaseAdmin.from('artisan_pros').update({ kyc_status: 'pending', is_available: false }).eq('id', artisanId)
    return NextResponse.json({ ok: true })
  }

  if (action === 'update_price') {
    const { id, price_market, price_min, price_max } = body
    const { error } = await supabaseAdmin
      .from('price_materials')
      .update({ price_market, price_min, price_max })
      .eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (action === 'approve_entreprise') {
    const { entrepriseId } = body
    await supabaseAdmin.from('entreprises').update({ kyc_status: 'approved', is_active: true }).eq('id', entrepriseId)
    return NextResponse.json({ ok: true })
  }

  if (action === 'reject_entreprise') {
    const { entrepriseId } = body
    await supabaseAdmin.from('entreprises').update({ kyc_status: 'rejected', is_active: false }).eq('id', entrepriseId)
    return NextResponse.json({ ok: true })
  }

  if (action === 'set_role') {
    const { userId, role } = body
    if (!['client', 'artisan', 'admin', 'entreprise_admin'].includes(role)) {
      return NextResponse.json({ error: 'role invalide' }, { status: 400 })
    }
    const { error } = await supabaseAdmin.from('users').update({ role }).eq('id', userId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (action === 'toggle_artisan') {
    const { data: current } = await supabaseAdmin.from('artisan_pros').select('is_available').eq('id', artisanId).single()
    await supabaseAdmin.from('artisan_pros').update({ is_available: !current?.is_available }).eq('id', artisanId)
    return NextResponse.json({ ok: true })
  }

  if (action === 'revert_litige') {
    await supabaseAdmin.from('missions').update({ status: 'en_cours' }).eq('id', missionId)
    await supabaseAdmin.from('chat_history').insert({ mission_id: missionId, sender_id: adminId, sender_role: 'admin', text: "⚖️ L'administrateur AfriOne a examiné le litige et décidé de poursuivre la mission. Le litige est clôturé.", type: 'system' })
    return NextResponse.json({ ok: true })
  }

  if (action === 'close_litige') {
    await supabaseAdmin.from('missions').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', missionId)
    const msg = favor === 'client'
      ? "⚖️ Litige résolu par l'admin — décision en faveur du client. Remboursement en cours."
      : "⚖️ Litige résolu par l'admin — décision en faveur de l'artisan. Paiement validé."
    await supabaseAdmin.from('chat_history').insert({ mission_id: missionId, sender_id: adminId, sender_role: 'admin', text: msg, type: 'system' })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'action inconnue' }, { status: 400 })
}
