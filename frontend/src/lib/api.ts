const API_BASE = '/api'

// ---------------------------------------------------------------------------
// Shared API entity types
// ---------------------------------------------------------------------------

export interface ApiUser {
  id: string
  github_login: string
  github_avatar_url: string
  cf_handle: string | null
  cf_rating: number
  cf_max_rating: number
  cf_rank: string
  nickname: string | null
  signature: string
  avatar_url: string
  background_url: string
  role: string
  allow_view_review: boolean
  top_tags: string[]
  created_at: string
}

export interface ApiContest {
  platform: string
  contest_name: string
  start_time: string
  end_time: string
  duration: number
  url: string
}

export interface ApiProblem {
  contest_id: number
  problem_index: string
  name: string
  rating: number
  tags: string[]
  solved_count: number
}

export interface ApiProblemSearchResult {
  items: ApiProblem[]
  total: number
}

export interface ApiTag {
  tag_key: string
  tag_zh: string
}

export interface ApiReviewEntry {
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
  solution_url: string
  notes: string
  created_at: string
  completed_at: string | null
}

export interface ApiReviewTagStat {
  tag: string
  total: number
  solved: number
}

export interface ApiDailyResult {
  message?: string
  candidates?: ApiReviewEntry[]
}

export interface ApiUserContest {
  id: string
  platform: string
  contest_id: string
  contest_name: string
  contest_url: string
  created_at: string
}

export interface ApiHeatmapDay {
  date: string
  count: number
}

export interface ApiSocialUser {
  id: string
  nickname: string | null
  cf_handle: string | null
  cf_rating: number
  avatar_url: string
}

export interface ApiFriendRequest {
  id: string
  sender_id?: string
  receiver_id?: string
  nickname: string | null
  cf_handle: string | null
  avatar_url: string
  created_at: string
}

export interface ApiRelationship {
  is_following: boolean
  is_friend: boolean
  pending_request: 'none' | 'incoming' | 'outgoing'
}

export interface ApiUserProfileResult {
  user: ApiUser
  heatmap?: ApiHeatmapDay[]
  top_tags?: string[]
  follower_count?: number
  following_count?: number
  relationship?: ApiRelationship
}

export interface ApiSnippet {
  id: string
  user_id: string | null
  name: string
  language: string
  code: string
  category: string
  description: string
  is_builtin: boolean
}

export interface ApiSolveDetail {
  platform: string
  contest_id: string
  problem_index: string
  problem_name: string
  tags: string[]
}

export interface ApiCFAcceptDetail {
  contest_id: number
  problem_index: string
  language: string
}

export interface ApiFeedUser {
  id: string
  nickname: string | null
  cf_handle: string | null
  avatar_url: string
}

export interface ApiFeedItem {
  type: 'solve' | 'cf_accept'
  user: ApiFeedUser
  detail: ApiSolveDetail | ApiCFAcceptDetail
  created_at: string
}

// ---------------------------------------------------------------------------
// Core request helper
// ---------------------------------------------------------------------------

/**
 * Every failure carries the HTTP status so callers can tell "the server said
 * you are not logged in" apart from "the network hiccuped" -- wiping the token
 * on a timeout logs people out for no reason.
 */
export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export function isUnauthorized(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401
}

const AUTH_EXPIRED_EVENT = 'auth:expired'

function clearExpiredSession() {
  if (typeof window === 'undefined') return
  localStorage.removeItem('token')
  window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT))
}

/** Lets AuthProvider react to a token the API already rejected. */
export function onAuthExpired(handler: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener(AUTH_EXPIRED_EVENT, handler)
  return () => window.removeEventListener(AUTH_EXPIRED_EVENT, handler)
}

async function readJson(res: Response): Promise<{ code?: unknown; message?: unknown; data?: unknown } | null> {
  const text = await res.text()
  if (!text) return null
  try {
    return JSON.parse(text) as { code?: unknown; message?: unknown; data?: unknown }
  } catch {
    // A proxy or load balancer answering with an HTML error page used to surface
    // as "Unexpected token <" in the console.
    return null
  }
}

