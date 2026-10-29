import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { resolveMissionViewer, authorize } from '@/lib/mission-auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const resolved = await resolveMissionViewer(req, req.nextUrl.searchParams.get('mission_id'))
  if (!resolved.ok) return resolved.res
  const { data, error } = await supabaseAdmin.from('chat_history')
    .select('*, users(name, avatar_url)').eq('mission_id', resolved.viewer.mission.id)
    .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(500)
  if (error) return NextResponse.json({ error: 'Conversation indisponible. Réessayez.' }, { status: 503 })
  return NextResponse.json({ messages: (data || []).reverse() }, { headers: { 'Cache-Control': 'private, no-store' } })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body || typeof body.text !== 'string' || !body.text.trim() || body.text.length > 4000) {
    return NextResponse.json({ error: 'Le message doit contenir entre 1 et 4 000 caractères.' }, { status: 400 })
  }
  const resolved = await resolveMissionViewer(req, body.mission_id)
  if (!resolved.ok) return resolved.res
  const { viewer } = resolved
  const denied = authorize(viewer, 'send_message')
  if (denied) return denied
  const { data: agreement, error: agreementError } = await supabaseAdmin.from('discussion_agreements').select('discussion').eq('mission_id', viewer.mission.id).maybeSingle()
  if (agreementError) return NextResponse.json({ error: 'Accord indisponible.' }, { status: 503 })
  if (agreement?.discussion === false) return NextResponse.json({ error: 'Discussion libre désactivée. Utilisez les devis et rectificatifs.' }, { status: 409 })
  const text = body.text.trim()
  const { data: recent, error: readError } = await supabaseAdmin.from('chat_history').select('id, text, created_at')
    .eq('mission_id', viewer.mission.id).eq('sender_id', viewer.userId).eq('type', 'text')
    .gte('created_at', new Date(Date.now() - 60000).toISOString()).order('created_at', { ascending: false }).limit(20)
  if (readError) return NextResponse.json({ error: 'Envoi momentanément indisponible.' }, { status: 503 })
  if ((recent || []).some(m => m.text === text)) {
    const duplicate = recent!.find(m => m.text === text)!
    return NextResponse.json({ message: { ...duplicate, mission_id: viewer.mission.id, sender_id: viewer.userId, sender_role: viewer.role, type: 'text' } })
  }
  if ((recent?.length || 0) >= 12 || (recent?.[0] && Date.now() - Date.parse(recent[0].created_at) < 1500)) {
    return NextResponse.json({ error: 'Trop de messages rapprochés. Patientez quelques secondes.' }, { status: 429 })
  }
  const { data, error } = await supabaseAdmin.from('chat_history').insert({
    mission_id: viewer.mission.id, sender_id: viewer.userId, sender_role: viewer.role,
    sender_type: viewer.role, text, type: 'text',
  }).select().single()
  if (error) return NextResponse.json({ error: 'Message non envoyé. Vous pouvez réessayer.' }, { status: 503 })
  return NextResponse.json({ message: data })
}
