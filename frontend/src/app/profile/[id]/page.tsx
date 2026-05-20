'use client'

import { useState, useEffect, useMemo } from 'react'
import { useParams } from 'next/navigation'
import { api } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { Card, CardContent, CardHeader, CardTitle, Badge, Button } from '@/components/ui/base'
import { useToast } from '@/components/ui/toaster'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { User, MapPin, Users, UserPlus, UserMinus, Calendar, Flame, Trophy, Activity, UserCheck, Clock, X, Check, BarChart3 } from 'lucide-react'
import { formatDate, timeAgo } from '@/lib/utils'

interface ProfileUser {
  id: string
  github_login: string
  avatar_url: string
  cf_handle: string | null
  cf_rating: number
  cf_max_rating: number
  cf_rank: string
  nickname: string | null
  signature: string
  background_url: string
  created_at: string
}

interface HeatmapDay {
  date: string
  count: number
}

interface SocialUser {
  id: string
  nickname: string | null
  cf_handle: string | null
  cf_rating: number
  avatar_url: string
}

interface FriendRequest {
  id: string
  sender_id?: string
  receiver_id?: string
  nickname: string | null
  cf_handle: string | null
  avatar_url: string
  created_at: string
}

interface Relationship {
  is_following: boolean
  is_friend: boolean
  pending_request: 'none' | 'incoming' | 'outgoing'
}

