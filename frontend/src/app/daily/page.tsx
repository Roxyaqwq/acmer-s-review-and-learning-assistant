'use client'

import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/components/ui/toaster'
import { Card, CardContent, CardHeader, CardTitle, Badge, Button } from '@/components/ui/base'
import { PageHeader } from '@/components/ui/page-header'
import { Sparkles, RefreshCw, CheckCircle, ExternalLink, ClipboardList, BookOpen } from 'lucide-react'
import { formatDate, timeAgo } from '@/lib/utils'
import Link from 'next/link'

interface ReviewEntry {
  id: string
  platform: string
  contest_id: string
  contest_name: string
  contest_url: string
  problem_index: string
  problem_name: string
  problem_url: string
  custom_tags: string[]
  status: string
  completed_at: string | null
}

function getTodayKey() {
  return new Date().toISOString().slice(0, 10)
}

function getRefreshState(): { date: string; used: number } {
  try {
    const raw = localStorage.getItem('daily_refresh')
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed.date === getTodayKey()) return parsed
    }
  } catch (e) {
    console.warn('[daily] failed to parse refresh state', e)
  }
  return { date: getTodayKey(), used: 0 }
}

function saveRefreshState(used: number) {
  localStorage.setItem('daily_refresh', JSON.stringify({ date: getTodayKey(), used }))
}

function getCooldownDays(): number {
  const v = localStorage.getItem('daily_cooldown_days')
  return v ? parseInt(v) || 7 : 7
}

function saveCooldownDays(d: number) {
  localStorage.setItem('daily_cooldown_days', String(d))
}

export default function DailyPage() {
  const { user } = useAuth()
  const { addToast } = useToast()
  const [candidates, setCandidates] = useState<ReviewEntry[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [refreshUsed, setRefreshUsed] = useState(0)
  const [cooldownDays, setCooldownDays] = useState(7)
  const [loading, setLoading] = useState(true)
  const [marking, setMarking] = useState(false)
  const [completed, setCompleted] = useState(false)

  const maxRefreshes = 2
  const refreshLeft = maxRefreshes - refreshUsed
  const exhausted = refreshLeft <= 0

  const loadCandidates = useCallback(async (days?: number) => {
    setLoading(true)
    try {
      const cd = days ?? getCooldownDays()
      const d = await api.getDaily(cd)
      if (d.message) {
        setCandidates([])
      } else {
        setCandidates(d.candidates || [])
        setCurrentIndex(0)
      }
    } catch (e) {
      console.error('[daily] candidates load failed', e)
      setCandidates([])
    }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    if (!user) return
    const cd = getCooldownDays()
    setCooldownDays(cd)
    const state = getRefreshState()
    setRefreshUsed(state.used)
    loadCandidates(cd)
  }, [user, loadCandidates])

  const handleRefresh = () => {
    if (exhausted || candidates.length === 0) return
    const nextUsed = refreshUsed + 1
    setRefreshUsed(nextUsed)
    saveRefreshState(nextUsed)

    const nextIndex = currentIndex + 1
    if (nextIndex < candidates.length) {
      setCurrentIndex(nextIndex)
    }
  }

  const handleCooldownChange = (days: number) => {
    setCooldownDays(days)
    saveCooldownDays(days)
    setRefreshUsed(0)
    saveRefreshState(0)
    setCompleted(false)
    loadCandidates(days)
  }

  const handleComplete = async () => {
    const entry = candidates[currentIndex]
    if (!entry) return
    setMarking(true)
    try {
      await api.completeDaily(entry.id)
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

  const current = candidates[currentIndex] || null

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
        <div className="flex justify-center py-12">
          <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      ) : candidates.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center space-y-4">
            <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground" />
            <div>
              <p className="font-medium">暂无推荐数据</p>
              <p className="text-sm text-muted-foreground mt-1">请先在补题模块添加题目，系统会根据你的标签频率推荐题目</p>
            </div>
            <Link href="/review">
              <Button><BookOpen className="h-4 w-4 mr-1" /> 去补题</Button>
            </Link>
          </CardContent>
        </Card>
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
                  {completed ? '明天再来，换一道新的' : `${formatDate(new Date().toISOString())} · 按你的弱项标签挑的`}
                </p>
              </div>
              {completed && <Badge variant="success">已完成</Badge>}
            </CardContent>
          </Card>

          <Card className="hover:border-primary/30 transition-all">
            <CardContent className="py-6 space-y-4">
              {current && (
                <>
                  <div className="flex items-start gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline">{current.platform}</Badge>
                        {current.contest_name && (
                          current.contest_url ? (
                            <a href={current.contest_url} target="_blank" className="text-sm font-medium hover:text-primary underline-offset-2 hover:underline flex items-center gap-1">
                              {current.contest_name} <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : (
                            <span className="text-sm font-medium">{current.contest_name}</span>
                          )
                        )}
                        <span className="text-xs text-muted-foreground ml-auto">
                          候选 {currentIndex + 1} / {candidates.length}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-lg font-bold">{current.problem_index}</span>
                        {current.problem_name && (
                          <span className="text-sm text-muted-foreground">{current.problem_name}</span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {current.custom_tags?.map((t, i) => (
                          <Badge key={i} variant="secondary">{t}</Badge>
                        ))}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        {current.completed_at && (
                          <span>上次完成: {timeAgo(current.completed_at)}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {!completed && (
                      <Button onClick={handleComplete} disabled={marking} className="gap-2">
                        <CheckCircle className="h-4 w-4" />
                        {marking ? '标记中...' : '标记为已完成'}
                      </Button>
                    )}
                    {current.problem_url && (
                      <a href={current.problem_url} target="_blank">
                        <Button variant="outline" className="gap-2">
                          <ExternalLink className="h-4 w-4" />
                          打开题目
                        </Button>
                      </a>
                    )}

                    <div className="ml-auto flex items-center gap-2">
                      {exhausted ? (
                        <span className="text-xs text-muted-foreground">杂鱼，到此为止了吗(❍ᴥ❍ʋ)</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">剩余 {refreshLeft} 次</span>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleRefresh}
                        disabled={loading || exhausted}
                        className="gap-1"
                      >
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        换一题
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">推荐说明</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-1">
              <p>根据你在补题模块中的标签频率，按 top1 → top2 → top3 依次匹配，每个标签选一道未做或冷却期外的题</p>
              <p>每天有 2 次换题机会，每次切换到下一道候选</p>
              <p>冷却期可在右上角调整（当前 {cooldownDays} 天），超过冷却期的已解决题目可能再次被推荐</p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
