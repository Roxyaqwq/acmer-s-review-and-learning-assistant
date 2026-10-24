'use client'

import { useState, useEffect, useCallback } from 'react'
import { api, type ApiReviewEntry } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/components/ui/toaster'
import { Card, CardContent, CardHeader, CardTitle, Badge, Button } from '@/components/ui/base'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState } from '@/components/ui/empty-state'
import { Sparkles, RefreshCw, CheckCircle, ExternalLink, BookOpen } from 'lucide-react'
import { timeAgo } from '@/lib/utils'
import Link from 'next/link'

// Only the cooldown is a local preference; the pick itself, the swap budget and
// the "already done" flag all live on the server now, so they survive a reload
// and stay identical across browsers.
const COOLDOWN_KEY = 'daily_cooldown_days'

function getCooldownDays(): number {
  const raw = localStorage.getItem(COOLDOWN_KEY)
  const parsed = raw ? parseInt(raw, 10) : NaN
  return Number.isFinite(parsed) ? parsed : 7
}

function saveCooldownDays(days: number) {
  localStorage.setItem(COOLDOWN_KEY, String(days))
}

export default function DailyPage() {
  const { user } = useAuth()
  const { addToast } = useToast()
  const [problem, setProblem] = useState<ApiReviewEntry | null>(null)
  const [completed, setCompleted] = useState(false)
  const [swapsLeft, setSwapsLeft] = useState(0)
  const [recommendedAt, setRecommendedAt] = useState<string | null>(null)
  const [cooldownDays, setCooldownDays] = useState(7)
  const [loading, setLoading] = useState(true)
  const [marking, setMarking] = useState(false)
  const [swapping, setSwapping] = useState(false)

  const apply = useCallback((data: Awaited<ReturnType<typeof api.getDaily>>) => {
    setProblem(data.problem ?? null)
    setCompleted(Boolean(data.completed))
    setSwapsLeft(data.swaps_left ?? 0)
    setRecommendedAt(data.recommended_at ?? null)
    if (data.cooldown_days) setCooldownDays(data.cooldown_days)
  }, [])

  const load = useCallback(async (days: number) => {
    setLoading(true)
    try {
      apply(await api.getDaily(days))
    } catch (e) {
      console.error('[daily] load failed', e)
      setProblem(null)
    } finally {
      setLoading(false)
    }
  }, [apply])

  useEffect(() => {
    if (!user) return
    const days = getCooldownDays()
    setCooldownDays(days)
    load(days)
  }, [user, load])

  const handleSwap = async () => {
    if (swapping || swapsLeft <= 0) return
    setSwapping(true)
    try {
      apply(await api.swapDaily(cooldownDays))
    } catch (e) {
      addToast({ title: '换题失败', description: (e as Error).message, variant: 'destructive' })
    }
    setSwapping(false)
  }

  const handleCooldownChange = (days: number) => {
    setCooldownDays(days)
    saveCooldownDays(days)
    load(days)
  }

  const handleComplete = async () => {
    if (!problem) return
    setMarking(true)
    try {
      await api.completeDaily(problem.id)
      setCompleted(true)
    } catch (e) {
      addToast({ title: '标记失败', description: (e as Error).message, variant: 'destructive' })
    }
    setMarking(false)
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground">请先登录</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="daily"
        title="每日一题"
        description="基于你的高频标签，间隔复习推荐"
        actions={
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">冷却期</span>
            <select
              value={cooldownDays}
              onChange={e => handleCooldownChange(Number(e.target.value))}
              className="h-8 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value={3}>3 天</option>
              <option value={7}>7 天</option>
              <option value={15}>15 天</option>
            </select>
          </div>
        }
      />

      {loading ? (
        <div className="space-y-4">
          <div className="h-20 animate-pulse rounded-xl border border-border/70 bg-card/40" />
          <div className="h-52 animate-pulse rounded-xl border border-border/70 bg-card/40" />
        </div>
      ) : !problem ? (
        <EmptyState
          icon={BookOpen}
          title="还没有可以推荐的题"
          description="先在补题模块记下几道题，系统会按你的标签频率挑一道给你。"
          action={
            <Link href="/review">
              <Button size="sm">去补题</Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-4">
          <Card className="relative overflow-hidden border-amber-500/25 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent">
            <div aria-hidden className="pointer-events-none absolute -left-12 -top-12 h-36 w-36 rounded-full bg-amber-500/20 blur-2xl" />
            <CardContent className="relative flex items-center gap-3 py-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-400">
                {completed ? <CheckCircle className="h-5 w-5 text-emerald-400" /> : <Sparkles className="h-5 w-5" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{completed ? '今天这道已经做完了' : '今日推荐'}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {completed ? '明天再来，换一道新的' : `${recommendedAt ?? ''} · 按你的弱项标签挑的，今天不会变`}
                </p>
              </div>
              {completed && <Badge variant="success">已完成</Badge>}
            </CardContent>
          </Card>

          <Card className="hover:border-primary/30 transition-all">
            <CardContent className="py-6 space-y-4">
              <div className="flex items-start gap-4">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline">{problem.platform}</Badge>
                    {problem.contest_name && (
                      problem.contest_url ? (
                        <a href={problem.contest_url} target="_blank" rel="noreferrer" className="text-sm font-medium hover:text-primary underline-offset-2 hover:underline flex items-center gap-1">
                          {problem.contest_name} <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <span className="text-sm font-medium">{problem.contest_name}</span>
                      )
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-lg font-bold">{problem.problem_index}</span>
                    {problem.problem_name && (
                      <span className="text-sm text-muted-foreground">{problem.problem_name}</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {problem.custom_tags?.map((tag, i) => (
                      <Badge key={i} variant="secondary">{tag}</Badge>
                    ))}
                  </div>
                  {problem.completed_at && (
                    <p className="text-xs text-muted-foreground">上次完成: {timeAgo(problem.completed_at)}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {!completed && (
                  <Button onClick={handleComplete} disabled={marking} className="gap-2">
                    <CheckCircle className="h-4 w-4" />
                    {marking ? '标记中...' : '标记为已完成'}
                  </Button>
                )}
                {problem.problem_url && (
                  <a href={problem.problem_url} target="_blank" rel="noreferrer">
                    <Button variant="outline" className="gap-2">
                      <ExternalLink className="h-4 w-4" />
                      打开题目
                    </Button>
                  </a>
                )}

                <div className="ml-auto flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {completed ? '今天已经收工' : swapsLeft > 0 ? `还能换 ${swapsLeft} 次` : '今天换完了'}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSwap}
                    disabled={swapping || completed || swapsLeft <= 0}
                    className="gap-1"
                  >
                    <RefreshCw className={`h-4 w-4 ${swapping ? 'animate-spin' : ''}`} />
                    换一题
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">推荐说明</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-1">
              <p>按你在补题模块里的标签频率，从最弱的标签开始找一道没做过、或已经超过冷却期的题</p>
              <p>选中的题当天就固定下来，刷新页面不会变；每天 2 次换题机会，换过的题当天不再出现</p>
              <p>冷却期在右上角调整（当前 {cooldownDays} 天），已解决的题超过冷却期后会重新进入候选</p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
