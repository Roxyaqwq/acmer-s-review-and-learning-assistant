'use client'

import { useAuth } from '@/hooks/useAuth'
import { api, type ApiContest } from '@/lib/api'
import { useEffect, useState } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, Button } from '@/components/ui/base'
import { Badge } from '@/components/ui/base'
import { EmptyState } from '@/components/ui/empty-state'
import { RatingBadge } from '@/components/ui/rating-badge'
import { formatDateTime, countdown } from '@/lib/utils'
import { ratingTier } from '@/lib/rating'
import {
  Search,
  Calendar,
  BookOpen,
  Sparkles,
  Trophy,
  ArrowRight,
  Timer,
  Github,
  Target,
} from 'lucide-react'

/** 四宫格入口：每个入口一个色相，靠图标底片和辉光区分，不靠文字标签 */
const ENTRIES = [
  {
    href: '/review',
    icon: BookOpen,
    title: '补题',
    desc: '按比赛记录每一道没做出来的题，标好状态和题解',
    tile: 'border-violet-500/30 bg-violet-500/10 text-violet-300',
    blob: 'bg-violet-500/20',
  },
  {
    href: '/problems',
    icon: Search,
    title: '找题',
    desc: '按 rating、标签检索 Codeforces 题库',
    tile: 'border-blue-500/30 bg-blue-500/10 text-blue-300',
    blob: 'bg-blue-500/20',
  },
  {
    href: '/contests',
    icon: Calendar,
    title: '比赛',
    desc: 'CF 与 AtCoder 赛程，带倒计时，不会错过报名',
    tile: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
    blob: 'bg-emerald-500/20',
  },
  {
    href: '/daily',
    icon: Sparkles,
    title: '每日一题',
    desc: '按你的弱项标签推荐，30 天间隔重复巩固',
    tile: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
    blob: 'bg-amber-500/20',
  },
]

