'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function AdminKYCRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace('/admin') }, [])
  return null
}
