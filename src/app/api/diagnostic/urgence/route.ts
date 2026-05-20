import { NextRequest, NextResponse } from 'next/server'
import { chatCompletion } from '@/lib/openai-client'
import { PROMPT_MODE_URGENCE } from '@/lib/openai-prompts'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const { text, history = [] } = await req.json()

  if (!text) return NextResponse.json({ error: 'text requis' }, { status: 400 })

  const messages = [
    { role: 'system' as const, content: PROMPT_MODE_URGENCE },
    ...history,
    { role: 'user' as const, content: text },
  ]

  try {
    const raw = await chatCompletion(messages, { json: true, temperature: 0.2, max_tokens: 300 })
    const result = JSON.parse(raw)
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({
      prestation_code:    null,
      sensitivity:        'normal',
      follow_up_question: 'Peux-tu me décrire le problème en quelques mots ?',
      ready_to_quote:     false,
    })
  }
}
