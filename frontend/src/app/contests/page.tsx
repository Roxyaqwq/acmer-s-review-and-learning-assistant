'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle, Badge } from '@/components/ui/base'
import { PLATFORM_COLORS, formatDateTime, countdown } from '@/lib/utils'
import { Calendar, Timer } from 'lucide-react'

interface Contest {
  platform: string
  contest_name: string
  start_time: string
  end_time: string
  duration: number
  url: string
}

export default function ContestsPage() {
  const [contests, setContests] = useState<Contest[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getUpcomingContests().then(setContests).finally(() => setLoading(false))
  }, [])

  const grouped: Record<string, Contest[]> = {}
  contests.forEach((c) => {
    if (!grouped[c.platform]) grouped[c.platform] = []
    grouped[c.platform].push(c)
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">即将开始的比赛</h1>
        <p className="text-sm text-muted-foreground">CF + AtCoder</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      ) : contests.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            暂无即将开始的比赛
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([platform, list]) => (
            <div key={platform} className="space-y-2">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Badge className={PLATFORM_COLORS[platform] || ''}>{platform}</Badge>
              </h2>
              <div className="space-y-2">
                {list.map((c, i) => (
                  <a key={i} href={c.url} target="_blank">
                    <Card className="hover:border-primary/30 hover:bg-accent/50 transition-all">
                      <CardContent className="py-4 flex items-center gap-4">
                        <Calendar className="h-5 w-5 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{c.contest_name}</p>
                          <p className="text-xs text-muted-foreground">{formatDateTime(c.start_time)} · 时长 {c.duration} 分钟</p>
                        </div>
                        <Badge variant="secondary" className="shrink-0">
                          <Timer className="h-3 w-3 mr-1" />
                          {countdown(c.start_time)}
                        </Badge>
                      </CardContent>
                    </Card>
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
