import type { Metadata } from 'next'
import '@/styles/liquid-glass.css'

export const metadata: Metadata = {
  title: 'Design system — AfriOne',
  robots: { index: false, follow: false },
}

export default function DesignLayout({ children }: { children: React.ReactNode }) {
  return children
}
