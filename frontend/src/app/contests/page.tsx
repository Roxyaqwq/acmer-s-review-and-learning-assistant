'use client'

import useSWR from 'swr'
import { api, type ApiContest } from '@/lib/api'
import { Card, CardContent, Badge } from '@/components/ui/base'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import { PLATFORM_COLORS, cn, formatDateTime, countdown } from '@/lib/utils'
import { Calendar, Timer, ArrowUpRight } from 'lucide-react'

export default function ContestsPage() {
  const { data: contests = [], isLoading: loading } = useSWR<ApiContest[]>(
    'contests:upcoming',
    () => api.getUpcomingContests()
  )

  const grouped: Record<string, ApiContest[]> = {}
  contests.forEach((c) => {
    if (!grouped[c.platform]) grouped[c.platform] = []
    grouped[c.platform].push(c)
  })

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="schedule"
        title="即将开始的比赛"
        description="Codeforces 与 AtCoder 的赛程，按平台分组，每 6 小时同步一次"
        actions={
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            共 <span className="text-foreground">{contests.length}</span> 场
          </span>
        }
      />

      {loading ? (
        <Card className="border-border/60 bg-card/40">
          <CardContent className="space-y-3 py-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="h-3 w-16 shrink-0 animate-pulse rounded bg-muted" />
                <div className="h-3 flex-1 animate-pulse rounded bg-muted" />
                <div className="h-6 w-20 shrink-0 animate-pulse rounded bg-muted" />
              </div>
            ))}
          </CardContent>
        </Card>
      ) : contests.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="暂无即将开始的比赛"
          description="赛程由后端定时从 CF 与 AtCoder 拉取。如果刚启动，稍等几分钟再刷新。"
        />
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([platform, list]) => (
            <section key={platform} className="space-y-3">
              <h2 className="flex items-center gap-2 text-sm font-medium">
                <span className={cn('h-2 w-2 rounded-full bg-current', PLATFORM_COLORS[platform] || 'text-foreground')} aria-hidden />
                <span className={PLATFORM_COLORS[platform] || 'text-foreground'}>{platform}</span>
                <span className="font-mono text-xs text-muted-foreground">{list.length} 场</span>
              </h2>

              <Card className="border-border/70 bg-card/60">
                <div className="divide-y divide-border/60">
                  {list.map((c, i) => (
                    <a
                      key={i}
                      href={c.url}
                      target="_blank"
                      rel="noreferrer"
                      className="rise-in group flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-accent/50"
                      style={{ animationDelay: `${Math.min(i, 10) * 40}ms` }}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium transition-colors group-hover:text-primary">
                          {c.contest_name}
                        </p>
                        <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
                          {formatDateTime(c.start_time)} · {c.duration} 分钟
                        </p>
                      </div>
                      <Badge variant="secondary" className="shrink-0 gap-1 tabular-nums">
                        <Timer className="h-3 w-3" />
                        {countdown(c.start_time)}
                      </Badge>
                      <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                    </a>
                  ))}
                </div>
              </Card>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
