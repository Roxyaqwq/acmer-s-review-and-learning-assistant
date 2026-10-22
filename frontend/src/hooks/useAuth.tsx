'use client'

import { useState, useEffect, createContext, useContext, useCallback } from 'react'
import { api } from '@/lib/api'

interface User {
  id: string
  github_login: string
  github_avatar_url: string
  cf_handle: string | null
  cf_rating: number
  cf_max_rating: number
  cf_rank: string
  nickname: string | null
  signature: string
  avatar_url: string
  background_url: string
  role: string
  allow_view_review: boolean
  top_tags: string[]
}

interface AuthContextType {
  user: User | null
  loading: boolean
  login: () => void
  logout: () => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: () => {},
  logout: () => {},
  refreshUser: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshUser = useCallback(async () => {
    const token = localStorage.getItem('token')
    if (!token) {
      setLoading(false)
      return
    }
    try {
      const data = await api.getMe()
      setUser(data)
    } catch {
      localStorage.removeItem('token')
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refreshUser() }, [refreshUser])

  const login = () => {
    window.location.href = '/api/auth/github'
  }

  const logout = () => {
    localStorage.removeItem('token')
    setUser(null)
    window.location.href = '/'
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
