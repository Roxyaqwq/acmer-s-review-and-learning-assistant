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
  getMe: () => request('/auth/me'),
  bindCF: (handle: string) => request('/auth/bind-cf', { method: 'POST', body: JSON.stringify({ handle }) }),
  updateProfile: (data: Record<string, unknown>) => request('/auth/profile', { method: 'PATCH', body: JSON.stringify(data) }),

  // Problems
  searchProblems: (params: Record<string, string | number>) => {
    const qs = new URLSearchParams()
    Object.entries(params).forEach(([k, v]) => { if (v) qs.set(k, String(v)) })
    return request(`/problems/search?${qs}`)
  },
  getProblemTags: () => request('/problems/tags'),

  // Contests
  getUpcomingContests: () => request('/contests/upcoming'),

  // Review
  getReviewEntries: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params) : ''
    return request(`/review${qs}`)
  },
  getReviewByTag: (tag: string) => request(`/review/tag?tag=${encodeURIComponent(tag)}`),
  getReviewTagStats: () => request('/review/tags/stats'),
  getReviewEntry: (id: string) => request(`/review/${id}`),
  createReviewEntry: (data: Record<string, unknown>) => request('/review', { method: 'POST', body: JSON.stringify(data) }),
  updateReviewEntry: (id: string, data: Record<string, unknown>) => request(`/review/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteReviewEntry: (id: string) => request(`/review/${id}`, { method: 'DELETE' }),
  syncCFSubmissions: () => request('/review/sync-cf', { method: 'POST' }),
  listContests: () => request('/review/contests'),
  createContest: (data: Record<string, string>) => request('/review/contests', { method: 'POST', body: JSON.stringify(data) }),
  deleteContest: (id: string) => request(`/review/contests/${id}`, { method: 'DELETE' }),

  // Daily
  getDaily: () => request('/daily'),
  completeDaily: (id: string) => request(`/daily/${id}/complete`, { method: 'POST' }),

  // Users
  getUserProfile: (id: string) => request(`/users/${id}`),
  getUserHeatmap: (id: string) => request(`/users/${id}/heatmap`),
  getUserStats: (id: string) => request(`/users/${id}/stats`),
  searchUsers: (q: string) => request(`/users/search?q=${encodeURIComponent(q)}`),

  // Feed
  getFeed: () => request('/feed'),

  // Social
  follow: (id: string) => request(`/social/follow/${id}`, { method: 'POST' }),
  unfollow: (id: string) => request(`/social/follow/${id}`, { method: 'DELETE' }),
  getRelationshipStatus: (id: string) => request<{ is_following: boolean; is_friend: boolean; pending_request: string }>(`/social/status/${id}`),
  getFollowers: (id: string) => request(`/social/${id}/followers`),
  getFollowing: (id: string) => request(`/social/${id}/following`),
  getFriendReview: (id: string) => request(`/social/${id}/review`),
  getFriends: () => request('/social/friends'),
  getPendingRequests: () => request('/social/friend-requests'),
  getMyPendingOutgoing: () => request('/social/friend-requests/outgoing'),
  sendFriendRequest: (id: string) => request(`/social/friend-request/${id}`, { method: 'POST' }),
  acceptFriendRequest: (id: string) => request(`/social/friend-request/${id}/accept`, { method: 'PUT' }),
  rejectFriendRequest: (id: string) => request(`/social/friend-request/${id}/reject`, { method: 'PUT' }),
  removeFriend: (id: string) => request(`/social/friends/${id}`, { method: 'DELETE' }),

  // Tags
  getCustomTags: () => request('/tags/custom'),

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
}
