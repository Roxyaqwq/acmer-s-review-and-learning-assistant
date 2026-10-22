'use client'

import useSWR from 'swr'
import { api } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { Card, CardContent, Badge, Button } from '@/components/ui/base'
import { PageHeader } from '@/components/ui/page-header'
import { CheckCircle, Code2, Users, RefreshCw } from 'lucide-react'
import { timeAgo } from '@/lib/utils'
import { RemoteImage } from '@/components/ui/remote-image'
import Link from 'next/link'

interface FeedUser {
  id: string
  nickname: string | null
  cf_handle: string | null
  avatar_url: string
}

interface SolveDetail {
  platform: string
  contest_id: string
  problem_index: string
  problem_name: string
  tags: string[]
}

interface CFAcceptDetail {
  contest_id: number
  problem_index: string
  language: string
}

interface FeedItem {
  type: 'solve' | 'cf_accept'
  user: FeedUser
  detail: SolveDetail | CFAcceptDetail
  created_at: string
}

export default function FeedPage() {
  const { user } = useAuth()

  const { data: items = [], isValidating: loading, mutate: loadFeed } = useSWR<FeedItem[]>(
    user ? 'feed' : null,
    () => api.getFeed()
  )

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
        eyebrow="feed"
        title="好友动态"
        description="关注的人和好友最近 7 天的做题动态"
        actions={
          <Button variant="outline" size="sm" onClick={() => { void loadFeed() }} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />刷新
          </Button>
        }
      />

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      ) : items.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center space-y-4">
            <Users className="h-12 w-12 mx-auto text-muted-foreground" />
            <div>
              <p className="font-medium">暂无动态</p>
              <p className="text-sm text-muted-foreground mt-1">关注其他用户或添加好友后，他们的做题动态会出现在这里</p>
            </div>
            <Link href="/problems">
              <Button variant="outline">去发现用户</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((item, i) => (
            <Card key={i} className="hover:border-primary/20 transition-colors">
              <CardContent className="py-4 px-5">
                <div className="flex items-start gap-3">
                  <Link href={`/profile/${item.user.id}`} className="shrink-0">
                    <div className="h-9 w-9 rounded-full bg-accent overflow-hidden">
                      {item.user.avatar_url ? (
                        <RemoteImage src={item.user.avatar_url} />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-muted-foreground text-xs">
                          {(item.user.nickname || item.user.cf_handle || '?')[0].toUpperCase()}
                        </div>
                      )}
                    </div>
                  </Link>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link href={`/profile/${item.user.id}`} className="font-medium text-sm hover:text-primary truncate">
                        {item.user.nickname || item.user.cf_handle || item.user.id.slice(0, 8)}
                      </Link>
                      {item.user.cf_handle && (
                        <span className="text-xs text-muted-foreground font-mono">{item.user.cf_handle}</span>
                      )}
                      <span className="text-xs text-muted-foreground ml-auto shrink-0">{timeAgo(item.created_at)}</span>
                    </div>

                    {item.type === 'solve' && (
                      <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                        <CheckCircle className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                        <span className="text-sm">解决了</span>
                        <Badge variant="outline" className="text-[10px]">{(item.detail as SolveDetail).platform}</Badge>
                        <span className="font-mono text-sm font-medium">
                          {(item.detail as SolveDetail).problem_index}
                        </span>
                        {(item.detail as SolveDetail).problem_name && (
                          <span className="text-sm text-muted-foreground truncate">
                            {(item.detail as SolveDetail).problem_name}
                          </span>
                        )}
                      </div>
                    )}

                    {item.type === 'cf_accept' && (
                      <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                        <Code2 className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                        <span className="text-sm">CF 通过</span>
                        <span className="font-mono text-sm font-medium">
                          {(item.detail as CFAcceptDetail).contest_id}{(item.detail as CFAcceptDetail).problem_index}
                        </span>
                        <Badge variant="secondary" className="text-[10px]">{(item.detail as CFAcceptDetail).language}</Badge>
                      </div>
                    )}

                    {item.type === 'solve' && (item.detail as SolveDetail).tags?.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {(item.detail as SolveDetail).tags.slice(0, 4).map((t, j) => (
                          <Badge key={j} variant="secondary" className="text-[10px]">{t}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
