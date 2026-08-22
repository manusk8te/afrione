import { supabaseAdmin } from '@/lib/supabase'

/**
 * Mouvements d'escrow — libération vers l'artisan, remboursement vers le client.
 *
 * Ces deux fonctions déplacent de l'argent. Elles ne vérifiaient aucune de
 * leurs écritures : Supabase ne lève pas d'exception, il renvoie une erreur
 * dans l'objet retour. Un `update` de wallet qui échouait rendait la main comme
 * si tout allait bien, et l'appelant enchaînait sur « mission terminée ».
 *
 * Constaté le 2026-08-22, en base de production : 3 missions `completed` dont
 * la transaction était restée en `escrow` (21 364 FCFA jamais versés à
 * l'artisan) et 1 mission `cancelled` jamais remboursée (20 966 FCFA). Aucune
 * trace, aucune alerte — 42 330 FCFA immobilisés en silence.
 *
 * Les deux fonctions renvoient désormais un résultat explicite au lieu de
 * `void`. Un appelant qui l'ignore ne casse rien, mais celui qui le lit peut
 * refuser de clore une mission dont l'argent n'a pas bougé.
 */

export type ResultatEscrow =
  | { ok: true;  montant: number; sansTransaction?: true }
  | { ok: false; motif: string }

/** Journalise un échec de mouvement d'argent avec de quoi le retrouver. */
function echec(operation: string, missionId: string, motif: string): ResultatEscrow {
  console.error(`[escrow] ${operation} ÉCHOUÉ — mission=${missionId} : ${motif}`)
  return { ok: false, motif }
}

/**
 * Rembourse l'escrow vers le client (annulation, ou litige tranché en sa
 * faveur). Décrémente `balance_escrow` du wallet artisan et marque la
 * transaction `refunded`.
 *
 * Ne touche pas au statut de la mission — l'appelant s'en charge.
 */
export async function refundEscrow(
  mission_id: string,
  artisan_id: string | null,
): Promise<ResultatEscrow> {
  const { data: tx, error: eTx } = await supabaseAdmin
    .from('transactions')
    .select('id, artisan_amount')
    .eq('mission_id', mission_id)
    .eq('status', 'escrow')
    .maybeSingle()

  if (eTx) return echec('remboursement', mission_id, `lecture transaction : ${eTx.message}`)

  // Rien en escrow : la mission n'a jamais été payée, ou l'a déjà été remboursée.
  // Ce n'est pas une erreur — mais ce n'est pas non plus un mouvement.
  if (!tx) return { ok: true, montant: 0, sansTransaction: true }

  if (!artisan_id) {
    return echec('remboursement', mission_id, 'transaction en escrow mais aucun artisan attribué')
  }

  const montant = tx.artisan_amount || 0

  const { data: wallet, error: eLecture } = await supabaseAdmin
    .from('wallets')
    .select('id, balance_escrow')
    .eq('artisan_id', artisan_id)
    .maybeSingle()

  if (eLecture) return echec('remboursement', mission_id, `lecture wallet : ${eLecture.message}`)

  if (wallet) {
    const { error: eWallet } = await supabaseAdmin.from('wallets').update({
      balance_escrow: Math.max(0, (wallet.balance_escrow || 0) - montant),
      updated_at:     new Date().toISOString(),
    }).eq('artisan_id', artisan_id)

    // On s'arrête ici : marquer la transaction `refunded` alors que le wallet
    // retient encore les fonds rendrait l'incohérence invisible.
    if (eWallet) return echec('remboursement', mission_id, `écriture wallet : ${eWallet.message}`)
  }

  const { error: eStatut } = await supabaseAdmin.from('transactions').update({
    status: 'refunded', released_at: new Date().toISOString(),
  }).eq('id', tx.id)

  if (eStatut) return echec('remboursement', mission_id, `statut transaction : ${eStatut.message}`)

  return { ok: true, montant }
}

/**
 * Libère l'escrow vers l'artisan (validation client, ou auto-validation à 24h).
 * Bascule `balance_escrow` → `balance_available`, marque la transaction
 * `released`, puis passe la mission à `completed`.
 *
 * La mission n'est marquée terminée QUE si l'argent a bougé : c'est ce qui
 * manquait, et qui a produit 3 missions « terminées » dont l'artisan n'a
 * jamais rien reçu.
 */
export async function releaseEscrow(
  mission_id: string,
  artisan_id: string | null,
): Promise<ResultatEscrow> {
  const { data: tx, error: eTx } = await supabaseAdmin
    .from('transactions')
    .select('id, artisan_amount')
    .eq('mission_id', mission_id)
    .eq('status', 'escrow')
    .maybeSingle()

  if (eTx) return echec('libération', mission_id, `lecture transaction : ${eTx.message}`)

  const montant = tx?.artisan_amount || 0

  if (montant > 0 && artisan_id) {
    const { data: wallet, error: eLecture } = await supabaseAdmin
      .from('wallets')
      .select('id, balance_escrow, balance_available, total_earned')
      .eq('artisan_id', artisan_id)
      .maybeSingle()

    if (eLecture) return echec('libération', mission_id, `lecture wallet : ${eLecture.message}`)

    if (!wallet) {
      return echec('libération', mission_id, `aucun wallet pour l'artisan ${artisan_id}`)
    }

    const { error: eWallet } = await supabaseAdmin.from('wallets').update({
      balance_escrow:    Math.max(0, (wallet.balance_escrow || 0) - montant),
      balance_available: (wallet.balance_available || 0) + montant,
      total_earned:      (wallet.total_earned || 0) + montant,
      updated_at:        new Date().toISOString(),
    }).eq('artisan_id', artisan_id)

    if (eWallet) return echec('libération', mission_id, `écriture wallet : ${eWallet.message}`)

    const { error: eStatut } = await supabaseAdmin.from('transactions').update({
      status: 'released', released_at: new Date().toISOString(),
    }).eq('id', tx!.id)

    // Le wallet est crédité mais la transaction reste 'escrow' : on refuse de
    // clore la mission, sinon l'incohérence devient indétectable.
    if (eStatut) return echec('libération', mission_id, `statut transaction : ${eStatut.message}`)
  }

  const { error: eMission } = await supabaseAdmin.from('missions').update({
    status:     'completed',
    updated_at: new Date().toISOString(),
  }).eq('id', mission_id)

  if (eMission) return echec('libération', mission_id, `statut mission : ${eMission.message}`)

  return { ok: true, montant, ...(tx ? {} : { sansTransaction: true as const }) }
}
