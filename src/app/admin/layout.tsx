'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { user, userRole, loading } = useAuth()

  useEffect(() => {
    if (loading) return
    if (!user) { router.push('/auth'); return }
    if (userRole !== 'admin') { router.push('/'); return }
  }, [loading, user, userRole, router])

  if (loading || !user || userRole !== 'admin') return (
    <div className="min-h-screen bg-dark flex items-center justify-center">
      <div style={{width:'40px',height:'40px',border:'4px solid rgba(232,93,38,0.2)',borderTop:'4px solid #E85D26',borderRadius:'50%',animation:'spin 1s linear infinite'}} />
    </div>
  )

  return <>{children}</>
}
