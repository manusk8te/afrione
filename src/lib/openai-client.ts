const OPENAI_BASE = 'https://api.openai.com/v1'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface OpenAIOptions {
  model?:       string
  temperature?: number
  max_tokens?:  number
  json?:        boolean
}

// ── Client principal ─────────────────────────────────────────────────────────

export async function chatCompletion(
  messages: ChatMessage[],
  options: OpenAIOptions = {},
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    return mockCompletion(messages)
  }

  const res = await fetch(`${OPENAI_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      model:           options.model       ?? 'gpt-4o-mini',
      temperature:     options.temperature ?? 0.3,
      max_tokens:      options.max_tokens  ?? 600,
      messages,
      ...(options.json ? { response_format: { type: 'json_object' } } : {}),
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`OpenAI error ${res.status}: ${JSON.stringify(err)}`)
  }

  const data = await res.json()
  return data.choices[0].message.content as string
}

// ── Fallback mock sans clé API ────────────────────────────────────────────────

function mockCompletion(messages: ChatMessage[]): string {
  const last = messages[messages.length - 1]?.content?.toLowerCase() ?? ''

  if (last.includes('urgence') || last.includes('urgent')) {
    return JSON.stringify({
      prestation_code:    'PLOMB_ROBINET_FUITE',
      sensitivity:        'gênant',
      follow_up_question: 'Tu peux m\'envoyer une photo du problème ?',
      ready_to_quote:     false,
    })
  }

  if (last.includes('diagnostic_complete') || last.includes('brief')) {
    return JSON.stringify({
      diagnostic_complete: true,
      brief_summary: {
        category:                  'plomberie',
        problem_description:       'Intervention standard détectée',
        required_level:            'N2',
        estimated_duration_minutes: 60,
        price_range_low:           6000,
        price_range_high:          12000,
        complexity_notes:          'Diagnostic à affiner sur place',
      },
    })
  }

  return JSON.stringify({
    next_question:       'Depuis combien de temps as-tu ce problème ?',
    photo_request:       null,
    video_request:       null,
    diagnostic_complete: false,
    brief_summary:       null,
  })
}
