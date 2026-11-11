import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizeMetier } from '@/lib/metier'
import { scoreArtisan, urgentDistanceKm } from '@/lib/scoring'

const PAGE_SIZE = 200

type Profile = { name: string | null; avatar_url: string | null; quartier: string | null }
type MatchingCandidate = {
  id: string
  user_id: string
  metier: string
  rating_avg: number | null
  rating_count: number | null
  mission_count: number | null
  response_time_min: number | null
  years_experience: number | null
  specialties: string[] | null
  certifications: string[] | null
  portfolio: string[] | null
  users: Profile | Profile[] | null
  zone_gps?: { lat?: number; lng?: number } | null
}

export async function listMatchingArtisans(
  client: SupabaseClient,
  options: { category: string; quartier: string; clientId: string; isTest: boolean; mode: 'standard' | 'urgent'; useCoordinates?: boolean },
) {
  const category = normalizeMetier(options.category)
  if (!category) return []
  const trade = category.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const candidates: MatchingCandidate[] = []

  for (let offset = 0; ; offset += PAGE_SIZE) {
    const fields = 'id, user_id, metier, rating_avg, rating_count, mission_count, response_time_min, years_experience, specialties, certifications, portfolio, users!artisan_pros_user_id_fkey(name, avatar_url, quartier)'
    const { data, error } = await client.from('artisan_pros')
      .select(options.useCoordinates ? `${fields},zone_gps` as const : fields)
      .eq('matching_trade', trade)
      .eq('kyc_status', 'approved')
      .eq('is_available', true)
      .eq('is_test', options.isTest)
      .neq('user_id', options.clientId)
      .order('id')
      .range(offset, offset + PAGE_SIZE - 1)
      .returns<MatchingCandidate[]>()
    if (error) throw error
    if (!data?.length) break
    candidates.push(...data)
    if (data.length < PAGE_SIZE) break
  }

  return candidates.map(candidate => {
    const users = Array.isArray(candidate.users) ? candidate.users[0] : candidate.users
    const distance = options.mode === 'urgent'
      ? urgentDistanceKm(options.quartier, users?.quartier ?? '', candidate.zone_gps)
      : null
    return { ...candidate, _score: scoreArtisan({ ...candidate, users }, options.quartier, options.mode), distance }
  }).sort((a, b) => {
    if (options.mode === 'urgent' && (a.distance !== null || b.distance !== null)) {
      const nearer = (a.distance ?? Infinity) - (b.distance ?? Infinity)
      if (nearer) return nearer
    }
    return b._score - a._score || a.id.localeCompare(b.id)
  })
}