async function request<T>(url: string, options?: RequestInit & { timeoutMs?: number }): Promise<T> {
  const { timeoutMs = 20000, ...fetchOptions } = options ?? {}
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  let res: Response
  try {
    res = await fetch(`${API_BASE}${url}`, {
      ...fetchOptions,
      signal: ctrl.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...fetchOptions?.headers,
      },
    })
  } catch (e: unknown) {
    if (e instanceof Error && e.name === 'AbortError') throw new Error('请求超时，请稍后重试')
    throw e
  } finally {
    clearTimeout(timer)
  }

  const json = await readJson(res)

  if (res.status === 401) {
    clearExpiredSession()
    const message = typeof json?.message === 'string' ? json.message : '未登录或登录已过期'
    throw new ApiError(message, 401)
  }

  if (!json) {
    throw new ApiError(
      res.ok ? '服务返回了无法解析的响应' : `请求失败（HTTP ${res.status}）`,
      res.status,
    )
  }

  if (json.code !== 0) {
    const message = typeof json.message === 'string' && json.message ? json.message : 'Request failed'
    throw new ApiError(message, res.status)
  }

  const data = json.data as T | null | undefined
  return data === null || data === undefined ? ([] as unknown as T) : data
}

export const api = {
  // Auth
  getMe: () => request<ApiUser>('/auth/me'),
  bindCF: (handle: string) => request<ApiUser>('/auth/bind-cf', { method: 'POST', body: JSON.stringify({ handle }) }),
  updateProfile: (data: Record<string, unknown>) => request<ApiUser>('/auth/profile', { method: 'PATCH', body: JSON.stringify(data) }),

  // Problems
  searchProblems: (params: Record<string, string | number>) => {
    const qs = new URLSearchParams()
    Object.entries(params).forEach(([k, v]) => { if (v) qs.set(k, String(v)) })
    return request<ApiProblemSearchResult>(`/problems/search?${qs}`)
  },
  getProblemTags: () => request<ApiTag[]>('/problems/tags'),

  // Contests
  getUpcomingContests: () => request<ApiContest[]>('/contests/upcoming'),

  // Review
  getReviewEntries: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params) : ''
    return request<ApiReviewEntry[]>(`/review${qs}`)
  },
  getReviewByTag: (tag: string) => request<ApiReviewEntry[]>(`/review/tag?tag=${encodeURIComponent(tag)}`),
  getReviewTagStats: () => request<ApiReviewTagStat[]>('/review/tags/stats'),
  getReviewEntry: (id: string) => request<ApiReviewEntry>(`/review/${id}`),
  createReviewEntry: (data: Record<string, unknown>) => request<ApiReviewEntry>('/review', { method: 'POST', body: JSON.stringify(data) }),
  updateReviewEntry: (id: string, data: Record<string, unknown>) => request<ApiReviewEntry>(`/review/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteReviewEntry: (id: string) => request<unknown>(`/review/${id}`, { method: 'DELETE' }),
  syncCFSubmissions: () => request<Record<string, unknown>>('/review/sync-cf', { method: 'POST', timeoutMs: 60000 }),
  exportReviewJSON: () => request<ApiReviewEntry[]>('/review/export/json'),
  exportReviewMarkdown: async () => {
    const token = localStorage.getItem('token')
    const res = await fetch(`${API_BASE}/review/export/markdown`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (!res.ok) {
      const j = await readJson(res)
      if (res.status === 401) clearExpiredSession()
      const msg = typeof j?.message === 'string' && j.message ? j.message : `导出失败 (${res.status})`
      throw new ApiError(msg, res.status)
    }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `algoarena-review-${new Date().toISOString().slice(0,10)}.md`
    a.click()
    URL.revokeObjectURL(url)
  },
  importReviewJSON: (data: Record<string, unknown>[]) => request<Record<string, unknown>>('/review/import/json', { method: 'POST', body: JSON.stringify(data) }),
  listContests: () => request<ApiUserContest[]>('/review/contests'),
  createContest: (data: Record<string, string>) => request<ApiUserContest>('/review/contests', { method: 'POST', body: JSON.stringify(data) }),
  updateContest: (id: string, data: Record<string, string>) => request<ApiUserContest>(`/review/contests/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteContest: (id: string) => request<unknown>(`/review/contests/${id}`, { method: 'DELETE' }),

  // Daily
  getDaily: (cooldownDays?: number) => {
    const qs = cooldownDays ? `?cooldown_days=${cooldownDays}` : ''
    return request<ApiDailyResult>(`/daily${qs}`)
  },
  completeDaily: (id: string) => request<unknown>(`/daily/${id}/complete`, { method: 'POST' }),

  // Users
  getUserProfile: (id: string) => request<ApiUserProfileResult>(`/users/${id}`),
  getUserHeatmap: (id: string) => request<ApiHeatmapDay[]>(`/users/${id}/heatmap`),
  searchUsers: (q: string) => request<ApiSocialUser[]>(`/users/search?q=${encodeURIComponent(q)}`),

  // Social
  follow: (id: string) => request<unknown>(`/social/follow/${id}`, { method: 'POST' }),
  unfollow: (id: string) => request<unknown>(`/social/follow/${id}`, { method: 'DELETE' }),
  getFollowers: (id: string) => request<ApiSocialUser[]>(`/social/${id}/followers`),
  getFollowing: (id: string) => request<ApiSocialUser[]>(`/social/${id}/following`),
  getFriendReview: (id: string) => request<ApiReviewEntry[]>(`/social/${id}/review`),
  getFriends: () => request<ApiSocialUser[]>('/social/friends'),
  getPendingRequests: () => request<ApiFriendRequest[]>('/social/friend-requests'),
  sendFriendRequest: (id: string) => request<unknown>(`/social/friend-request/${id}`, { method: 'POST' }),
  acceptFriendRequest: (id: string) => request<unknown>(`/social/friend-request/${id}/accept`, { method: 'PUT' }),
  rejectFriendRequest: (id: string) => request<unknown>(`/social/friend-request/${id}/reject`, { method: 'PUT' }),
  removeFriend: (id: string) => request<unknown>(`/social/friends/${id}`, { method: 'DELETE' }),

  // Feed
  getFeed: () => request<ApiFeedItem[]>('/feed/'),

  // Tags
  getCustomTags: () => request<ApiTag[]>('/tags/custom'),

  // Upload
  uploadFile: async (file: File): Promise<string> => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
    const form = new FormData()
    form.append('file', file)
    const res = await fetch(`${API_BASE}/upload`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    })
    const json = await readJson(res)
    if (res.status === 401) {
      clearExpiredSession()
      throw new ApiError('未登录或登录已过期', 401)
    }
    if (!json) throw new ApiError(`上传失败（HTTP ${res.status}）`, res.status)
    if (json.code !== 0) {
      throw new ApiError(typeof json.message === 'string' && json.message ? json.message : '上传失败', res.status)
    }
    return (json.data as { url: string }).url
  },

  // Snippets
  getSnippets: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params) : ''
    return request<ApiSnippet[]>(`/snippets${qs}`)
  },
  getSnippet: (id: string) => request<ApiSnippet>(`/snippets/${id}`),
  createSnippet: (data: Record<string, string>) => request<ApiSnippet>('/snippets', { method: 'POST', body: JSON.stringify(data) }),
  updateSnippet: (id: string, data: Record<string, string>) => request<ApiSnippet>(`/snippets/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteSnippet: (id: string) => request<unknown>(`/snippets/${id}`, { method: 'DELETE' }),
}