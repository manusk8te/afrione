import { NextRequest, NextResponse } from 'next/server'
import { chatCompletion } from '@/lib/openai-client'
import { PROMPT_MODE_STANDARD } from '@/lib/openai-prompts'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const { text, history = [] } = await req.json()

  if (!text) return NextResponse.json({ error: 'text requis' }, { status: 400 })

  const messages = [
    { role: 'system' as const, content: PROMPT_MODE_STANDARD },
    ...history,
    { role: 'user' as const, content: text },
  ]

  try {
    const raw = await chatCompletion(messages, { json: true, temperature: 0.3, max_tokens: 600 })
    const result = JSON.parse(raw)
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({
      next_question:       'Peux-tu me décrire ton problème en détail ?',
      photo_request:       null,
      video_request:       null,
      diagnostic_complete: false,
      brief_summary:       null,
    })
  }
}
