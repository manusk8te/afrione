import Image from 'next/image'

/** One shared lockup for navigation, authentication and administration. */
export default function Brand({ inverse = false }: { inverse?: boolean }) {
  return <span className={`afrione-brand${inverse ? ' afrione-brand--inverse' : ''}`}>
    <span className="afrione-brand__symbol"><Image src="/afrione-logo-transparent.png" alt="" width={60} height={40} priority /></span>
    <span className="afrione-brand__name">AfriOne</span>
  </span>
}
