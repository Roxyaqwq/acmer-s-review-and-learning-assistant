'use client'

import { useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api'
import { Button, Input, Badge } from '@/components/ui/base'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toaster'
import { useAuth } from '@/hooks/useAuth'
import {
  Code2, Copy, Trash2, Plus, Search, X, Check, ChevronDown, Tag, Cpu, Braces, Binary,
  Network, Shuffle, Library, Edit3, FileCode
} from 'lucide-react'

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  '数学': <Binary className="h-3.5 w-3.5" />,
  '数据结构': <Cpu className="h-3.5 w-3.5" />,
  '图论': <Network className="h-3.5 w-3.5" />,
  '字符串': <Braces className="h-3.5 w-3.5" />,
  '通用': <Tag className="h-3.5 w-3.5" />,
}

interface Snippet { id: string; user_id: string | null; name: string; language: string; code: string; category: string; description: string; is_builtin: boolean }

export default function SnippetsPage() {
  const { user } = useAuth()
  const { addToast } = useToast()
  const t = {
    error: (msg: string) => addToast({ title: msg, variant: 'destructive' }),
    success: (msg: string) => addToast({ title: msg }),
  }
  const [snippets, setSnippets] = useState<Snippet[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [selectedCategory, setSelectedCategory] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  const [selectedSnippet, setSelectedSnippet] = useState<Snippet | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const [form, setForm] = useState({ name: '', language: 'cpp', code: '', category: '通用', description: '' })

  const fetchSnippets = useCallback(async () => {
    try {
      const params: Record<string, string> = {}
      if (selectedCategory) params.category = selectedCategory
      const data = await api.getSnippets(params)
      const all: Snippet[] = Array.isArray(data) ? data : []
      setSnippets(all)
      const cats = [...new Set(all.filter((s: Snippet) => s.is_builtin).map((s: Snippet) => s.category))].sort()
      setCategories(cats)
    } catch { t.error('加载模板失败') }
    finally { setLoading(false) }
  }, [selectedCategory])

  useEffect(() => { fetchSnippets() }, [fetchSnippets])

  const filtered = search.trim()
    ? snippets.filter(s => s.name.includes(search) || s.description.includes(search) || s.code.includes(search))
    : snippets

  const handleCopy = async (code: string, id: string) => {
    await navigator.clipboard.writeText(code)
    setCopiedId(id)
    t.success('已复制到剪贴板')
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除这个模板？')) return
    try {
      await api.deleteSnippet(id)
      t.success('已删除')
      fetchSnippets()
      if (selectedSnippet?.id === id) setSelectedSnippet(null)
    } catch { t.error('删除失败') }
  }

  const openCreate = () => {
    setForm({ name: '', language: 'cpp', code: '', category: '通用', description: '' })
    setShowCreate(true)
  }

  const handleCreate = async () => {
    if (!form.name.trim() || !form.code.trim()) { t.error('名称和代码不能为空'); return }
    try {
      await api.createSnippet(form)
      t.success('创建成功')
      setShowCreate(false)
      fetchSnippets()
    } catch { t.error('创建失败') }
  }

  return (
    <div className="mx-auto max-w-7xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">模板库</h1>
          <p className="text-sm text-muted-foreground mt-1">常用算法代码模板，点击复制即可使用</p>
        </div>
        <Button onClick={openCreate} size="sm"><Plus className="h-4 w-4 mr-1" />新建模板</Button>
      </div>

      <div className="flex gap-6">
        <div className="w-44 shrink-0 space-y-1">
          <button
            onClick={() => setSelectedCategory('')}
            className={`w-full text-left px-3 py-1.5 rounded-md text-sm transition-colors flex items-center gap-2 ${!selectedCategory ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:text-foreground hover:bg-accent'}`}
          >
            <Library className="h-3.5 w-3.5" />全部
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`w-full text-left px-3 py-1.5 rounded-md text-sm transition-colors flex items-center gap-2 ${selectedCategory === cat ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:text-foreground hover:bg-accent'}`}
            >
              {CATEGORY_ICONS[cat] || <Tag className="h-3.5 w-3.5" />}
              {cat}
            </button>
          ))}
        </div>

        <div className="flex-1 min-w-0">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="搜索模板名称、代码..."
              className="w-full h-10 rounded-md border border-input bg-background pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[...Array(4)].map((_, i) => <div key={i} className="h-24 rounded-lg border border-border bg-card animate-pulse" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Code2 className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>暂无模板</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filtered.map(s => (
                <button
                  key={s.id}
                  onClick={() => setSelectedSnippet(s)}
                  className="text-left rounded-lg border border-border bg-card hover:border-primary/30 hover:shadow-sm transition-all p-4 group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">{s.name}</span>
                        <Badge variant={s.is_builtin ? 'secondary' : 'outline'} className="text-[10px] px-1.5 py-0">
                          {s.is_builtin ? '系统' : '自定义'}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{s.description}</p>
                    </div>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0 font-mono">{s.language}</Badge>
                  </div>
                  <pre className="mt-3 text-xs text-muted-foreground line-clamp-3 font-mono bg-muted/50 rounded p-2 overflow-hidden">
                    {s.code}
                  </pre>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <Dialog open={!!selectedSnippet} onOpenChange={() => setSelectedSnippet(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          {selectedSnippet && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-lg">
                  {selectedSnippet.name}
                  <Badge variant="secondary" className="text-[10px]">{selectedSnippet.category}</Badge>
                  <Badge variant="outline" className="text-[10px] font-mono">{selectedSnippet.language}</Badge>
                </DialogTitle>
              </DialogHeader>
              <div className="text-sm text-muted-foreground mb-3">
                {selectedSnippet.description}
              </div>
              <div className="relative flex-1 min-h-0 rounded-lg border border-border bg-muted/30 overflow-auto">
                <pre className="p-4 text-sm font-mono leading-relaxed whitespace-pre">{selectedSnippet.code}</pre>
              </div>
              <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => handleCopy(selectedSnippet.code, selectedSnippet.id)}>
                    {copiedId === selectedSnippet.id ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                    {copiedId === selectedSnippet.id ? '已复制' : '复制代码'}
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  {!selectedSnippet.is_builtin && selectedSnippet.user_id === user?.id && (
                    <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => handleDelete(selectedSnippet.id)}>
                      <Trash2 className="h-4 w-4 mr-1" />删除
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => setSelectedSnippet(null)}>关闭</Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>新建代码模板</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">名称</label>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="例如：快速幂" />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">语言</label>
                <select value={form.language} onChange={e => setForm({ ...form, language: e.target.value })}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                  <option value="cpp">C++</option>
                  <option value="python">Python</option>
                  <option value="java">Java</option>
                  <option value="go">Go</option>
                </select>
              </div>
              <div className="flex-1">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">分类</label>
                <input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="通用" list="category-list" />
                <datalist id="category-list">
                  {categories.map(c => <option key={c} value={c} />)}
                </datalist>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">描述</label>
              <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="简单描述模板用途" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">代码</label>
              <textarea value={form.code} onChange={e => setForm({ ...form, code: e.target.value })}
                rows={10}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring resize-y"
                placeholder="粘贴代码模板..." />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-border">
            <Button variant="ghost" size="sm" onClick={() => setShowCreate(false)}>取消</Button>
            <Button size="sm" onClick={handleCreate}>创建</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
