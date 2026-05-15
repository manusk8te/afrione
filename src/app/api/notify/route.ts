import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'


export async function POST(req: NextRequest) {
  try {
    const { user_id, title, message, url } = await req.json()
    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${process.env.ONESIGNAL_REST_API_KEY}`,
      },
      body: JSON.stringify({
        app_id: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID,
        filters: [{ field: 'external_user_id', value: user_id }],
        headings: { fr: title, en: title },
        contents: { fr: message, en: message },
        url: url || 'https://afrione-sepia.vercel.app',
      }),
    })
    const data = await response.json()
    return NextResponse.json(data)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
