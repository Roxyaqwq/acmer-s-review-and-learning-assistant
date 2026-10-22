'use client'
export const dynamic = 'force-dynamic'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function AuthCallback() {
  const router = useRouter()

  useEffect(() => {
    const match = window.location.hash.match(/token=([^&]+)/)
    const token = match?.[1]
    if (token) {
      localStorage.setItem('token', token)
      router.push('/')
    }
  }, [router])

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center space-y-4">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto" />
        <p className="text-muted-foreground">登录中...</p>
      </div>
    </div>
  )
}
