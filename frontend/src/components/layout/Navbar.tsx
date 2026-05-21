'use client'

import { cn } from '@/lib/utils'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useState, useRef, useEffect } from 'react'
import { Menu, X, Code2, Search, Calendar, BookOpen, Sparkles, User, Sun, Moon, UserSearch, Activity } from 'lucide-react'
import { api } from '@/lib/api'

const navItems = [
  { href: '/problems', label: '找题', icon: Search },
  { href: '/contests', label: '比赛', icon: Calendar },
  { href: '/review', label: '补题', icon: BookOpen },
  { href: '/daily', label: '每日一题', icon: Sparkles },
  { href: '/feed', label: '动态', icon: Activity },
]

export function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, login, logout } = useAuth()
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')

  useEffect(() => {
    const saved = localStorage.getItem('theme') || 'dark'
    setTheme(saved as 'dark' | 'light')
    document.documentElement.classList.toggle('dark', saved === 'dark')
  }, [])

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    localStorage.setItem('theme', next)
    document.documentElement.classList.toggle('dark', next === 'dark')
  }

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const handleSearch = (q: string) => {
    setSearchQuery(q)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    if (q.trim().length < 1) { setSearchResults([]); setSearchOpen(false); return }
    searchTimer.current = setTimeout(async () => {
      try {
        const results = await api.searchUsers(q.trim())
        setSearchResults(results || [])
        setSearchOpen(true)
      } catch { setSearchResults([]) }
    }, 300)
  }

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-lg">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 font-mono text-lg font-bold text-primary">
            <Code2 className="h-6 w-6" />
            <span className="hidden sm:inline">AlgoArena</span>
          </Link>
          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors',
                  pathname.startsWith(item.href)
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div ref={searchRef} className="relative hidden sm:block">
            <div className="relative">
              <UserSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                onFocus={() => { if (searchResults.length > 0) setSearchOpen(true) }}
                placeholder="搜索用户..."
                className="h-9 w-40 rounded-md border border-input bg-background pl-8 pr-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring transition-all focus:w-56"
              />
            </div>
            {searchOpen && searchResults.length > 0 && (
              <div className="absolute top-full mt-1 w-72 rounded-md border border-border bg-card shadow-lg py-1 z-50">
                {searchResults.map((r: any) => (
                  <button
                    key={r.id}
                    onClick={() => { router.push(`/profile/${r.id}`); setSearchOpen(false); setSearchQuery('') }}
                    className="w-full flex items-center gap-3 px-3 py-2 hover:bg-accent transition-colors text-left"
                  >
                    <div className="h-7 w-7 rounded-full bg-accent overflow-hidden shrink-0">
                      <img src={r.avatar_url} alt="" className="h-full w-full object-cover" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{r.nickname || r.cf_handle || r.id.slice(0, 8)}</p>
                      {r.cf_handle && <p className="text-xs text-muted-foreground">{r.cf_handle}</p>}
                    </div>
                    {r.cf_rating > 0 && <span className="text-xs text-muted-foreground font-mono ml-auto">{r.cf_rating}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button onClick={toggleTheme} className="rounded-md p-2 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          {user ? (
            <Link
              href={`/profile/${user.id}`}
              className={cn(
                'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors',
                pathname.startsWith('/profile/' + user.id) ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              )}
            >
              <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden">
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <User className="h-3.5 w-3.5 text-primary" />
                )}
              </div>
              <span className="hidden sm:inline">{user.nickname || user.github_login}</span>
            </Link>
          ) : (
            <button
              onClick={login}
              className="flex items-center gap-2 rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
              GitHub 登录
            </button>
          )}

          <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden rounded-md p-2 text-muted-foreground hover:text-foreground hover:bg-accent">
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-border bg-background px-4 py-2 space-y-1">
          <div className="relative mb-2">
            <UserSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="搜索用户..."
              className="w-full h-9 rounded-md border border-input bg-background pl-8 pr-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
            />
            {searchOpen && searchResults.length > 0 && (
              <div className="absolute top-full mt-1 w-full rounded-md border border-border bg-card shadow-lg py-1 z-50">
                {searchResults.map((r: any) => (
                  <button key={r.id} onClick={() => { router.push(`/profile/${r.id}`); setSearchOpen(false); setSearchQuery(''); setMobileOpen(false) }}
                    className="w-full flex items-center gap-3 px-3 py-2 hover:bg-accent transition-colors text-left">
                    <div className="h-7 w-7 rounded-full bg-accent overflow-hidden shrink-0">
                      <img src={r.avatar_url} alt="" className="h-full w-full object-cover" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{r.nickname || r.cf_handle || r.id.slice(0, 8)}</p>
                      {r.cf_handle && <p className="text-xs text-muted-foreground">{r.cf_handle}</p>}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)}
              className={cn('flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
                pathname.startsWith(item.href) ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-accent')
              }>
              <item.icon className="h-4 w-4" />{item.label}
            </Link>
          ))}
        </div>
      )}
    </nav>
  )
}
