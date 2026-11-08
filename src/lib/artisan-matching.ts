import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizeMetier } from '@/lib/metier'
import { scoreArtisan } from '@/lib/scoring'

const PAGE_SIZE = 200

export async function listMatchingArtisans(
  client: SupabaseClient,
  options: { category: string; quartier: string; clientId: string; isTest: boolean; mode: 'standard' | 'urgent' },
) {
  const category = normalizeMetier(options.category)
  if (!category) return []
  const trade = category.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const candidates = []

  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await client.from('artisan_pros')
      .select('id, user_id, metier, rating_avg, rating_count, mission_count, response_time_min, years_experience, specialties, certifications, portfolio, users!artisan_pros_user_id_fkey(name, avatar_url, quartier)')
      .eq('matching_trade', trade)
      .eq('kyc_status', 'approved')
      .eq('is_available', true)
      .eq('is_test', options.isTest)
      .neq('user_id', options.clientId)
      .order('id')
      .range(offset, offset + PAGE_SIZE - 1)
    if (error) throw error
    if (!data?.length) break
    candidates.push(...data)
    if (data.length < PAGE_SIZE) break
  }

  return candidates.map(candidate => ({
    ...candidate,
    _score: scoreArtisan({
      ...candidate,
      users: Array.isArray(candidate.users) ? candidate.users[0] : candidate.users,
    }, options.quartier, options.mode),
  })).sort((a, b) => b._score - a._score || a.id.localeCompare(b.id))
}
