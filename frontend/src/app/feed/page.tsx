'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { Card, CardContent, Badge } from '@/components/ui/base'
import { Activity, CheckCircle, Code2, ExternalLink, Users } from 'lucide-react'
import { timeAgo } from '@/lib/utils'
import Link from 'next/link'

interface FeedUser {
  id: string
  nickname: string | null
  cf_handle: string | null
  avatar_url: string
}

interface FeedItem {
  type: 'solve' | 'cf_accept'
  user: FeedUser
  detail: {
    platform?: string
    contest_id?: string | number
    problem_index?: string
    problem_name?: string
    tags?: string[]
    language?: string
  }
  created_at: string
}

export default function FeedPage() {
  const { user } = useAuth()
  const [items, setItems] = useState<FeedItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    setLoading(true)
    api.getFeed()
      .then((data: any) => setItems(data || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [user])

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground">请先登录</p>
      </div>
    )
  }

  const displayName = (u: FeedUser) => u.nickname || u.cf_handle || u.id.slice(0, 8)

  const getProblemURL = (item: FeedItem) => {
    if (item.type === 'solve' && item.detail.platform === 'Codeforces') {
      return `https://codeforces.com/problemset/problem/${item.detail.contest_id}/${item.detail.problem_index}`
    }
    return null
  }

  const getDescription = (item: FeedItem) => {
    if (item.type === 'solve') {
      const platform = item.detail.platform || ''
      const cid = item.detail.contest_id || ''
      const idx = item.detail.problem_index || ''
      const name = item.detail.problem_name
      return {
        action: '补了',
        problem: name ? `${cid}${idx} ${name}` : `${cid}${idx}`,
        platform,
      }
    }
    if (item.type === 'cf_accept') {
      return {
        action: '通过了',
        problem: `CF ${item.detail.contest_id}${item.detail.problem_index}`,
        platform: 'Codeforces',
      }
    }
    return { action: '做了', problem: '', platform: '' }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Activity className="h-6 w-6 text-primary" />
          好友动态
        </h1>
        <p className="text-sm text-muted-foreground">关注的人和好友最近的做题动态</p>
      </div>

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
              <p className="text-sm text-muted-foreground mt-1">
                关注其他用户或添加好友后，他们的做题动态会出现在这里
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((item, idx) => {
            const desc = getDescription(item)
            const problemURL = getProblemURL(item)
            return (
              <Card key={idx} className="hover:border-primary/30 transition-all">
                <CardContent className="py-4 flex items-start gap-3">
                  <Link href={`/profile/${item.user.id}`} className="shrink-0">
                    <div className="h-9 w-9 rounded-full bg-accent overflow-hidden">
                      <img
                        src={item.user.avatar_url || `https://avatars.githubusercontent.com/${item.user.cf_handle || ''}`}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    </div>
                  </Link>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link href={`/profile/${item.user.id}`} className="text-sm font-medium hover:text-primary transition-colors">
                        {displayName(item.user)}
                      </Link>
                      <span className="text-sm text-muted-foreground">{desc.action}</span>
                      {problemURL ? (
                        <a href={problemURL} target="_blank" className="text-sm font-medium text-primary hover:underline flex items-center gap-1">
                          {desc.problem}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <span className="text-sm font-medium">{desc.problem}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      {item.type === 'solve' && (
                        <Badge variant="outline" className="text-[10px]">
                          <CheckCircle className="h-3 w-3 mr-1 text-emerald-400" />
                          {desc.platform}
                        </Badge>
                      )}
                      {item.type === 'cf_accept' && (
                        <Badge variant="outline" className="text-[10px]">
                          <Code2 className="h-3 w-3 mr-1 text-blue-400" />
                          Codeforces
                        </Badge>
                      )}
                      {item.detail.tags && item.detail.tags.length > 0 && (
                        <div className="flex gap-1">
                          {item.detail.tags.slice(0, 3).map((t, i) => (
                            <Badge key={i} variant="secondary" className="text-[10px]">{t}</Badge>
                          ))}
                        </div>
                      )}
                      <span className="text-[11px] text-muted-foreground ml-auto">
                        {timeAgo(item.created_at)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
