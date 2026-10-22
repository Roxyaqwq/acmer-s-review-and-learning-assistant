'use client'

import { useState, useMemo } from 'react'
import useSWR from 'swr'
import { api, type ApiSnippet } from '@/lib/api'
import { Button, Badge } from '@/components/ui/base'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState } from '@/components/ui/empty-state'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useToast } from '@/components/ui/toaster'
import {
  Code2, Copy, Trash2, Plus, Search, Check, Tag, Cpu, Braces, Binary,
  Network, Library, Edit3
} from 'lucide-react'

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  '数学': <Binary className="h-3.5 w-3.5" />,
  '数据结构': <Cpu className="h-3.5 w-3.5" />,
  '图论': <Network className="h-3.5 w-3.5" />,
  '字符串': <Braces className="h-3.5 w-3.5" />,
  '通用': <Tag className="h-3.5 w-3.5" />,
}

type Snippet = ApiSnippet

export default function SnippetsPage() {
  const { addToast } = useToast()
  const t = {
    error: (msg: string) => addToast({ title: msg, variant: 'destructive' }),
    success: (msg: string) => addToast({ title: msg }),
  }
  const [selectedCategory, setSelectedCategory] = useState('')
  const [search, setSearch] = useState('')

  const [selectedSnippet, setSelectedSnippet] = useState<Snippet | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const [form, setForm] = useState({ name: '', language: 'cpp', code: '', category: '通用', description: '' })
  const [confirm, setConfirm] = useState<{ open: boolean; id: string }>({ open: false, id: '' })

  const { data: snippets = [], isLoading: loading, mutate: fetchSnippets } = useSWR<ApiSnippet[]>(
    ['snippets', selectedCategory],
    () => {
      const params: Record<string, string> = {}
      if (selectedCategory) params.category = selectedCategory
      return api.getSnippets(params)
    }
  )

  const categories = useMemo(
    () => [...new Set(snippets.filter((s) => s.is_builtin).map((s) => s.category))].sort(),
    [snippets]
  )

  const filtered = search.trim()
    ? snippets.filter(s => s.name.includes(search) || s.description.includes(search) || s.code.includes(search))
    : snippets

  const handleCopy = async (code: string, id: string) => {
    await navigator.clipboard.writeText(code)
    setCopiedId(id)
    t.success('已复制到剪贴板')
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleDelete = (id: string) => {
    setConfirm({ open: true, id })
  }

  const confirmDelete = async () => {
    const id = confirm.id
    setConfirm({ open: false, id: '' })
    try {
      await api.deleteSnippet(id)
      t.success('已删除')
      fetchSnippets()
      if (selectedSnippet?.id === id) setSelectedSnippet(null)
    } catch { t.error('删除失败') }
  }

  const openCreate = () => {
    setForm({ name: '', language: 'cpp', code: '', category: '通用', description: '' })
    setEditId(null)
    setShowCreate(true)
  }

  const openEdit = (snippet: Snippet) => {
    setForm({
      name: snippet.name,
      language: snippet.language,
      code: snippet.code,
      category: snippet.category,
      description: snippet.description,
    })
    setEditId(snippet.id)
    setSelectedSnippet(null)
    setShowCreate(true)
  }

  const handleSave = async () => {
    if (!form.name.trim() || !form.code.trim()) { t.error('名称和代码不能为空'); return }
    try {
      if (editId) {
        await api.updateSnippet(editId, form)
        t.success('修改已保存')
      } else {
        await api.createSnippet(form)
        t.success('创建成功')
      }
      setShowCreate(false)
      setEditId(null)
      fetchSnippets()
    } catch { t.error(editId ? '修改失败' : '创建失败') }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="snippets"
        title="模板库"
        description="常用算法代码模板，点击复制即可使用"
        actions={<Button onClick={openCreate} size="sm"><Plus className="h-4 w-4 mr-1" />新建模板</Button>}
      />

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
            <EmptyState
              icon={Code2}
              title="还没有模板"
              description="把常用的板子存进来，写题时点一下就复制走。"
              action={<Button size="sm" onClick={openCreate}><Plus className="h-4 w-4 mr-1" />新建模板</Button>}
            />
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
                  <Button size="sm" variant="outline" onClick={() => openEdit(selectedSnippet)}>
                    <Edit3 className="h-4 w-4 mr-1" />编辑
                  </Button>
                  <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => handleDelete(selectedSnippet.id)}>
                    <Trash2 className="h-4 w-4 mr-1" />删除
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setSelectedSnippet(null)}>关闭</Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showCreate} onOpenChange={(v) => { setShowCreate(v); if (!v) setEditId(null) }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editId ? '编辑代码模板' : '新建代码模板'}</DialogTitle>
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
            <Button size="sm" onClick={handleSave}>{editId ? '保存' : '创建'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirm.open}
        onOpenChange={(v) => { if (!v) setConfirm({ open: false, id: '' }) }}
        title="删除模板"
        description="确定删除这个模板？此操作不可恢复"
        onConfirm={confirmDelete}
        variant="destructive"
      />
    </div>
  )
}
