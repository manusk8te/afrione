import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { jekoRequest, jekoSettings, reconcileJekoPayment } from '@/lib/jeko-checkout'
import { findAllCandidates } from '@/lib/dispatch'
import { resolveMissionViewer } from '@/lib/mission-auth'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const input = z.object({ mission_id: z.string().uuid(), quote_revision: z.string().regex(/^[a-f0-9]{32}$/), urgent: z.boolean().optional() })
const reply = (error: string, status: number) => NextResponse.json({ error }, { status })

export async function POST(req: NextRequest) {
  const parsed = input.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return reply('Devis ou mission invalide.', 400)
  const settings = jekoSettings()
  if (!settings) return reply('Le paiement Jèko est temporairement indisponible.', 503)

  const { mission_id, quote_revision, urgent } = parsed.data
  const access = await resolveMissionViewer(req, mission_id)
  if (!access.ok) return access.res
  if (access.viewer.mission.client_id !== access.viewer.userId) return reply('Accès réservé au client.', 403)

  if (urgent && ['diagnostic', 'matching'].includes(access.viewer.mission.status)) {
    try {
      if (!(await findAllCandidates(mission_id)).length) {
        return reply('Aucun artisan disponible en Urgent pour ce métier. Essayez le mode Standard.', 409)
      }
    } catch {
      return reply('La disponibilité des artisans est momentanément impossible à vérifier.', 503)
    }
  }

  const { data: checkout, error } = await supabaseAdmin.rpc('reserve_jeko_link', {
    mid: mission_id, actor: access.viewer.userId, store: settings.storeId, revision: quote_revision, urgent: urgent === true,
  })
  if (error || !checkout) {
    if (/mission_not_payable|quote_changed/.test(error?.message ?? '')) {
      return reply('Vérifiez et confirmez le devis avant de payer.', 409)
    }
    return reply('Le paiement est temporairement indisponible.', 503)
  }

  const returnPath = `/payment/jeko?mission=${mission_id}&checkout=${checkout.id}`
  if (!checkout.created) {
    return NextResponse.json({ url: returnPath })
  }

  try {
    const response = await jekoRequest('/payment_links', settings, {
      storeId: checkout.store_id,
      title: 'AfriOne · Paiement de votre intervention',
      amountCents: checkout.amount * 100,
      currency: 'XOF',
      allowMultiplePayments: false,
    })
    if (!response.ok) {
      if ([400, 401, 403, 404, 422].includes(response.status)) {
        await supabaseAdmin.from('jeko_checkouts').update({ status: 'error' }).eq('id', checkout.id).eq('status', 'creating')
      }
      return reply('Impossible d’ouvrir le paiement Jèko. Réessayez ou consultez le suivi.', 502)
    }

    const payment = await response.json()
    const redirect = new URL(payment.link)
    if (redirect.origin !== 'https://pay.jeko.africa' || !z.string().uuid().safeParse(payment.id).success ||
        redirect.pathname !== `/pl/${payment.id}` || payment.storeId !== checkout.store_id ||
        payment.amount?.amount !== checkout.amount * 100 || payment.amount?.currency !== 'XOF' ||
        payment.allowMultiplePayments !== false || payment.canReceivePayments !== true) {
      throw new Error('Réponse Jèko invalide')
    }
    const { error: saveError } = await supabaseAdmin.from('jeko_checkouts')
      .update({ status: 'pending', payment_link_id: payment.id, redirect_url: redirect.href })
      .eq('id', checkout.id).eq('status', 'creating')
    if (saveError) throw saveError
    return NextResponse.json({ url: `${returnPath}&open=1` })
  } catch {
    return reply('Création du paiement à vérifier. Revenez au suivi de la mission.', 502)
  }
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('checkout')
  const mission = req.nextUrl.searchParams.get('mission')
  if (!z.string().uuid().safeParse(id).success || !z.string().uuid().safeParse(mission).success) {
    return reply('Référence de paiement invalide.', 400)
  }

  const access = await resolveMissionViewer(req, mission)
  if (!access.ok) return access.res
  if (access.viewer.mission.client_id !== access.viewer.userId) return reply('Accès réservé au client.', 403)
  const { data: checkout, error } = await supabaseAdmin.from('jeko_checkouts')
    .select('id,store_id,amount,status,request_id,redirect_url,urgent_before_matching').eq('id', id).eq('mission_id', mission).maybeSingle()
  if (error) return reply('Suivi du paiement indisponible.', 503)
  if (!checkout) return reply('Paiement introuvable.', 404)

  let status = checkout.status
  const settings = jekoSettings()
  if (status === 'pending' && settings && checkout.request_id) {
    try {
      const response = await jekoRequest(`/payment_requests/${encodeURIComponent(checkout.request_id)}`, settings)
      if (response.ok) {
        status = await reconcileJekoPayment(checkout, await response.json())
      }
    } catch {
      return reply('La confirmation du paiement est momentanément indisponible.', 503)
    }
  }
  return NextResponse.json({ status, amount: checkout.amount, urgent: checkout.urgent_before_matching, url: status === 'pending' ? checkout.redirect_url : null }, { headers: { 'Cache-Control': 'no-store' } })
}
