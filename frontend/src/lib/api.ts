const API_BASE = '/api'

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
  const res = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  })
  const json = await res.json()
  if (json.code !== 0) {
    throw new Error(json.message || 'Request failed')
  }
  return json.data === null || json.data === undefined ? ([] as unknown as T) : json.data
}

export const api = {
  // Auth
  getMe: () => request<any>('/auth/me'),
  bindCF: (handle: string) => request<any>('/auth/bind-cf', { method: 'POST', body: JSON.stringify({ handle }) }),
  updateProfile: (data: Record<string, unknown>) => request<any>('/auth/profile', { method: 'PATCH', body: JSON.stringify(data) }),

  // Problems
  searchProblems: (params: Record<string, string | number>) => {
    const qs = new URLSearchParams()
    Object.entries(params).forEach(([k, v]) => { if (v) qs.set(k, String(v)) })
    return request<any>(`/problems/search?${qs}`)
  },
  getProblemTags: () => request<any>('/problems/tags'),

  // Contests
  getUpcomingContests: () => request<any>('/contests/upcoming'),

  // Review
  getReviewEntries: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params) : ''
    return request<any>(`/review${qs}`)
  },
  getReviewByTag: (tag: string) => request<any>(`/review/tag?tag=${encodeURIComponent(tag)}`),
  getReviewTagStats: () => request<any>('/review/tags/stats'),
  getReviewEntry: (id: string) => request<any>(`/review/${id}`),
  createReviewEntry: (data: Record<string, unknown>) => request<any>('/review', { method: 'POST', body: JSON.stringify(data) }),
  updateReviewEntry: (id: string, data: Record<string, unknown>) => request<any>(`/review/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteReviewEntry: (id: string) => request<any>(`/review/${id}`, { method: 'DELETE' }),
  syncCFSubmissions: () => request<any>('/review/sync-cf', { method: 'POST' }),
  listContests: () => request<any>('/review/contests'),
  createContest: (data: Record<string, string>) => request<any>('/review/contests', { method: 'POST', body: JSON.stringify(data) }),
  updateContest: (id: string, data: Record<string, string>) => request<any>(`/review/contests/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteContest: (id: string) => request<any>(`/review/contests/${id}`, { method: 'DELETE' }),

  // Daily
  getDaily: () => request<any>('/daily'),
  completeDaily: (id: string) => request<any>(`/daily/${id}/complete`, { method: 'POST' }),

  // Users
  getUserProfile: (id: string) => request<any>(`/users/${id}`),
  getUserHeatmap: (id: string) => request<any>(`/users/${id}/heatmap`),
  searchUsers: (q: string) => request<any>(`/users/search?q=${encodeURIComponent(q)}`),

  // Social
  follow: (id: string) => request<any>(`/social/follow/${id}`, { method: 'POST' }),
  unfollow: (id: string) => request<any>(`/social/follow/${id}`, { method: 'DELETE' }),
  getFollowers: (id: string) => request<any>(`/social/${id}/followers`),
  getFollowing: (id: string) => request<any>(`/social/${id}/following`),
  getFriendReview: (id: string) => request<any>(`/social/${id}/review`),
  getFriends: () => request<any>('/social/friends'),
  getPendingRequests: () => request<any>('/social/friend-requests'),
  sendFriendRequest: (id: string) => request<any>(`/social/friend-request/${id}`, { method: 'POST' }),
  acceptFriendRequest: (id: string) => request<any>(`/social/friend-request/${id}/accept`, { method: 'PUT' }),
  rejectFriendRequest: (id: string) => request<any>(`/social/friend-request/${id}/reject`, { method: 'PUT' }),
  removeFriend: (id: string) => request<any>(`/social/friends/${id}`, { method: 'DELETE' }),

  // Tags
  getCustomTags: () => request<any>('/tags/custom'),

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
    const json = await res.json()
    if (json.code !== 0) throw new Error(json.message)
    return json.data.url
  },

  // Snippets
  getSnippets: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params) : ''
    return request<any>(`/snippets${qs}`)
  },
  getSnippet: (id: string) => request<any>(`/snippets/${id}`),
  createSnippet: (data: Record<string, string>) => request<any>('/snippets', { method: 'POST', body: JSON.stringify(data) }),
  updateSnippet: (id: string, data: Record<string, string>) => request<any>(`/snippets/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteSnippet: (id: string) => request<any>(`/snippets/${id}`, { method: 'DELETE' }),
}
