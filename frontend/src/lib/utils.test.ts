import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { CF_RATING_COLORS, PLATFORM_COLORS, cn, countdown, formatDate, timeAgo } from './utils'

const NOW = new Date('2026-10-22T12:00:00Z')

function secondsFromNow(seconds: number) {
  return new Date(NOW.getTime() + seconds * 1000).toISOString()
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('cn', () => {
  it('keeps the last of two conflicting utilities', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4')
  })

  it('drops falsey arguments', () => {
    expect(cn('flex', false && 'hidden', undefined, null, 'gap-2')).toBe('flex gap-2')
  })

  it('accepts the conditional object form clsx supports', () => {
    expect(cn({ 'text-sm': true, 'text-lg': false })).toBe('text-sm')
  })
})

describe('timeAgo', () => {
  it('calls anything under a minute "just now"', () => {
    expect(timeAgo(secondsFromNow(-30))).toBe('刚刚')
  })

  it('reports minutes under an hour', () => {
    expect(timeAgo(secondsFromNow(-5 * 60))).toBe('5 分钟前')
  })

  it('reports hours under a day', () => {
    expect(timeAgo(secondsFromNow(-2 * 3600))).toBe('2 小时前')
  })

  it('reports whole days beyond that', () => {
    expect(timeAgo(secondsFromNow(-3 * 86400))).toBe('3 天前')
  })

  it('does not round 59 minutes up into an hour', () => {
    expect(timeAgo(secondsFromNow(-59 * 60 - 59))).toBe('59 分钟前')
  })
})

describe('countdown', () => {
  it('treats a past date as started', () => {
    expect(countdown(secondsFromNow(-1))).toBe('已开始')
  })

  it('counts minutes below an hour', () => {
    expect(countdown(secondsFromNow(10 * 60))).toBe('10 分钟')
  })

  it('counts hours and minutes below a day', () => {
    expect(countdown(secondsFromNow(90 * 60))).toBe('1 小时 30 分钟')
  })

  it('counts days and hours above a day', () => {
    expect(countdown(secondsFromNow(2 * 86400 + 3 * 3600))).toBe('2 天 3 小时')
  })
})

describe('formatDate', () => {
  it('renders the year of the given date', () => {
    expect(formatDate('2026-06-15T00:00:00Z')).toContain('2026')
  })
})

describe('colour tables', () => {
  it('gives every Codeforces rank a colour', () => {
    expect(Object.keys(CF_RATING_COLORS).sort()).toContain('legendary grandmaster')
    for (const value of Object.values(CF_RATING_COLORS)) {
      expect(value).toMatch(/^text-/)
    }
  })

  it('colours each platform under both of its spellings', () => {
    for (const platform of ['Codeforces', 'AtCoder', 'Luogu', 'NowCoder', 'LeetCode']) {
      expect(PLATFORM_COLORS[platform]).toBe(PLATFORM_COLORS[platform.toLowerCase()])
    }
  })
})
