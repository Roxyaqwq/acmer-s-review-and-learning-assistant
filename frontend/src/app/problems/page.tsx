'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { api, type ApiProblem, type ApiTag } from '@/lib/api'
import { useDebounce } from '@/hooks/useDebounce'
import { Card, CardContent, Input, Badge, Button } from '@/components/ui/base'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import { RatingBadge } from '@/components/ui/rating-badge'
import { Search, ExternalLink, X, SearchX } from 'lucide-react'

export default function ProblemsPage() {
  const [query, setQuery] = useState('')
  const [minRating, setMinRating] = useState('')
  const [maxRating, setMaxRating] = useState('')
  const [selectedTag, setSelectedTag] = useState('')
  const [page, setPage] = useState(1)

  const dQuery = useDebounce(query, 300)
  const dMin = useDebounce(minRating, 300)
  const dMax = useDebounce(maxRating, 300)
  const dTag = useDebounce(selectedTag, 300)

  const { data: tags = [] } = useSWR<ApiTag[]>('problems:tags', () => api.getProblemTags())

  const { data, isLoading: loading } = useSWR(
    ['problems:search', dQuery, dMin, dMax, dTag, page],
    () => api.searchProblems({
      q: dQuery,
      min_rating: dMin ? Number(dMin) : 0,
      max_rating: dMax ? Number(dMax) : 3500,
      tags: dTag,
      page,
      limit: 30,
    })
  )
  const problems: ApiProblem[] = data?.items ?? []
  const total = data?.total ?? 0

  const hasFilters = !!(query || minRating || maxRating || selectedTag)
  const resetFilters = () => {
    setQuery('')
    setMinRating('')
    setMaxRating('')
    setSelectedTag('')
    setPage(1)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="problemset"
        title="找题"
        description="按名字、ID、难度或标签检索 Codeforces 题库"
        actions={
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            共 <span className="text-foreground">{total}</span> 题
          </span>
        }
      />

      <Card className="border-border/70 bg-card/60">
        <CardContent className="py-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[200px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="搜索题目名称或 ID（如 2000A）"
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
              className="w-32 tabular-nums"
            />
            <Input
              type="number"
              placeholder="最高 Rating"
              value={maxRating}
              onChange={(e) => { setMaxRating(e.target.value); setPage(1) }}
              className="w-32 tabular-nums"
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
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={resetFilters} className="gap-1 text-muted-foreground">
                <X className="h-3.5 w-3.5" />
                清空
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-1.5">
        {loading ? (
          <div className="space-y-2" aria-hidden>
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="border-border/60 bg-card/40">
                <CardContent className="flex items-center gap-4 py-2.5">
                  <div className="h-3 w-16 shrink-0 animate-pulse rounded bg-muted" />
                  <div className="h-3 flex-1 animate-pulse rounded bg-muted" />
                  <div className="h-6 w-14 shrink-0 animate-pulse rounded bg-muted" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : problems.length === 0 ? (
          <EmptyState
            icon={SearchX}
            title="没有匹配的题目"
            description={
              hasFilters
                ? '换个关键词，或者放宽 rating 区间试试。'
                : '题库可能还在同步，稍等片刻再刷新。'
            }
            action={
              hasFilters ? (
                <Button variant="outline" size="sm" onClick={resetFilters}>清空筛选</Button>
              ) : null
            }
          />
        ) : (
          problems.map((p, i) => (
            <a
              key={`${p.contest_id}${p.problem_index}`}
              href={`https://codeforces.com/problemset/problem/${p.contest_id}/${p.problem_index}`}
              target="_blank"
              rel="noreferrer"
              className="rise-in block"
              style={{ animationDelay: `${Math.min(i, 12) * 25}ms` }}
            >
              <Card className="card-hover group border-border/70 bg-card/60 hover:border-primary/40">
                <CardContent className="flex items-center gap-4 py-2.5">
                  <span className="w-20 shrink-0 font-mono text-xs text-muted-foreground">
                    {p.contest_id}{p.problem_index}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium transition-colors group-hover:text-primary">
                    {p.name}
                  </span>
                  <div className="hidden shrink-0 gap-1 md:flex">
                    {p.tags.slice(0, 3).map((t, idx) => (
                      <Badge key={idx} variant="secondary" className="text-[10px] font-normal text-muted-foreground">
                        {t}
                      </Badge>
                    ))}
                  </div>
                  <RatingBadge rating={p.rating} />
                  <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </CardContent>
              </Card>
            </a>
          ))
        )}
      </div>

      {total > 30 && (
        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>上一页</Button>
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            {page} / {Math.max(1, Math.ceil(total / 30))}
          </span>
          <Button variant="outline" size="sm" disabled={page * 30 >= total} onClick={() => setPage(page + 1)}>下一页</Button>
        </div>
      )}
    </div>
  )
}
