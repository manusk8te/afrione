import { NextRequest, NextResponse } from 'next/server'
import { sendPushToUser } from '@/lib/push'

export const dynamic = 'force-dynamic'


export async function POST(req: NextRequest) {
  try {
    const { user_id, title, body, url } = await req.json()
    if (!user_id) return NextResponse.json({ error: 'user_id requis' }, { status: 400 })

    const result = await sendPushToUser(user_id, { title, body, url })
    if (!result.sent) {
      return NextResponse.json({ ok: false, reason: result.reason }, { status: result.reason === 'no_subscription' ? 404 : 500 })
    }
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
