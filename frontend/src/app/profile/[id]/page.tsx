'use client'

import { useState, useEffect, useMemo } from 'react'
import { useParams } from 'next/navigation'
import { api } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { Card, CardContent, CardHeader, CardTitle, Badge, Button } from '@/components/ui/base'
import { RatingBadge } from '@/components/ui/rating-badge'
import { EmptyState } from '@/components/ui/empty-state'
import { ratingNextTier, ratingTier, ratingTierStart } from '@/lib/rating'
import { useToast } from '@/components/ui/toaster'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Calendar, Check, Clock, Flame, Lock, Trophy, UserCheck, UserPlus, Users, X } from 'lucide-react'
import { formatDate, timeAgo } from '@/lib/utils'
import { RemoteImage } from '@/components/ui/remote-image'
import { buildHeatmapCalendar, type HeatmapDay } from '@/lib/heatmap'

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

function Stat({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border/70 bg-card/50 p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <div className="mt-1.5 text-xl font-semibold tabular-nums">{children}</div>
      {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  )
}

function UserRow({ user, action }: { user: SocialUser; action?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-accent/60">
      <a href={`/profile/${user.id}`} className="flex min-w-0 flex-1 items-center gap-3">
        <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full border border-border/60 bg-accent">
          <RemoteImage src={user.avatar_url} alt={user.nickname || user.cf_handle || ''} />
        </div>
        <span className="truncate text-sm font-medium">{user.nickname || user.cf_handle || user.id.slice(0, 8)}</span>
      </a>
      {user.cf_rating > 0 && <RatingBadge rating={user.cf_rating} />}
      {action}
    </div>
  )
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
    }).catch((e) => console.error('[profile] load failed', e))
    api.getUserHeatmap(id).then(setHeatmap).catch((e) => console.error('[profile] heatmap load failed', e))
    if (isMe) {
      api.getPendingRequests().then((list: any) => setPendingRequests(list || [])).catch((e) => console.error('[profile] pending requests load failed', e))
      api.getFriends().then((list: any) => setFriendList(list || [])).catch((e) => console.error('[profile] friends load failed', e))
    }
  }, [params.id, isMe])

  const handleFollow = async () => {
    if (!profile) return
    try {
      await api.follow(profile.id)
      setRelationship((r) => ({ ...r, is_following: true }))
      setFollowerCount((c) => c + 1)
    } catch (e) {
      addToast({ title: '关注失败', description: (e as Error).message, variant: 'destructive' })
    }
  }

  const handleUnfollow = async () => {
    if (!profile) return
    try {
      await api.unfollow(profile.id)
      setRelationship((r) => ({ ...r, is_following: false }))
      setFollowerCount((c) => Math.max(0, c - 1))
    } catch (e) {
      addToast({ title: '取关失败', description: (e as Error).message, variant: 'destructive' })
    }
  }

  const loadFollowers = async () => {
    const id = params.id as string
    api.getFollowers(id).then((list: any) => setFollowerList(list || [])).catch((e) => console.error('[profile] followers load failed', e))
    setTab('followers')
  }

  const loadFollowing = async () => {
    const id = params.id as string
    api.getFollowing(id).then((list: any) => setFollowingList(list || [])).catch((e) => console.error('[profile] following load failed', e))
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
      api.getFriends().then((list: any) => setFriendList(list || [])).catch((e) => console.error('[profile] friends load failed', e))
    } catch (e) {
      addToast({ title: '接受请求失败', description: (e as Error).message, variant: 'destructive' })
    }
  }

  const handleRejectRequest = async (reqId: string) => {
    try {
      await api.rejectFriendRequest(reqId)
      setPendingRequests((p) => p.filter((r) => r.id !== reqId))
      setRelationship((r) => ({ ...r, pending_request: 'none' }))
    } catch (e) {
      addToast({ title: '拒绝请求失败', description: (e as Error).message, variant: 'destructive' })
    }
  }

  const handleRemoveFriend = () => {
    if (!profile) return
    setConfirm({ open: true, title: '解除好友', desc: '确定解除好友关系？', variant: 'destructive', action: async () => {
      try {
        await api.removeFriend(profile.id)
        setRelationship((r) => ({ ...r, is_friend: false }))
        setFollowerCount((c) => Math.max(0, c - 1))
        api.getFriends().then((list: any) => setFriendList(list || [])).catch((e) => console.error('[profile] friends load failed', e))
        addToast({ title: '已解除好友关系' })
      } catch (e) {
        addToast({ title: '解除好友失败', description: (e as Error).message, variant: 'destructive' })
      }
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

  const calendar = useMemo(() => buildHeatmapCalendar(heatmap), [heatmap])
  const dayLabels = ['', '一', '', '三', '', '五', '']

  if (!profile) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  const displayName = profile.nickname || profile.cf_handle || profile.github_login
  const tier = ratingTier(profile.cf_rating)
  const tierStart = ratingTierStart(profile.cf_rating)
  const nextTier = ratingNextTier(profile.cf_rating)
  const tierPct = nextTier
    ? Math.min(100, Math.round(((profile.cf_rating - tierStart) / (nextTier.min - tierStart)) * 100))
    : 100

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl border border-border/80 bg-card/60">
        {profile.background_url ? (
          <div aria-hidden className="absolute inset-0">
            <RemoteImage src={profile.background_url} className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-b from-card/50 via-card/85 to-card" />
          </div>
        ) : (
          <>
            <div aria-hidden className="arena-grid absolute inset-0 opacity-70" />
            <div aria-hidden className="arena-glow absolute inset-0 opacity-70" />
          </>
        )}

        <div className="relative flex flex-col gap-5 p-5 sm:flex-row sm:items-start sm:p-6">
          <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-border/80 bg-accent shadow-lg sm:h-24 sm:w-24">
            <RemoteImage
              src={profile.avatar_url || `https://avatars.githubusercontent.com/${profile.github_login}`}
              alt={displayName}
            />
          </div>

          <div className="min-w-0 flex-1 space-y-2.5">
            <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-muted-foreground">player</p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <h1 className="text-2xl font-semibold tracking-tight">{displayName}</h1>
              {profile.cf_rating > 0 && <RatingBadge rating={profile.cf_rating} />}
            </div>
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
              <span className="font-mono">@{profile.github_login}</span>
              {profile.cf_handle && profile.cf_handle.toLowerCase() !== profile.github_login.toLowerCase() && (
                <>
                  <span aria-hidden>·</span>
                  <a
                    href={`https://codeforces.com/profile/${profile.cf_handle}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-primary hover:underline"
                  >
                    {profile.cf_handle}
                  </a>
                </>
              )}
            </p>
            {profile.signature && !editing && (
              <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">{profile.signature}</p>
            )}
            {!editing && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  {formatDate(profile.created_at)} 加入
                </span>
                <button type="button" onClick={loadFollowers} className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground">
                  <Users className="h-3.5 w-3.5" />
                  <span className="font-mono tabular-nums">{followerCount}</span> 粉丝
                </button>
                <button type="button" onClick={loadFollowing} className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground">
                  <span className="font-mono tabular-nums">{followingCount}</span> 关注
                </button>
              </div>
            )}
            {editing && (
              <div className="max-w-md space-y-3 pt-1">
                <div>
                  <p className="mb-1 text-xs text-muted-foreground">签名</p>
                  <input
                    value={signature}
                    onChange={(e) => setSignature(e.target.value)}
                    placeholder="一句话介绍自己"
                    className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div>
                  <p className="mb-1 text-xs text-muted-foreground">头像</p>
                  <div className="flex gap-2">
                    <input
                      value={avatarUrl}
                      onChange={(e) => setAvatarUrl(e.target.value)}
                      placeholder="头像 URL"
                      className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    <label className="cursor-pointer inline-flex items-center rounded-md border border-input px-3 py-1.5 text-xs transition-colors hover:bg-accent">
                      本地上传
                      <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                        const f = e.target.files?.[0]; if (!f) return
                        try { const url = await api.uploadFile(f); setAvatarUrl(url) } catch (e) { addToast({ title: '头像上传失败', description: (e as Error).message, variant: 'destructive' }) }
                      }} />
                    </label>
                  </div>
                </div>
                <div>
                  <p className="mb-1 text-xs text-muted-foreground">背景图</p>
                  <div className="flex gap-2">
                    <input
                      value={profile.background_url}
                      onChange={(e) => setProfile({ ...profile, background_url: e.target.value })}
                      placeholder="留空则使用默认渐变"
                      className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    <label className="cursor-pointer inline-flex items-center rounded-md border border-input px-3 py-1.5 text-xs transition-colors hover:bg-accent">
                      本地上传
                      <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                        const f = e.target.files?.[0]; if (!f) return
                        try { const url = await api.uploadFile(f); setProfile({ ...profile, background_url: url }) } catch (e) { addToast({ title: '背景上传失败', description: (e as Error).message, variant: 'destructive' }) }
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
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2 sm:flex-col sm:items-stretch">
            {!isMe && me && (
              <>
                {relationship.is_friend ? (
                  <Button variant="outline" size="sm" onClick={handleRemoveFriend}>
                    <UserCheck className="mr-1 h-4 w-4" /> 好友
                  </Button>
                ) : relationship.pending_request === 'incoming' ? (
                  <>
                    <Button size="sm" onClick={() => {
                      const req = pendingRequests.find((r) => r.sender_id === profile?.id)
                      if (req) handleAcceptRequest(req.id)
                    }}>
                      <Check className="mr-1 h-4 w-4" /> 接受好友请求
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => {
                      const req = pendingRequests.find((r) => r.sender_id === profile?.id)
                      if (req) handleRejectRequest(req.id)
                    }}>
                      <X className="mr-1 h-4 w-4" /> 拒绝
                    </Button>
                  </>
                ) : relationship.pending_request === 'outgoing' ? (
                  <Button variant="outline" size="sm" disabled>
                    <Clock className="mr-1 h-4 w-4" /> 已发送请求
                  </Button>
                ) : (
                  <Button size="sm" onClick={handleSendRequest}>
                    <UserPlus className="mr-1 h-4 w-4" /> 加为好友
                  </Button>
                )}
                {relationship.is_following ? (
                  <Button variant="outline" size="sm" onClick={handleUnfollow}>
                    <UserCheck className="mr-1 h-4 w-4" /> 已关注
                  </Button>
                ) : (
                  <Button variant="ghost" size="sm" onClick={handleFollow}>
                    <UserPlus className="mr-1 h-4 w-4" /> 关注
                  </Button>
                )}
              </>
            )}
            {isMe && !editing && (
              <Button variant="outline" size="sm" onClick={() => { setSignature(profile.signature); setAvatarUrl(profile.avatar_url); setEditing(true) }}>
                编辑资料
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* Stats */}
      {profile.cf_handle ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="rating" hint={tier.label}>
            <span className={tier.text}>{profile.cf_rating}</span>
          </Stat>
          <Stat label="max rating" hint={ratingTier(profile.cf_max_rating).label}>
            <span className={ratingTier(profile.cf_max_rating).text}>{profile.cf_max_rating}</span>
          </Stat>
          <Stat label="rank" hint="Codeforces">
            <span className="text-base capitalize text-emerald-400">{profile.cf_rank}</span>
          </Stat>
          <Stat label="handle" hint="在 Codeforces 查看">
            <a
              href={`https://codeforces.com/profile/${profile.cf_handle}`}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-base text-primary hover:underline"
            >
              {profile.cf_handle}
            </a>
          </Stat>
        </div>
      ) : isMe ? (
        <Card className="border-primary/30">
          <CardContent className="space-y-3 py-6">
            <p className="flex items-center gap-2 text-sm font-medium">
              <Trophy className="h-4 w-4 text-amber-400" />
              绑定 Codeforces 账号
            </p>
            <p className="text-xs text-muted-foreground">绑定后可同步提交记录、显示 Rating 数据和热力图</p>
            <div className="flex max-w-md gap-2">
              <input
                value={bindHandle}
                onChange={(e) => setBindHandle(e.target.value)}
                placeholder="输入你的 CF Handle"
                className="h-10 min-w-0 flex-1 rounded-md border border-input bg-background px-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                onKeyDown={(e) => e.key === 'Enter' && handleBindCF()}
              />
              <Button onClick={handleBindCF} disabled={binding || !bindHandle.trim()}>
                {binding ? '绑定中...' : '绑定'}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Main grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Flame className="h-4 w-4 text-orange-400" />
                  做题热力图
                </CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">最近 365 天</p>
              </div>
              {heatmap.length > 0 && (
                <div className="flex shrink-0 gap-5 text-right">
                  <div>
                    <p className="font-mono text-base tabular-nums">{calendar.solved}</p>
                    <p className="text-[10px] text-muted-foreground">题</p>
                  </div>
                  <div>
                    <p className="font-mono text-base tabular-nums">{calendar.active}</p>
                    <p className="text-[10px] text-muted-foreground">活跃天</p>
                  </div>
                </div>
              )}
            </CardHeader>
            <CardContent>
              {heatmap.length === 0 ? (
                <EmptyState
                  icon={Flame}
                  title={isMe ? '还没有做题数据' : '暂无做题数据'}
                  description={isMe ? '在补题页同步一次 CF 提交，这张图就会亮起来。' : undefined}
                  className="border-0 bg-transparent py-10"
                />
              ) : (
                <div className="-mx-1 overflow-x-auto px-1 pb-2">
                  <div className="flex min-w-fit gap-2 sm:gap-4">
                    <div className="hidden shrink-0 flex-col gap-0.5 pt-5 text-[10px] text-muted-foreground sm:flex">
                      {dayLabels.map((l, i) => <div key={i} className="h-[11px] leading-[11px]">{l}</div>)}
                    </div>
                    <div>
                      <div className="mb-1 ml-0.5 flex text-[10px] text-muted-foreground">
                        {calendar.months.map((m, i) => {
                          // Each label box is two cells wide; the margin keeps the box
                          // aligned to the column where that month starts.
                          const prev = i === 0 ? 0 : (calendar.months[i - 1]?.col || 0)
                          const margin = Math.max(0, (m.col - prev) * 13 - (i === 0 ? 0 : 26))
                          return (
                            <div key={i} className="w-[26px] shrink-0 whitespace-nowrap" style={{ marginLeft: margin }}>
                              {m.label}
                            </div>
                          )
                        })}
                      </div>
                      <div className="flex gap-0.5">
                        {calendar.weeks.map((week, wi) => (
                          <div key={wi} className="flex flex-col gap-0.5">
                            {week.map((day, di) => (
                              <div
                                key={di}
                                title={`${day.date.toLocaleDateString('zh-CN')}: ${day.count} 题`}
                                className={`h-[11px] w-[11px] rounded-sm ${getColorLevel(day.count)}`}
                              />
                            ))}
                          </div>
                        ))}
                      </div>
                      <div className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground">
                        <span>少</span>
                        <div className="h-[11px] w-[11px] rounded-sm heatmap-0" />
                        <div className="h-[11px] w-[11px] rounded-sm heatmap-1" />
                        <div className="h-[11px] w-[11px] rounded-sm heatmap-2" />
                        <div className="h-[11px] w-[11px] rounded-sm heatmap-3" />
                        <div className="h-[11px] w-[11px] rounded-sm heatmap-4" />
                        <span>多</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {topTags.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">主攻方向</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {topTags.map((t) => (
                    <Badge key={t} className="border-violet-500/30 bg-violet-500/10 px-3 py-1 font-mono text-violet-300">
                      {t}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {tab === 'followers' && (
            <Card>
              <CardHeader><CardTitle className="text-base">粉丝</CardTitle></CardHeader>
              <CardContent className="space-y-1">
                {followerList.length === 0 ? (
                  <p className="text-sm text-muted-foreground">暂无粉丝</p>
                ) : (
                  followerList.map((u) => <UserRow key={u.id} user={u} />)
                )}
              </CardContent>
            </Card>
          )}

          {tab === 'following' && (
            <Card>
              <CardHeader><CardTitle className="text-base">关注</CardTitle></CardHeader>
              <CardContent className="space-y-1">
                {followingList.length === 0 ? (
                  <p className="text-sm text-muted-foreground">未关注任何人</p>
                ) : (
                  followingList.map((u) => <UserRow key={u.id} user={u} />)
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <aside className="space-y-4">
          {profile.cf_rating > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Trophy className="h-4 w-4 text-amber-400" />
                  段位
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-baseline justify-between">
                  <span className={`text-sm font-medium ${tier.text}`}>{tier.label}</span>
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">
                    {nextTier ? `${profile.cf_rating} / ${nextTier.min}` : profile.cf_rating}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div className={`h-full rounded-full ${tier.bar}`} style={{ width: `${tierPct}%` }} />
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {nextTier ? `距离「${nextTier.label}」还差 ${nextTier.min - profile.cf_rating} 分` : '已经是最高段位'}
                </p>
              </CardContent>
            </Card>
          )}

          {isMe && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Lock className="h-4 w-4 text-muted-foreground" />
                  隐私设置
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">允许关注者查看补题记录</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">开启后，关注你的人可以查看你的补题列表（只读）</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={allowReview}
                    aria-label="允许关注者查看补题记录"
                    onClick={handleToggleAllow}
                    className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${allowReview ? 'bg-primary' : 'bg-muted'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${allowReview ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
              </CardContent>
            </Card>
          )}

          {isMe && pendingRequests.length > 0 && (
            <Card className="border-amber-500/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Clock className="h-4 w-4 text-amber-400" />
                  好友请求 <span className="font-mono text-xs text-muted-foreground">{pendingRequests.length}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {pendingRequests.map((r: any) => (
                  <div key={r.id} className="rounded-lg border border-border/60 p-2">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 shrink-0 overflow-hidden rounded-full bg-accent">
                        <RemoteImage src={r.avatar_url} alt={r.nickname || r.cf_handle || ''} />
                      </div>
                      <a href={`/profile/${r.sender_id}`} className="min-w-0 flex-1 truncate text-sm font-medium hover:underline">
                        {r.nickname || r.cf_handle || r.sender_id.slice(0, 8)}
                      </a>
                      <span className="shrink-0 text-[11px] text-muted-foreground">{timeAgo(r.created_at)}</span>
                    </div>
                    <div className="mt-2 flex gap-2">
                      <Button size="sm" className="h-7 flex-1 text-xs" onClick={() => handleAcceptRequest(r.id)}>
                        <Check className="mr-1 h-3 w-3" />接受
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 flex-1 text-xs" onClick={() => handleRejectRequest(r.id)}>
                        <X className="mr-1 h-3 w-3" />拒绝
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {isMe && friendList.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <UserCheck className="h-4 w-4 text-emerald-400" />
                  好友 <span className="font-mono text-xs text-muted-foreground">{friendList.length}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-0.5">
                {friendList.map((f: any) => <UserRow key={f.id} user={f} />)}
              </CardContent>
            </Card>
          )}

          {!isMe && (
            <Card>
              <CardHeader><CardTitle className="text-base">社交</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <div className="flex items-center justify-between">
                  <span>粉丝</span>
                  <span className="font-mono tabular-nums">{followerCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>关注</span>
                  <span className="font-mono tabular-nums">{followingCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>关系</span>
                  <span>{relationship.is_friend ? '好友' : relationship.is_following ? '已关注' : '无'}</span>
                </div>
              </CardContent>
            </Card>
          )}
        </aside>
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
