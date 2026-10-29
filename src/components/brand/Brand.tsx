
/** One shared lockup for navigation, authentication and administration. */
export default function Brand({ inverse = false }: { inverse?: boolean }) {
  return <span className={`afrione-brand${inverse ? ' afrione-brand--inverse' : ''}`}>
    <span aria-hidden="true" className="afrione-brand__symbol afrione-gradient" />
    <span className="afrione-brand__name">AfriOne</span>
  </span>
}
