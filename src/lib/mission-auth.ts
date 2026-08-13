/**
 * Résolution serveur du couple (utilisateur, rôle dans la mission).
 *
 * Toute route API qui touche à une mission passe par ici. Le navigateur ne
 * transmet jamais son rôle : il transmet un Bearer token, et le serveur
 * décide. C'est la seule façon d'avoir une autorisation qui tient — masquer
 * un bouton n'est pas une sécurité.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase'
import {
  resolveMissionRole, can, denialReason,
  type MissionRole, type MissionAction, type MissionStatus,
} from '@/lib/mission-roles'

export interface MissionViewer {
  userId: string
  role: MissionRole
  mission: {
    id: string
    client_id: string | null
    artisan_id: string | null
    artisan_user_id: string | null
    status: MissionStatus
    mode: string | null
  }
}

type ViewerResult =
  | { ok: true; viewer: MissionViewer }
  | { ok: false; res: NextResponse }

function bearer(req: NextRequest): string {
  return (req.headers.get('authorization') || '').replace('Bearer ', '').trim()
}

/** Identité vérifiée auprès de Supabase, à partir du token de la requête. */
export async function authenticate(req: NextRequest): Promise<{ userId: string } | null> {
  const token = bearer(req)
  if (!token) return null
  const userClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
  const { data: { user } } = await userClient.auth.getUser(token)
  return user ? { userId: user.id } : null
}

/**
 * Charge la mission hors RLS et calcule le rôle du porteur du token.
 *
 * `allowGuest: true` sert aux lectures publiques éventuelles ; par défaut un
 * non-participant reçoit 403 et rien d'autre — la route ne doit surtout pas
 * composer sa réponse avant ce contrôle.
 */
export async function resolveMissionViewer(
  req: NextRequest,
  missionId: string | null | undefined,
  opts: { allowGuest?: boolean } = {},
): Promise<ViewerResult> {
  if (!missionId) {
    return { ok: false, res: NextResponse.json({ error: 'mission_id requis' }, { status: 400 }) }
  }

  const auth = await authenticate(req)
  if (!auth) {
    return { ok: false, res: NextResponse.json({ error: 'Non authentifié' }, { status: 401 }) }
  }

  const { data: mission } = await supabaseAdmin
    .from('missions')
    .select('id, client_id, artisan_id, status, mode, artisan_pros(user_id)')
    .eq('id', missionId)
    .maybeSingle()

  if (!mission) {
    return { ok: false, res: NextResponse.json({ error: 'Mission introuvable' }, { status: 404 }) }
  }

  const { data: profil } = await supabaseAdmin
    .from('users').select('role').eq('id', auth.userId).maybeSingle()

  const artisanUserId = (mission.artisan_pros as any)?.user_id ?? null
  const role = resolveMissionRole({
    userId:        auth.userId,
    globalRole:    profil?.role,
    clientId:      mission.client_id,
    artisanUserId,
  })

  if (role === 'guest' && !opts.allowGuest) {
    return {
      ok: false,
      res: NextResponse.json({ error: "Vous n'êtes pas partie prenante de cette mission." }, { status: 403 }),
    }
  }

  return {
    ok: true,
    viewer: {
      userId: auth.userId,
      role,
      mission: {
        id:              mission.id,
        client_id:       mission.client_id,
        artisan_id:      mission.artisan_id,
        artisan_user_id: artisanUserId,
        status:          mission.status as MissionStatus,
        mode:            mission.mode ?? null,
      },
    },
  }
}

/**
 * Garde d'action : le rôle résolu a-t-il le droit de faire ceci, maintenant ?
 * Renvoie la réponse 403 prête à l'emploi, avec un motif lisible plutôt qu'un
 * « Non autorisé » qui n'apprend rien à celui qui débogue.
 */
export function authorize(viewer: MissionViewer, action: MissionAction): NextResponse | null {
  const ctx = { role: viewer.role, status: viewer.mission.status }
  if (can(action, ctx)) return null
  return NextResponse.json(
    { error: denialReason(action, ctx) ?? 'Action non autorisée', action, role: viewer.role, status: viewer.mission.status },
    { status: 403 },
  )
}
