'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import { useDebounce } from '@/hooks/useDebounce'
import { Card, CardContent, CardHeader, CardTitle, Input, Badge, Button } from '@/components/ui/base'
import { Search, Filter, ExternalLink } from 'lucide-react'

interface Problem {
  contest_id: number
  problem_index: string
  name: string
  rating: number
  tags: string[]
  solved_count: number
}

interface TagOption {
  tag_key: string
  tag_zh: string
}

const CF_RATING_COLORS: Record<string, string> = {
  '800': 'text-gray-400', '900': 'text-gray-400', '1000': 'text-gray-400',
  '1100': 'text-green-500', '1200': 'text-green-500', '1300': 'text-green-500', '1400': 'text-green-500',
  '1500': 'text-cyan-400', '1600': 'text-cyan-400',
  '1700': 'text-blue-500', '1800': 'text-blue-500', '1900': 'text-blue-500', '2000': 'text-blue-500',
  '2100': 'text-purple-400', '2200': 'text-purple-400', '2300': 'text-purple-400',
  '2400': 'text-amber-400', '2500': 'text-amber-400', '2600': 'text-amber-400', '2700': 'text-amber-400',
  '2800': 'text-red-500', '2900': 'text-red-500', '3000': 'text-red-500',
  '3100': 'text-red-600', '3200': 'text-red-600', '3300': 'text-red-600', '3400': 'text-red-600', '3500': 'text-red-600',
}

function getRatingColor(rating: number): string {
  const key = String(Math.floor(rating / 100) * 100)
  return CF_RATING_COLORS[key] || 'text-foreground'
}

export default function ProblemsPage() {
  const [problems, setProblems] = useState<Problem[]>([])
  const [tags, setTags] = useState<TagOption[]>([])
  const [total, setTotal] = useState(0)
  const [query, setQuery] = useState('')
  const [minRating, setMinRating] = useState('')
  const [maxRating, setMaxRating] = useState('')
  const [selectedTag, setSelectedTag] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)

  const dQuery = useDebounce(query, 300)
  const dMin = useDebounce(minRating, 300)
  const dMax = useDebounce(maxRating, 300)
  const dTag = useDebounce(selectedTag, 300)

  useEffect(() => {
    api.getProblemTags().then(setTags).catch(() => {})
  }, [])

  useEffect(() => {
    setLoading(true)
    api.searchProblems({
      q: dQuery,
      min_rating: dMin ? Number(dMin) : 0,
      max_rating: dMax ? Number(dMax) : 3500,
      tags: dTag,
      page,
      limit: 30,
    }).then((data) => {
      setProblems(data.items || [])
      setTotal(data.total || 0)
    }).finally(() => setLoading(false))
  }, [dQuery, dMin, dMax, dTag, page])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">找题</h1>
        <p className="text-sm text-muted-foreground">搜索 Codeforces 题目</p>
      </div>

      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索题目名称或 ID (如 2000A)..."
                value={query}
                onChange={(e) => { setQuery(e.target.value); setPage(1) }}
                className="pl-9"
              />
            </div>
            <Input
              type="number"
              placeholder="最低 Rating"
              value={minRating}
              onChange={(e) => { setMinRating(e.target.value); setPage(1) }}
              className="w-32"
            />
            <Input
              type="number"
              placeholder="最高 Rating"
              value={maxRating}
              onChange={(e) => { setMaxRating(e.target.value); setPage(1) }}
              className="w-32"
            />
            <select
              value={selectedTag}
              onChange={(e) => { setSelectedTag(e.target.value); setPage(1) }}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">全部标签</option>
              {tags.map((t) => (
                <option key={t.tag_key} value={t.tag_key}>{t.tag_zh}</option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      <div className="text-sm text-muted-foreground">共 {total} 题</div>

      <div className="space-y-2">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        ) : (
          problems.map((p) => (
            <a
              key={`${p.contest_id}${p.problem_index}`}
              href={`https://codeforces.com/problemset/problem/${p.contest_id}/${p.problem_index}`}
              target="_blank"
              className="block"
            >
              <Card className="hover:border-primary/30 hover:bg-accent/50 transition-all group">
                <CardContent className="py-3 flex items-center gap-4">
                  <span className="font-mono text-sm text-muted-foreground shrink-0 w-20">
                    {p.contest_id}{p.problem_index}
                  </span>
                  <span className="text-sm font-medium flex-1 truncate group-hover:text-primary transition-colors">
                    {p.name}
                  </span>
                  <span className={`font-mono text-sm font-bold shrink-0 ${getRatingColor(p.rating)}`}>
                    {p.rating || '-'}
                  </span>
                  <div className="hidden md:flex gap-1 shrink-0">
                    {p.tags.slice(0, 3).map((t, i) => (
                      <Badge key={i} variant="secondary" className="text-[10px]">{t}</Badge>
                    ))}
                  </div>
                  <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                </CardContent>
              </Card>
            </a>
          ))
        )}
      </div>

      {total > 30 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>上一页</Button>
          <span className="text-sm text-muted-foreground">第 {page} 页</span>
          <Button variant="outline" disabled={page * 30 >= total} onClick={() => setPage(page + 1)}>下一页</Button>
        </div>
      )}
    </div>
  )
}
