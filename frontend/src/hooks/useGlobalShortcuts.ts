'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export function useGlobalShortcuts() {
  const router = useRouter()

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      const editing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'

      // Ctrl+H — go home
      if (e.ctrlKey && !e.shiftKey && e.key === 'h') {
        e.preventDefault()
        router.push('/')
      }

      // Ctrl+K — focus search (only when not in an input)
      if (e.ctrlKey && !e.shiftKey && e.key === 'k' && !editing) {
        e.preventDefault()
        const searchInput = document.querySelector<HTMLInputElement>('[placeholder="搜索用户..."]')
        searchInput?.focus()
      }

      // Escape — close modals (handled by Radix, but backup)
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [router])
}
