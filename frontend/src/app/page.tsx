'use client'

import { useAuth } from '@/hooks/useAuth'
import { api } from '@/lib/api'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/base'
import { Badge } from '@/components/ui/base'
import { formatDateTime, countdown } from '@/lib/utils'
import { Search, Calendar, BookOpen, Sparkles, Trophy, ArrowRight, Timer } from 'lucide-react'

interface Contest {
  platform: string
  contest_name: string
  start_time: string
  duration: number
  url: string
}

export default function Home() {
  const { user, loading } = useAuth()
  const [contests, setContests] = useState<Contest[]>([])
  const [dailyMsg, setDailyMsg] = useState<string>('')

  useEffect(() => {
    api.getUpcomingContests().then(setContests).catch(() => {})
    if (user) {
      api.getDaily().then((d) => {
        if (d?.review_entry) {
          setDailyMsg(`今日推荐: ${d.review_entry.problem_name || d.review_entry.platform + ' ' + d.review_entry.problem_index}`)
        }
      }).catch(() => {})
    }
  }, [user])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold font-mono">
          {user ? `Welcome back, ${user.nickname || user.github_login}` : 'AlgoArena'}
        </h1>
        <p className="text-muted-foreground">你的竞技编程工具箱</p>
      </div>

      {!user && (
        <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
          <CardContent className="py-8 text-center space-y-4">
            <Trophy className="h-12 w-12 mx-auto text-primary" />
            <h2 className="text-xl font-semibold">登录 AlgoArena，解锁全部功能</h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              使用 GitHub 登录并绑定 Codeforces 账号，即可使用补题管理、每日推荐、热力图等全部功能
            </p>
          </CardContent>
        </Card>
      )}

      {user && user.cf_handle == null && (
        <Card className="border-amber-500/30 bg-gradient-to-r from-amber-500/5 to-transparent">
          <CardContent className="py-4 flex items-center gap-3">
            <Trophy className="h-5 w-5 text-amber-400 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium">绑定你的 Codeforces 账号</p>
              <p className="text-xs text-muted-foreground">绑定后可使用热力图、CF 数据、提交同步等功能</p>
            </div>
            <Link href={`/profile/${user.id}`}>
              <Button size="sm">去绑定</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {user && dailyMsg && (
        <Card className="border-amber-500/30 bg-gradient-to-r from-amber-500/5 to-transparent">
          <CardContent className="py-4 flex items-center gap-3">
            <Sparkles className="h-5 w-5 text-amber-400 shrink-0" />
            <Link href="/daily" className="text-sm font-medium hover:text-amber-400 transition-colors">
              {dailyMsg}
            </Link>
            <ArrowRight className="h-4 w-4 text-amber-400 ml-auto" />
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { href: '/problems', icon: Search, title: '找题', desc: '按 rating / tag 搜索 CF 题目', color: 'text-blue-400' },
          { href: '/contests', icon: Calendar, title: '比赛', desc: '查看 CF / AtCoder 即将开始的比赛', color: 'text-green-400' },
          { href: '/review', icon: BookOpen, title: '补题', desc: '管理各平台补题记录', color: 'text-purple-400' },
          { href: '/daily', icon: Sparkles, title: '每日一题', desc: '基于你的弱项智能推荐', color: 'text-amber-400' },
        ].map((item) => (
          <Link key={item.href} href={item.href}>
            <Card className="h-full hover:border-primary/50 hover:bg-accent/50 transition-all cursor-pointer group">
              <CardContent className="py-6 space-y-3">
                <item.icon className={`h-8 w-8 ${item.color}`} />
                <h3 className="font-semibold group-hover:text-primary transition-colors">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Timer className="h-5 w-5 text-green-400" />
            即将开始的比赛
          </CardTitle>
        </CardHeader>
        <CardContent>
          {contests.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂未找到即将开始的比赛</p>
          ) : (
            <div className="space-y-2">
              {contests.slice(0, 5).map((c, i) => (
                <a
                  key={i}
                  href={c.url}
                  target="_blank"
                  className="flex items-center gap-3 rounded-md p-3 hover:bg-accent transition-colors"
                >
                  <Badge variant="outline" className="shrink-0">{c.platform}</Badge>
                  <span className="text-sm font-medium flex-1 truncate">{c.contest_name}</span>
                  <span className="text-xs text-muted-foreground shrink-0">{formatDateTime(c.start_time)}</span>
                  <Badge variant="secondary" className="shrink-0">{countdown(c.start_time)}</Badge>
                </a>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {user && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-lg">主攻方向</CardTitle></CardHeader>
            <CardContent>
              {user.top_tags && user.top_tags.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {user.top_tags.map((t) => (
                    <Badge key={t} className="text-sm px-3 py-1">{t}</Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">在补题模块添加题目后，这里会显示你的 top 3 标签</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-lg">CF 数据</CardTitle></CardHeader>
            <CardContent>
              {user.cf_handle ? (
                <div className="space-y-1 text-sm">
                  <p>Handle: <span className="font-mono font-medium">{user.cf_handle}</span></p>
                  <p>Rating: <span className="font-bold">{user.cf_rating}</span> (max: {user.cf_max_rating})</p>
                  <p>Rank: <span className="capitalize">{user.cf_rank}</span></p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">尚未绑定 CF 账号</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
