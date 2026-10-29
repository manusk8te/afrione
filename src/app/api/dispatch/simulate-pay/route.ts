import { simulatePayment } from '@/lib/payment-simulation'
export const dynamic = 'force-dynamic'
// Le paiement fictif s’arrête au reçu : aucun débit, wallet, notification ou dispatch réel.
export const POST = simulatePayment
