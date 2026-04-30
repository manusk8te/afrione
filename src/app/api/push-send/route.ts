import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import webpush from 'web-push'

webpush.setVapidDetails(
  'mailto:contact@afrione.ci',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { user_id, title, body, url } = await req.json()
    const { data } = await supabaseAdmin
      .from('push_subscriptions')
      .select('subscription')
      .eq('user_id', user_id)
      .single()

    if (!data) return NextResponse.json({ error: 'No subscription' }, { status: 404 })

    await webpush.sendNotification(
      data.subscription,
      JSON.stringify({ title, body, url })
    )
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
