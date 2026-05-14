import { supabaseAdmin } from '@/lib/supabase'

export async function releaseEscrow(mission_id: string, artisan_id: string | null) {
  const { data: tx } = await supabaseAdmin
    .from('transactions')
    .select('id, artisan_amount')
    .eq('mission_id', mission_id)
    .eq('status', 'escrow')
    .maybeSingle()

  const artisanAmount = tx?.artisan_amount || 0

  if (artisanAmount > 0 && artisan_id) {
    const { data: wallet } = await supabaseAdmin
      .from('wallets')
      .select('id, balance_escrow, balance_available, total_earned')
      .eq('artisan_id', artisan_id)
      .maybeSingle()

    if (wallet) {
      await supabaseAdmin.from('wallets').update({
        balance_escrow:    Math.max(0, (wallet.balance_escrow || 0) - artisanAmount),
        balance_available: (wallet.balance_available || 0) + artisanAmount,
        total_earned:      (wallet.total_earned || 0) + artisanAmount,
        updated_at:        new Date().toISOString(),
      }).eq('artisan_id', artisan_id)
    }

    if (tx) {
      await supabaseAdmin.from('transactions').update({
        status: 'released', released_at: new Date().toISOString(),
      }).eq('id', tx.id)
    }
  }

  await supabaseAdmin.from('missions').update({
    status:     'completed',
    updated_at: new Date().toISOString(),
  }).eq('id', mission_id)
}