export default function Home() {
  const { user, login } = useAuth()
  const [dailyMsg, setDailyMsg] = useState<string>('')

  // 比赛列表：SWR 缓存 + 并发去重；挂载即请求，与 /auth/me 并行
  const { data: contests = [], mutate: refreshContests } = useSWR<ApiContest[]>(
    'home:contests',
    () => api.getUpcomingContests()
  )

  // 有 token 时拉取每日推荐（条件请求）
  const hasToken = typeof window !== 'undefined' && !!localStorage.getItem('token')
  useSWR(hasToken ? 'home:daily' : null, async () => {
    const d = await api.getDaily()
    if (d?.candidates && d.candidates.length > 0) {
      const r = d.candidates[0]
      setDailyMsg(`今日推荐: ${r.problem_name || r.platform + ' ' + r.problem_index}`)
    }
    return d
  })

  // 比赛空态延迟重试（配合后端冷启动异步预热）
  useEffect(() => {
    if (contests.length > 0) return
    const timer = setTimeout(() => { void refreshContests() }, 10000)
    return () => clearTimeout(timer)
  }, [contests.length, refreshContests])

  const displayName = user ? user.nickname || user.github_login : ''
  // 后端已按开始时间排序，这里再做一次兜底取最早的一场，防止空窗期混进过期比赛
  const nextContest = contests
    .filter((c) => new Date(c.start_time).getTime() > Date.now())
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())[0]
  const cfTier = user ? ratingTier(user.cf_rating) : null

  return (
    <div className="space-y-10">
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-2xl border border-border/80 bg-card/50">
        <div aria-hidden className="arena-grid pointer-events-none absolute inset-0 opacity-70" />
        <div aria-hidden className="arena-glow pointer-events-none absolute inset-0" />

        <div className="relative flex flex-col gap-8 p-6 sm:p-10 lg:flex-row lg:items-center lg:gap-12">
          <div className="flex-1 space-y-5">
            <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.32em] text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
              algoarena / 竞技编程工作台
            </p>

            <h1 className="text-balance text-3xl font-semibold leading-[1.15] tracking-tight sm:text-[2.6rem]">
              {user ? (
                <>
                  欢迎回来，<span className="text-gradient">{displayName}</span>
                </>
              ) : (
                <>
                  把没做出来的题，
                  <br className="hidden sm:block" />
                  变成<span className="text-gradient">下次做得出来</span>
                </>
              )}
            </h1>

            <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
              {user
                ? '比赛结束不是终点 —— 把没过的题记下来，标好弱项标签，剩下的交给每日推荐。'
                : '搜题、跟赛程、记补题、盯弱项。一个帮你把「这场又没做出来」变成「这类题我会了」的地方。'}
            </p>

            <div className="flex flex-wrap items-center gap-3">
              {user ? (
                <Link href="/review">
                  <Button size="lg" className="gap-2">
                    开始补题
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              ) : (
                <Button size="lg" className="gap-2" onClick={login}>
                  <Github className="h-4 w-4" />
                  用 GitHub 登录
                </Button>
              )}
              <Link href="/problems">
                <Button size="lg" variant="outline" className="gap-2">
                  <Search className="h-4 w-4" />
                  去题库逛逛
                </Button>
              </Link>
            </div>

            {!user && (
              <p className="text-xs text-muted-foreground">
                登录后绑定 Codeforces 账号，即可解锁补题管理、热力图与每日推荐。
              </p>
            )}
          </div>

          {/* 右侧：下一场比赛 + 今日推荐，两块实时信息 */}
          <div className="grid w-full shrink-0 gap-3 sm:grid-cols-2 lg:w-72 lg:grid-cols-1">
            <div className="rounded-xl border border-border/80 bg-background/70 p-4 backdrop-blur">
              <p className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                <Timer className="h-3.5 w-3.5" />
                下一场比赛
              </p>
              {nextContest ? (
                <>
                  <p className="mt-2 font-mono text-2xl font-semibold tabular-nums">
                    {countdown(nextContest.start_time)}
                  </p>
                  <p className="mt-1 truncate text-sm font-medium">{nextContest.contest_name}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {nextContest.platform} · {formatDateTime(nextContest.start_time)}
                  </p>
                </>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">暂无即将开始的比赛</p>
              )}
            </div>

            <div className="rounded-xl border border-border/80 bg-background/70 p-4 backdrop-blur">
              <p className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5" />
                今日推荐
              </p>
              {dailyMsg ? (
                <Link
                  href="/daily"
                  className="mt-2 flex items-start gap-1.5 text-sm font-medium transition-colors hover:text-primary"
                >
                  <span className="line-clamp-2">{dailyMsg.replace(/^今日推荐:\s*/, '')}</span>
                  <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                </Link>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">
                  {hasToken ? '正在挑题…' : '登录后每天一题'}
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 绑定提醒：只在缺 CF handle 时出现，占一行而非整块卡片 */}
      {user && user.cf_handle == null && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-500/25 bg-amber-500/[0.06] px-4 py-3">
          <Trophy className="h-4 w-4 shrink-0 text-amber-400" />
          <p className="flex-1 text-sm">
            绑定 Codeforces 账号后，热力图、提交同步与段位数据才会亮起来。
          </p>
          <Link href={`/profile/${user.id}`}>
            <Button size="sm" variant="outline" className="border-amber-500/40 text-amber-200 hover:bg-amber-500/10">
              去绑定
            </Button>
          </Link>
        </div>
      )}

      {/* ── 四个入口 ─────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {ENTRIES.map((item, i) => (
          <Link key={item.href} href={item.href} className="rise-in" style={{ animationDelay: `${i * 60}ms` }}>
            <Card className="card-hover group h-full overflow-hidden border-border/70 bg-card/60">
              <CardContent className="relative flex h-full flex-col gap-3 py-6">
                <div
                  aria-hidden
                  className={`pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full opacity-50 blur-2xl transition-opacity duration-300 group-hover:opacity-100 ${item.blob}`}
                />
                <div className={`relative inline-flex h-10 w-10 items-center justify-center rounded-lg border ${item.tile}`}>
                  <item.icon className="h-5 w-5" />
                </div>
                <h3 className="relative font-medium tracking-tight">{item.title}</h3>
                <p className="relative text-sm leading-relaxed text-muted-foreground">{item.desc}</p>
                <span className="relative mt-auto inline-flex items-center gap-1 pt-1 text-xs text-muted-foreground transition-colors group-hover:text-primary">
                  进入
                  <ArrowRight className="h-3 w-3 transition-transform duration-200 group-hover:translate-x-0.5" />
                </span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* ── 赛程 ─────────────────────────────────────────────── */}
      <Card className="border-border/70 bg-card/60">
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-medium">
            <Timer className="h-4 w-4 text-emerald-400" />
            即将开始的比赛
          </CardTitle>
          <Link href="/contests" className="text-xs text-muted-foreground transition-colors hover:text-primary">
            全部赛程 →
          </Link>
        </CardHeader>
        <CardContent>
          {contests.length === 0 ? (
            <EmptyState
              icon={Calendar}
              title="暂无即将开始的比赛"
              description="Codeforces 与 AtCoder 的赛程每 6 小时同步一次，新赛程出来会自动出现在这里。"
              className="border-0 bg-transparent py-10"
            />
          ) : (
            <div className="-mx-2 divide-y divide-border/60">
              {contests.slice(0, 5).map((c, i) => (
                <a
                  key={i}
                  href={c.url}
                  target="_blank"
                  className="flex items-center gap-3 rounded-md px-2 py-3 transition-colors hover:bg-accent/60"
                >
                  <Badge variant="outline" className="shrink-0 font-mono text-[10px] uppercase tracking-wide">
                    {c.platform}
                  </Badge>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{c.contest_name}</span>
                  <span className="hidden shrink-0 font-mono text-xs tabular-nums text-muted-foreground sm:block">
                    {formatDateTime(c.start_time)}
                  </span>
                  <Badge variant="secondary" className="shrink-0 tabular-nums">
                    {countdown(c.start_time)}
                  </Badge>
                </a>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── 个人数据 ─────────────────────────────────────────── */}
      {user && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="border-border/70 bg-card/60">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-medium">
                <Target className="h-4 w-4 text-violet-400" />
                弱项标签
              </CardTitle>
            </CardHeader>
            <CardContent>
              {user.top_tags && user.top_tags.length > 0 ? (
                <>
                  <div className="flex flex-wrap gap-2">
                    {user.top_tags.map((t) => (
                      <Badge
                        key={t}
                        className="border-violet-500/25 bg-violet-500/10 px-3 py-1 text-sm font-normal text-violet-200"
                      >
                        {t}
                      </Badge>
                    ))}
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    每日推荐会优先从这几个标签里挑题。
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  在补题模块记几道题之后，这里会显示最需要练的 top 3 标签。
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/60">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-medium">
                <Trophy className="h-4 w-4 text-amber-400" />
                Codeforces
              </CardTitle>
            </CardHeader>
            <CardContent>
              {user.cf_handle ? (
                <div className="flex items-end justify-between gap-4">
                  <div className="space-y-1">
                    <p className="font-mono text-sm text-muted-foreground">{user.cf_handle}</p>
                    <p className={`font-mono text-3xl font-semibold tabular-nums ${cfTier?.text ?? ''}`}>
                      {user.cf_rating ?? '—'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {cfTier?.label} · 最高 {user.cf_max_rating ?? '—'}
                    </p>
                  </div>
                  <RatingBadge rating={user.cf_max_rating} className="mb-1" />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">尚未绑定 Codeforces 账号。</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
