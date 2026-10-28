export function safeAuthRedirect(value: string | null): string {
  return value && value.startsWith('/') && !value.startsWith('//') && !/[\\\r\n]/.test(value) ? value : '/diagnostic'
}
export function recoveryLinkError(hash: string, search: string): string {
  const parts = [new URLSearchParams(hash.replace(/^#/, '')), new URLSearchParams(search.replace(/^\?/, ''))]
  return parts.some(p => p.has('error') || p.has('error_code'))
    ? 'Ce lien est invalide, expiré ou déjà utilisé. Demandez un nouvel email et utilisez uniquement le plus récent, ou saisissez son code ci-dessous.' : ''
}
export function recoveryErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : ''
  if (/expired|invalid.*token|token.*invalid|otp_expired/i.test(message)) return 'Le code ou le lien est invalide, expiré ou déjà utilisé. Utilisez le dernier email reçu ou demandez-en un nouveau.'
  if (/rate|too many|security purposes/i.test(message)) return 'Trop de demandes rapprochées. Patientez au moins une minute avant de réessayer.'
  if (/fetch|network/i.test(message)) return 'Le service de connexion est inaccessible. Vérifiez votre connexion puis réessayez.'
  return 'La vérification a échoué. Vérifiez le code du dernier email reçu et réessayez.'
}
export async function verifyRecoveryCode(client: { auth: { verifyOtp: (input: {email: string; token: string; type: 'recovery'}) => Promise<{data: {session: unknown}; error: unknown}> } }, email: string, code: string) {
  const address = email.trim()
  const token = code.replace(/\s/g, '')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) throw new Error('Adresse email invalide')
  if (!/^\d{6,10}$/.test(token)) throw new Error('Code invalide')
  const result = await client.auth.verifyOtp({ email: address, token, type: 'recovery' })
  if (result.error) throw result.error
  if (!result.data.session) throw new Error('Session de récupération absente')
  return result.data.session
}
