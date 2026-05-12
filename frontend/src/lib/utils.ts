import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const API_BASE = '/api'

export const CF_RATING_COLORS: Record<string, string> = {
  newbie: 'text-gray-400',
  pupil: 'text-green-500',
  specialist: 'text-cyan-400',
  expert: 'text-blue-500',
  'candidate master': 'text-purple-400',
  master: 'text-amber-400',
  'international master': 'text-amber-400',
  grandmaster: 'text-red-500',
  'international grandmaster': 'text-red-500',
  'legendary grandmaster': 'text-red-600',
}

export const PLATFORM_COLORS: Record<string, string> = {
  Codeforces: 'text-red-400',
  codeforces: 'text-red-400',
  AtCoder: 'text-sky-400',
  atcoder: 'text-sky-400',
  Luogu: 'text-orange-400',
  luogu: 'text-orange-400',
  NowCoder: 'text-green-400',
  nowcoder: 'text-green-400',
  LeetCode: 'text-yellow-400',
  leetcode: 'text-yellow-400',
}

export function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

export function formatDateTime(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export function timeAgo(dateStr: string) {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = Math.floor((now - then) / 1000)
  if (diff < 60) return '刚刚'
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`
  return `${Math.floor(diff / 86400)} 天前`
}

export function countdown(dateStr: string) {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = Math.floor((then - now) / 1000)
  if (diff < 0) return '已开始'
  const d = Math.floor(diff / 86400)
  const h = Math.floor((diff % 86400) / 3600)
  const m = Math.floor((diff % 3600) / 60)
  if (d > 0) return `${d} 天 ${h} 小时`
  if (h > 0) return `${h} 小时 ${m} 分钟`
  return `${m} 分钟`
}
