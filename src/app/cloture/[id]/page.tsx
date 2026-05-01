'use client'
import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'

export default function ClotureRedirect() {
  const params = useParams()
  const router = useRouter()
  useEffect(() => { router.replace(`/warroom/${params.id}`) }, [])
  return null
}
