import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, api, isUnauthorized, onAuthExpired } from './api'

/**
 * The request helper talks to `window`, `localStorage` and `fetch`, so the
 * suite substitutes all three. Node has `Response` built in, which keeps the
 * fake honest about status codes and bodies.
 */

const store = new Map<string, string>()
const fakeWindow = new EventTarget()

function installBrowserStubs() {
  store.clear()
  vi.stubGlobal('window', fakeWindow as unknown as Window & typeof globalThis)
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
    clear: () => store.clear(),
    key: () => null,
    get length() {
      return store.size
    },
  } as unknown as Storage)
}

function respondWith(body: unknown, status = 200) {
  const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function respondWithRaw(body: string, status: number) {
  const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response(body, { status }))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

beforeEach(installBrowserStubs)
afterEach(() => vi.unstubAllGlobals())

describe('request', () => {
  it('unwraps the data envelope', async () => {
    respondWith({ code: 0, message: 'ok', data: { id: '1', github_login: 'roxya' } })
    await expect(api.getMe()).resolves.toMatchObject({ github_login: 'roxya' })
  })

  it('turns a null payload into an empty array', async () => {
    respondWith({ code: 0, message: 'ok', data: null })
    await expect(api.getSnippets()).resolves.toEqual([])
  })

  it('sends the stored token as a bearer header', async () => {
    store.set('token', 'abc123')
    const fetchMock = respondWith({ code: 0, message: 'ok', data: [] })
    await api.getSnippets()
    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer abc123')
  })

  it('surfaces the backend message when code is not 0', async () => {
    respondWith({ code: 1, message: '请先绑定 CF 账号' }, 400)
    await expect(api.getMe()).rejects.toThrow('请先绑定 CF 账号')
  })

  it('reports the status and drains the token on 401', async () => {
    store.set('token', 'expired')
    let expiredEvents = 0
    const unsubscribe = onAuthExpired(() => {
      expiredEvents += 1
    })

    respondWith({ code: 1, message: '未登录或登录已过期' }, 401)
    await expect(api.getMe()).rejects.toMatchObject({ status: 401 })

    expect(store.has('token')).toBe(false)
    expect(expiredEvents).toBe(1)
    unsubscribe()
  })

  it('does not touch the token for other failures', async () => {
    store.set('token', 'still-good')
    respondWith({ code: 1, message: '上傳失敗' }, 500)
    await expect(api.getMe()).rejects.toMatchObject({ status: 500 })
    expect(store.get('token')).toBe('still-good')
  })

  it('gives a readable message for an HTML error page', async () => {
    respondWithRaw('<html><body>Bad Gateway</body></html>', 502)
    await expect(api.getMe()).rejects.toMatchObject({
      status: 502,
      message: '请求失败（HTTP 502）',
    })
  })

  it('distinguishes a rejected token from a network failure', () => {
    expect(isUnauthorized(new ApiError('nope', 401))).toBe(true)
    expect(isUnauthorized(new ApiError('nope', 500))).toBe(false)
    expect(isUnauthorized(new Error('timeout'))).toBe(false)
  })
})