export default function ProfilePage() {
  const params = useParams()
  const { user: me, refreshUser } = useAuth()
  const { addToast } = useToast()
  const [profile, setProfile] = useState<ProfileUser | null>(null)
  const [topTags, setTopTags] = useState<string[]>([])
  const [relationship, setRelationship] = useState<Relationship>({ is_following: false, is_friend: false, pending_request: 'none' })
  const [followerCount, setFollowerCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
  const [heatmap, setHeatmap] = useState<HeatmapDay[]>([])
  const [tab, setTab] = useState<'profile' | 'followers' | 'following'>('profile')
  const [followerList, setFollowerList] = useState<SocialUser[]>([])
  const [followingList, setFollowingList] = useState<SocialUser[]>([])
  const [editing, setEditing] = useState(false)
  const [signature, setSignature] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [allowReview, setAllowReview] = useState(false)
  const [bindHandle, setBindHandle] = useState('')
  const [binding, setBinding] = useState(false)
  const [pendingRequests, setPendingRequests] = useState<FriendRequest[]>([])
  const [friendList, setFriendList] = useState<SocialUser[]>([])
  const [confirm, setConfirm] = useState<{ open: boolean; title: string; desc: string; action: () => void; variant?: 'destructive' }>({ open: false, title: '', desc: '', action: () => {} })
  const [stats, setStats] = useState<any>(null)

  const isMe = me?.id === params.id

  useEffect(() => {
    const id = params.id as string
    api.getUserProfile(id).then((data: any) => {
      setProfile(data.user)
      setTopTags(data.top_tags || [])
      setFollowerCount(data.follower_count || 0)
      setFollowingCount(data.following_count || 0)
      setAllowReview(data.user?.allow_view_review || false)
      if (data.relationship) {
        setRelationship({
          is_following: data.relationship.is_following,
          is_friend: data.relationship.is_friend,
          pending_request: data.relationship.pending_request as Relationship['pending_request'],
        })
      }
    }).catch(() => {})
    api.getUserHeatmap(id).then(setHeatmap).catch(() => {})
    api.getUserStats(id).then(setStats).catch(() => {})
    if (isMe) {
      api.getPendingRequests().then((list: any) => setPendingRequests(list || [])).catch(() => {})
      api.getFriends().then((list: any) => setFriendList(list || [])).catch(() => {})
    }
  }, [params.id, isMe])

  const refreshRelationship = async () => {
    if (!profile || isMe) return
    try {
      const rel = await api.getRelationshipStatus(profile.id)
      setRelationship({
        is_following: rel.is_following,
        is_friend: rel.is_friend,
        pending_request: rel.pending_request as Relationship['pending_request'],
      })
    } catch {}
  }

  const handleFollow = async () => {
    if (!profile) return
    try {
      await api.follow(profile.id)
      setRelationship((r) => ({ ...r, is_following: true }))
      setFollowerCount((c) => c + 1)
    } catch {}
  }

  const handleUnfollow = async () => {
    if (!profile) return
    try {
      await api.unfollow(profile.id)
      setRelationship((r) => ({ ...r, is_following: false }))
      setFollowerCount((c) => Math.max(0, c - 1))
    } catch {}
  }

  const loadFollowers = async () => {
    const id = params.id as string
    api.getFollowers(id).then((list: any) => setFollowerList(list || [])).catch(() => {})
    setTab('followers')
  }

  const loadFollowing = async () => {
    const id = params.id as string
    api.getFollowing(id).then((list: any) => setFollowingList(list || [])).catch(() => {})
    setTab('following')
  }

  const handleBindCF = async () => {
    if (!bindHandle.trim()) return
    setBinding(true)
    try {
      await api.bindCF(bindHandle.trim())
      setBindHandle('')
      await refreshUser()
      const id = params.id as string
      const data = await api.getUserProfile(id) as any
      setProfile(data.user)
    } catch (e: any) { addToast({ title: '绑定失败', description: e.message, variant: 'destructive' }) }
    setBinding(false)
  }

  const handleSendRequest = async () => {
    if (!profile) return
    try {
      await api.sendFriendRequest(profile.id)
      setRelationship((r) => ({ ...r, pending_request: 'outgoing' }))
    } catch (e: any) { addToast({ title: '操作失败', description: e.message, variant: 'destructive' }) }
  }

  const handleAcceptRequest = async (reqId: string) => {
    try {
      await api.acceptFriendRequest(reqId)
      setPendingRequests((p) => p.filter((r) => r.id !== reqId))
      setRelationship((r) => ({ ...r, is_friend: true, pending_request: 'none' }))
      setFollowerCount((c) => c + 1)
      api.getFriends().then((list: any) => setFriendList(list || [])).catch(() => {})
    } catch {}
  }

  const handleRejectRequest = async (reqId: string) => {
    try {
      await api.rejectFriendRequest(reqId)
      setPendingRequests((p) => p.filter((r) => r.id !== reqId))
      setRelationship((r) => ({ ...r, pending_request: 'none' }))
    } catch {}
  }

  const handleRemoveFriend = () => {
    if (!profile) return
    setConfirm({ open: true, title: '解除好友', desc: '确定解除好友关系？', variant: 'destructive', action: async () => {
      try {
        await api.removeFriend(profile.id)
        setRelationship((r) => ({ ...r, is_friend: false }))
        setFollowerCount((c) => Math.max(0, c - 1))
        api.getFriends().then((list: any) => setFriendList(list || [])).catch(() => {})
        addToast({ title: '已解除好友关系' })
      } catch {}
    } })
  }

  const handleToggleAllow = async () => {
    const next = !allowReview
    setAllowReview(next)
    await api.updateProfile({ allow_view_review: next })
  }

  const handleSaveProfile = async () => {
    await api.updateProfile({ signature, avatar_url: avatarUrl, background_url: profile?.background_url })
    setEditing(false)
    setProfile((p) => p ? { ...p, signature, avatar_url: avatarUrl } : null)
  }

  const getColorLevel = (count: number) => {
    if (count === 0) return 'heatmap-0'
    if (count <= 2) return 'heatmap-1'
    if (count <= 5) return 'heatmap-2'
    if (count <= 10) return 'heatmap-3'
    return 'heatmap-4'
  }

  const heatmapData = useMemo(() => {
    const map = new Map<string, number>()
    heatmap.forEach((d) => map.set(d.date, d.count))
    return map
  }, [heatmap])

  const calendarGrid = useMemo(() => {
    const now = new Date()
    const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const startDate = new Date(endDate)
    startDate.setDate(startDate.getDate() - 364)

    // Align start to Sunday
    while (startDate.getDay() !== 0) startDate.setDate(startDate.getDate() - 1)

    const weeks: { date: Date; count: number }[][] = []
    const months: { label: string; col: number }[] = []
    const d = new Date(startDate)
    let week: { date: Date; count: number }[] = []
    let lastMonth = -1

    while (d <= endDate) {
      const ds = d.toISOString().slice(0, 10)
      const count = heatmapData.get(ds) || 0
      if (d.getDay() === 0 && week.length > 0) { weeks.push(week); week = [] }
      week.push({ date: new Date(d), count })
      const m = d.getMonth()
      if (m !== lastMonth) { months.push({ label: `${d.getMonth() + 1}月`, col: weeks.length }); lastMonth = m }
      d.setDate(d.getDate() + 1)
    }
    if (week.length > 0) weeks.push(week)

    return { weeks, months }
  }, [heatmapData])

  const dayLabels = ['', '一', '', '三', '', '五', '']

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  const displayName = profile.nickname || profile.cf_handle || profile.github_login
  const subtitle = profile.cf_handle ? `${profile.github_login} · ${profile.cf_handle}` : profile.github_login

  return (
    <div className="-mx-4 -mt-6">
      {profile.background_url && (
        <div className="fixed inset-0 z-0">
          <img src={profile.background_url} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-background/40" />
        </div>
      )}
      <div className="relative z-10 space-y-4 sm:space-y-6 max-w-4xl mx-auto px-0 sm:px-4 pt-2 sm:pt-6">
      <div className="relative">
        {profile.background_url && (
          <div className="rounded-lg overflow-hidden h-44 -mx-4 opacity-0 pointer-events-none">
            <img src={profile.background_url} alt="" className="w-full h-full object-cover" />
          </div>
        )}
        <Card className={profile.background_url ? '' : ''}>
          <CardContent className="py-6">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
              <div className="h-24 w-24 rounded-full border-4 border-background bg-accent overflow-hidden shrink-0">
                <img
                  src={profile.avatar_url || `https://avatars.githubusercontent.com/${profile.github_login}`}
                  alt=""
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="flex-1 text-center sm:text-left space-y-2">
                <h1 className="text-2xl font-bold">{displayName}</h1>
                <p className="text-sm text-muted-foreground">{subtitle}</p>
                {profile.signature && !editing && (
                  <p className="text-sm text-muted-foreground italic">{profile.signature}</p>
                )}
                {editing && (
                  <div className="space-y-2">
                    <input
                      value={signature}
                      onChange={(e) => setSignature(e.target.value)}
                      placeholder="签名"
                      className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                    />
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">头像</p>
                      <div className="flex gap-2">
                        <input
                          value={avatarUrl}
                          onChange={(e) => setAvatarUrl(e.target.value)}
                          placeholder="头像 URL"
                          className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                        />
                        <label className="cursor-pointer inline-flex items-center rounded-md border border-input px-3 py-1.5 text-xs hover:bg-accent transition-colors">
                          本地上传
                          <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                            const f = e.target.files?.[0]; if (!f) return
                            try { const url = await api.uploadFile(f); setAvatarUrl(url) } catch {}
                          }} />
                        </label>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">背景图</p>
                      <div className="flex gap-2">
                        <input
                          value={profile.background_url}
                          onChange={(e) => setProfile({ ...profile, background_url: e.target.value })}
                          placeholder="背景图 URL (留空则使用默认渐变)"
                          className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                        />
                        <label className="cursor-pointer inline-flex items-center rounded-md border border-input px-3 py-1.5 text-xs hover:bg-accent transition-colors">
                          本地上传
                          <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                            const f = e.target.files?.[0]; if (!f) return
                            try { const url = await api.uploadFile(f); setProfile({ ...profile, background_url: url }) } catch {}
                          }} />
                        </label>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleSaveProfile}>保存</Button>
                      <Button size="sm" variant="outline" onClick={() => setEditing(false)}>取消</Button>
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-center sm:justify-start gap-3 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{formatDate(profile.created_at)} 加入</span>
                  <button onClick={loadFollowers} className="flex items-center gap-1 hover:text-foreground transition-colors">
                    <Users className="h-3.5 w-3.5" />{followerCount} 粉丝
                  </button>
                  <button onClick={loadFollowing} className="flex items-center gap-1 hover:text-foreground transition-colors">
                    {followingCount} 关注
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {!isMe && me && (
                  <>
                    {relationship.is_friend ? (
                      <Button variant="outline" size="sm" onClick={handleRemoveFriend}>
                        <UserCheck className="h-4 w-4 mr-1" /> 好友
                      </Button>
                    ) : relationship.pending_request === 'incoming' ? (
                      <>
                        <Button size="sm" onClick={() => {
                          const req = pendingRequests.find((r) => r.sender_id === profile?.id)
                          if (req) handleAcceptRequest(req.id)
                        }}>
                          <Check className="h-4 w-4 mr-1" /> 接受好友请求
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => {
                          const req = pendingRequests.find((r) => r.sender_id === profile?.id)
                          if (req) handleRejectRequest(req.id)
                        }}>
                          <X className="h-4 w-4 mr-1" /> 拒绝
                        </Button>
                      </>
                    ) : relationship.pending_request === 'outgoing' ? (
                      <Button variant="outline" size="sm" disabled>
                        <Clock className="h-4 w-4 mr-1" /> 已发送请求
                      </Button>
                    ) : (
                      <Button size="sm" onClick={handleSendRequest}>
                        <UserPlus className="h-4 w-4 mr-1" /> 加为好友
                      </Button>
                    )}
                    {relationship.is_following ? (
                      <Button variant="outline" size="sm" onClick={handleUnfollow}>
                        <UserCheck className="h-4 w-4 mr-1" /> 已关注
                      </Button>
                    ) : (
                      <Button variant="ghost" size="sm" onClick={handleFollow}>
                        <UserPlus className="h-4 w-4 mr-1" /> 关注
                      </Button>
                    )}
                  </>
                )}
                {isMe && !editing && (
                  <Button variant="outline" size="sm" onClick={() => { setSignature(profile.signature); setAvatarUrl(profile.avatar_url); setEditing(true) }}>
                    编辑
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {profile.cf_handle && (
        <Card>
          <CardContent className="py-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            {[
              { label: 'Rating', value: profile.cf_rating, color: 'text-primary' },
              { label: 'Max Rating', value: profile.cf_max_rating, color: 'text-amber-400' },
              { label: 'Rank', value: profile.cf_rank, color: 'text-emerald-400' },
            ].map((s) => (
              <div key={s.label}>
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className={`text-lg font-bold font-mono capitalize ${s.color}`}>{s.value}</p>
              </div>
            ))}
            <div>
              <p className="text-xs text-muted-foreground">Handle</p>
              <a href={`https://codeforces.com/profile/${profile.cf_handle}`} target="_blank" className="text-lg font-bold font-mono text-primary hover:underline">
                {profile.cf_handle}
              </a>
            </div>
          </CardContent>
        </Card>
      )}

      {isMe && !profile.cf_handle && (
        <Card className="border-primary/30">
          <CardContent className="py-6 space-y-3">
            <p className="text-sm font-medium">绑定 Codeforces 账号</p>
            <p className="text-xs text-muted-foreground">绑定后可同步提交记录、显示 Rating 数据和热力图</p>
            <div className="flex gap-2">
              <input
                value={bindHandle}
                onChange={(e) => setBindHandle(e.target.value)}
                placeholder="输入你的 CF Handle"
                className="flex-1 h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                onKeyDown={(e) => e.key === 'Enter' && handleBindCF()}
              />
              <Button onClick={handleBindCF} disabled={binding || !bindHandle.trim()}>
                {binding ? '绑定中...' : '绑定'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {topTags.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">主攻方向</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {topTags.map((t) => (
                <Badge key={t} className="px-3 py-1">{t}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {stats && (stats.total_entries > 0) && (
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><BarChart3 className="h-4 w-4 text-primary" />做题统计</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-xs text-muted-foreground">已补题</p>
                <p className="text-xl font-bold text-emerald-400">{stats.total_solved}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">尝试中</p>
                <p className="text-xl font-bold text-amber-400">{stats.total_attempted}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">近7天</p>
                <p className="text-xl font-bold text-blue-400">{stats.recent_solves}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">连续天数</p>
                <p className="text-xl font-bold text-orange-400">{stats.streak_days} 天</p>
              </div>
            </div>
            {stats.platforms && stats.platforms.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-2">平台分布</p>
                <div className="flex flex-wrap gap-2">
                  {stats.platforms.map((p: any) => (
                    <Badge key={p.platform} variant="outline" className="text-xs">
                      {p.platform}: {p.count}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {stats.top_tags && stats.top_tags.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-2">高频标签</p>
                <div className="flex flex-wrap gap-2">
                  {stats.top_tags.slice(0, 8).map((t: any) => (
                    <Badge key={t.tag} variant="secondary" className="text-xs">
                      {t.tag} ({t.count})
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {isMe && (
        <Card>
          <CardHeader><CardTitle className="text-base">隐私设置</CardTitle></CardHeader>
          <CardContent className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">允许关注者查看补题记录</p>
              <p className="text-xs text-muted-foreground">开启后，关注你的人可以查看你的补题列表（不可修改）</p>
            </div>
            <button
              onClick={handleToggleAllow}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${allowReview ? 'bg-primary' : 'bg-muted'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${allowReview ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </CardContent>
        </Card>
      )}

      {isMe && pendingRequests.length > 0 && (
        <Card className="border-amber-500/30">
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Clock className="h-4 w-4 text-amber-400" />等待确认的好友请求</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {pendingRequests.map((r: any) => (
              <div key={r.id} className="flex items-center gap-3 p-2 rounded hover:bg-accent transition-colors">
                <a href={`/profile/${r.sender_id}`} className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="h-8 w-8 rounded-full bg-accent overflow-hidden shrink-0">
                    <img src={r.avatar_url} alt="" className="h-full w-full object-cover" />
                  </div>
                  <span className="text-sm font-medium truncate">{r.nickname || r.cf_handle || r.sender_id.slice(0, 8)}</span>
                  <span className="text-xs text-muted-foreground">{timeAgo(r.created_at)}</span>
                </a>
                <Button size="sm" onClick={() => handleAcceptRequest(r.id)}><Check className="h-3 w-3 mr-1" />接受</Button>
                <Button size="sm" variant="outline" onClick={() => handleRejectRequest(r.id)}><X className="h-3 w-3 mr-1" />拒绝</Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {isMe && friendList.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><UserCheck className="h-4 w-4 text-emerald-400" />好友 ({friendList.length})</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {friendList.map((f: any) => (
              <a key={f.id} href={`/profile/${f.id}`} className="flex items-center gap-3 p-2 rounded hover:bg-accent transition-colors">
                <div className="h-8 w-8 rounded-full bg-accent overflow-hidden shrink-0">
                  <img src={f.avatar_url} alt="" className="h-full w-full object-cover" />
                </div>
                <span className="text-sm font-medium">{f.nickname || f.cf_handle || f.id.slice(0, 8)}</span>
                {f.cf_rating > 0 && <span className="text-xs text-muted-foreground font-mono">({f.cf_rating})</span>}
              </a>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Flame className="h-4 w-4 text-orange-400" />做题热力图</CardTitle></CardHeader>
        <CardContent>
          {heatmap.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              {isMe ? '同步 CF 提交数据后即可显示热力图' : '暂无做题数据'}
            </p>
          ) : (
            <div className="overflow-x-auto -mx-1 px-1 pb-2">
              <div className="flex gap-2 sm:gap-4 min-w-fit">
                <div className="hidden sm:flex flex-col gap-0.5 pt-5 text-[10px] text-muted-foreground shrink-0">
                  {dayLabels.map((l, i) => <div key={i} className="h-[11px] leading-[11px]">{l}</div>)}
                </div>
                <div>
                  <div className="flex mb-1 text-[10px] text-muted-foreground ml-0.5">
                    {calendarGrid.months.map((m, i) => (
                      <div key={i} style={{ marginLeft: i === 0 ? 0 : (m.col - (calendarGrid.months[i-1]?.col || 0) - 1) * 13, width: 13 }}>{m.label}</div>
                    ))}
                  </div>
                  <div className="flex gap-0.5">
                    {calendarGrid.weeks.map((week, wi) => (
                      <div key={wi} className="flex flex-col gap-0.5">
                        {week.map((day, di) => (
                          <div
                            key={di}
                            title={`${day.date.toLocaleDateString('zh-CN')}: ${day.count} 题`}
                            className={`w-[11px] h-[11px] rounded-sm ${getColorLevel(day.count)}`}
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-1 mt-2 text-[10px] text-muted-foreground">
                    <span>少</span>
                    <div className="w-[11px] h-[11px] rounded-sm heatmap-0" />
                    <div className="w-[11px] h-[11px] rounded-sm heatmap-1" />
                    <div className="w-[11px] h-[11px] rounded-sm heatmap-2" />
                    <div className="w-[11px] h-[11px] rounded-sm heatmap-3" />
                    <div className="w-[11px] h-[11px] rounded-sm heatmap-4" />
                    <span>多</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {tab === 'followers' && (
        <Card>
          <CardHeader><CardTitle className="text-base">粉丝</CardTitle></CardHeader>
          <CardContent>
            {followerList.length === 0 ? (
              <p className="text-sm text-muted-foreground">暂无粉丝</p>
            ) : (
              <div className="space-y-2">
                {followerList.map((u) => (
                  <a key={u.id} href={`/profile/${u.id}`} className="flex items-center gap-3 p-2 rounded hover:bg-accent transition-colors">
                    <div className="h-8 w-8 rounded-full bg-accent overflow-hidden">
                      <img src={u.avatar_url} alt="" className="h-full w-full object-cover" />
                    </div>
                    <span className="text-sm font-medium">{u.nickname || u.cf_handle || u.id.slice(0, 8)}</span>
                    {u.cf_rating > 0 && <span className="text-xs text-muted-foreground font-mono">({u.cf_rating})</span>}
                  </a>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {tab === 'following' && (
        <Card>
          <CardHeader><CardTitle className="text-base">关注</CardTitle></CardHeader>
          <CardContent>
            {followingList.length === 0 ? (
              <p className="text-sm text-muted-foreground">未关注任何人</p>
            ) : (
              <div className="space-y-2">
                {followingList.map((u) => (
                  <a key={u.id} href={`/profile/${u.id}`} className="flex items-center gap-3 p-2 rounded hover:bg-accent transition-colors">
                    <div className="h-8 w-8 rounded-full bg-accent overflow-hidden">
                      <img src={u.avatar_url} alt="" className="h-full w-full object-cover" />
                    </div>
                    <span className="text-sm font-medium">{u.nickname || u.cf_handle || u.id.slice(0, 8)}</span>
                    {u.cf_rating > 0 && <span className="text-xs text-muted-foreground font-mono">({u.cf_rating})</span>}
                  </a>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
      </div>

      <ConfirmDialog
        open={confirm.open}
        onOpenChange={(v) => { if (!v) setConfirm({ ...confirm, open: false }) }}
        title={confirm.title}
        description={confirm.desc}
        onConfirm={confirm.action}
        variant={confirm.variant}
      />
    </div>
  )
}
