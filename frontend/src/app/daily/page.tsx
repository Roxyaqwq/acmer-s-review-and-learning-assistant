'use client'

import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { Card, CardContent, CardHeader, CardTitle, Badge, Button } from '@/components/ui/base'
import { Sparkles, RefreshCw, CheckCircle, ExternalLink, ClipboardList, Calendar, BookOpen } from 'lucide-react'
import { formatDate, timeAgo } from '@/lib/utils'
import Link from 'next/link'

interface DailyProblem {
  id: string
  review_entry: {
    id: string
    platform: string
    contest_id: string
    contest_name: string
    problem_index: string
    problem_name: string
    problem_url: string
    custom_tags: string[]
    status: string
    completed_at: string | null
  } | null
  completed: boolean
  recommended_at: string
}

export default function DailyPage() {
  const { user } = useAuth()
  const [daily, setDaily] = useState<DailyProblem | null>(null)
  const [noData, setNoData] = useState(false)
  const [loading, setLoading] = useState(true)
  const [marking, setMarking] = useState(false)

  const loadDaily = useCallback(() => {
    setLoading(true)
    api.getDaily().then((d) => {
      if (d.message) setNoData(true)
      else setDaily(d)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  useEffect(() => { if (user) loadDaily() }, [user, loadDaily])

  const handleComplete = async () => {
    if (!daily) return
    setMarking(true)
    try {
      await api.completeDaily(daily.id)
      setDaily({ ...daily, completed: true })
    } catch {}
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
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-amber-400" />
          每日一题
        </h1>
        <p className="text-sm text-muted-foreground">基于你的弱项标签，间隔复习推荐</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      ) : noData || !daily?.review_entry ? (
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
          <Card className="border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-transparent">
            <CardContent className="py-8">
              <div className="flex flex-col items-center text-center space-y-4">
                {daily.completed ? (
                  <>
                    <div className="h-16 w-16 rounded-full bg-emerald-500/10 flex items-center justify-center">
                      <CheckCircle className="h-8 w-8 text-emerald-400" />
                    </div>
                    <h2 className="text-xl font-bold text-emerald-400">今日已完成</h2>
                    <p className="text-sm text-muted-foreground">明天再来挑战新题目吧</p>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-10 w-10 text-amber-400" />
                    <h2 className="text-xl font-bold">今日推荐</h2>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="hover:border-primary/30 transition-all">
            <CardContent className="py-6 space-y-4">
              <div className="flex items-start gap-4">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{daily.review_entry.platform}</Badge>
                    <span className="font-mono text-lg font-bold">
                      {daily.review_entry.problem_index}
                    </span>
                  </div>
                  {daily.review_entry.problem_name && (
                    <p className="text-sm text-muted-foreground">{daily.review_entry.problem_name}</p>
                  )}
                  <div className="flex flex-wrap gap-1">
                    {daily.review_entry.custom_tags?.map((t, i) => (
                      <Badge key={i} variant="secondary">{t}</Badge>
                    ))}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      推荐于 {formatDate(daily.recommended_at)}
                    </span>
                    {daily.review_entry.completed_at && (
                      <span>上次完成: {timeAgo(daily.review_entry.completed_at)}</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                {!daily.completed && (
                  <Button onClick={handleComplete} disabled={marking} className="gap-2">
                    <CheckCircle className="h-4 w-4" />
                    {marking ? '标记中...' : '标记为已完成'}
                  </Button>
                )}
                {daily.review_entry.problem_url && (
                  <a href={daily.review_entry.problem_url} target="_blank">
                    <Button variant="outline" className="gap-2">
                      <ExternalLink className="h-4 w-4" />
                      打开题目
                    </Button>
                  </a>
                )}
                <Button variant="ghost" size="sm" onClick={loadDaily} disabled={loading}>
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">推荐说明</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-1">
              <p>系统会根据你在补题模块中添加的标签频率，选择出现最多的标签</p>
              <p>优先推荐近 30 天内未复习或未完成的题目</p>
              <p>标记完成后，系统会自动更新对应补题记录的状态和时间</p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
