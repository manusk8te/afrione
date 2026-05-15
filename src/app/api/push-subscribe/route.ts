import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'


export async function POST(req: NextRequest) {
  try {
    const { user_id, subscription } = await req.json()
    await supabaseAdmin.from('push_subscriptions')
      .upsert({ user_id, subscription }, { onConflict: 'user_id' })
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
