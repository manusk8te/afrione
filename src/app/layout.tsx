import type { Metadata } from 'next'
import './globals.css'
import { Toaster } from 'react-hot-toast'

export const metadata: Metadata = {
  title: 'AfriOne — Trouver le bon artisan, au bon prix',
  description: 'Plateforme de mise en relation entre artisans qualifiés et clients à Abidjan. Rapide, sécurisé, transparent.',
  keywords: 'artisan, abidjan, plombier, électricien, côte d\'ivoire, service, réparation',
  openGraph: {
    title: 'AfriOne',
    description: 'Trouver le bon artisan, au bon prix, au bon moment',
    url: 'https://afrione.ci',
    siteName: 'AfriOne',
    locale: 'fr_CI',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,300;12..96,400;12..96,500;12..96,600;12..96,700&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet" />
        <link href="https://api.fontshare.com/v2/css?f[]=clash-display@400,500,600,700&display=swap" rel="stylesheet" />
      </head>
      <body>
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#0F1410',
              color: '#FAFAF5',
              fontFamily: 'Bricolage Grotesque, sans-serif',
              borderRadius: '12px',
              padding: '12px 16px',
            },
            success: { iconTheme: { primary: '#2B6B3E', secondary: '#FAFAF5' } },
            error: { iconTheme: { primary: '#E85D26', secondary: '#FAFAF5' } },
          }}
        />
      </body>
    </html>
  )
}
