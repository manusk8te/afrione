/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['res.cloudinary.com', 'lh3.googleusercontent.com'],
  },
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },
  experimental: {
    serverComponentsExternalPackages: ['@openai/agents'],
  },
  // Pages supprimées : les anciens liens (SMS, favoris) continuent de marcher.
  async redirects() {
    return [
      { source: '/cloture/:id', destination: '/warroom/:id', permanent: true },
      { source: '/paiement/:id', destination: '/warroom/:id', permanent: true },
      { source: '/artisan-space/prestation/:id', destination: '/warroom/:id', permanent: true },
      { source: '/admin/kyc', destination: '/admin', permanent: true },
      { source: '/admin/litiges', destination: '/admin', permanent: true },
      { source: '/artisan-space/planning', destination: '/artisan-space/dashboard', permanent: true },
      { source: '/artisan-space/portefeuille', destination: '/artisan-space/dashboard?tab=wallet', permanent: true },
      { source: '/urgence', destination: '/mode-select', permanent: true },
      { source: '/onboarding', destination: '/mode-select', permanent: true },
      { source: '/payment/demo', destination: '/', permanent: true },
      { source: '/bientot', destination: '/', permanent: true },
    ]
  },
}

module.exports = nextConfig
