'use client'

import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { Card, CardContent, CardHeader, CardTitle, Badge, Button, Input } from '@/components/ui/base'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { formatDate } from '@/lib/utils'
import { BookOpen, Plus, RefreshCw, CheckCircle, AlertCircle, Clock, Trash2, Edit, ExternalLink, Calendar, ChevronDown, ChevronRight, Maximize2 } from 'lucide-react'
import { MarkdownEditor } from '@/components/ui/markdown-editor'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useToast } from '@/components/ui/toaster'

interface ReviewEntry {
  id: string; platform: string; contest_id: string; contest_name: string; contest_url: string
  problem_index: string; problem_name: string; problem_url: string; custom_tags: string[]
  status: string; solution_url: string; notes: string; created_at: string; completed_at: string | null
}

interface UserContest {
  id: string; platform: string; contest_id: string; contest_name: string; contest_url: string
  created_at: string
}

const PLATFORMS = ['Codeforces', 'AtCoder', 'Luogu', 'NowCoder', 'LeetCode', 'Other']
const CUSTOM_TAGS = [
  '栈','队列','并查集','哈希表','堆/优先队列',
  '线段树','树状数组','平衡树','Trie','单调栈/队列','ST表','分块','莫队',
  '最短路','最小生成树','拓扑排序','强连通分量','双连通分量','二分图匹配','网络流','LCA','树上差分','欧拉回路',
  '线性DP','背包DP','区间DP','树形DP','数位DP','状压DP','概率DP','DP优化(斜率/单调队列)',
  '数论(素数筛/逆元)','组合数学','博弈论','概率期望','矩阵快速幂','FFT/NTT',
  'KMP','扩展KMP','Manacher','AC自动机','后缀数组','后缀自动机','字符串哈希',
  'BFS','DFS','双向搜索','A*/IDA*','记忆化搜索',
  '贪心','构造','基础几何','凸包','半平面交',
  '二分/三分','双指针','前缀和/差分','位运算','交互题','随机化',
]

const STATUS_MAP: Record<string, { icon: React.ReactNode; label: string; cls: string }> = {
  solved: { icon: <CheckCircle className="h-4 w-4" />, label: '已补', cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
  unsolved: { icon: <AlertCircle className="h-4 w-4" />, label: '未补', cls: 'bg-red-500/10 text-red-400 border-red-500/30' },
  attempted: { icon: <Clock className="h-4 w-4" />, label: '尝试中', cls: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
}

function emptyProblemForm(platform: string, contestId: string, contestName: string) {
  return { platform, contest_id: contestId, contest_name: contestName || '', problem_index: '', problem_name: '', problem_url: '', custom_tags: [] as string[], status: 'unsolved', solution_url: '', notes: '' }
}

export default function ReviewPage() {
  const { user } = useAuth()
  const { addToast } = useToast()
  const [entries, setEntries] = useState<ReviewEntry[]>([])
  const [contests, setContests] = useState<UserContest[]>([])
  const [filterTag, setFilterTag] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  // Contest dialog
  const [showContestDlg, setShowContestDlg] = useState(false)
  const [contestForm, setContestForm] = useState({ platform: 'Codeforces', contest_id: '', contest_name: '', contest_url: '' })

  // Problem dialog
  const [showProblemDlg, setShowProblemDlg] = useState(false)
  const [problemForm, setProblemForm] = useState(emptyProblemForm('Codeforces', '', ''))
  const [editId, setEditId] = useState<string | null>(null)
  const [mdOpen, setMdOpen] = useState(false)
  const [mdReadOnly, setMdReadOnly] = useState(false)
  const [mdContent, setMdContent] = useState('')
  const [mdTitle, setMdTitle] = useState('')
  const [confirm, setConfirm] = useState<{ open: boolean; title: string; desc: string; action: () => void; variant?: 'destructive' }>({ open: false, title: '', desc: '', action: () => {} })
  const [editContestDlg, setEditContestDlg] = useState(false)
  const [editContestForm, setEditContestForm] = useState({ id: '', name: '', url: '' })

  const loadData = useCallback(() => {
    const params: Record<string, string> = {}
    if (filterTag) params.tag = filterTag
    api.getReviewEntries(params).then((data: any) => setEntries(data?.items || data || [])).catch(() => {})
    api.listContests().then((c: any) => setContests(c || [])).catch(() => {})
    setLoading(false)
  }, [filterTag])

  useEffect(() => { if (user) loadData() }, [user, loadData])

  // Merge contests + entries into unified group list
  const groupMap: Record<string, { contest: UserContest | null; entries: ReviewEntry[] }> = {}

  contests.forEach((c) => {
    const key = `${c.platform}-${c.contest_id}`
    if (!groupMap[key]) groupMap[key] = { contest: c, entries: [] }
    else groupMap[key].contest = c
  })

  ;(entries || []).forEach((e) => {
    const key = `${e.platform}-${e.contest_id}`
    if (!groupMap[key]) groupMap[key] = { contest: null, entries: [] }
    groupMap[key].entries.push(e)
    if (!groupMap[key].contest) {
      groupMap[key].contest = {
        id: '', platform: e.platform, contest_id: e.contest_id,
        contest_name: e.contest_name || e.contest_id, contest_url: e.contest_url, created_at: e.created_at,
      }
    }
  })

  const groupList = Object.entries(groupMap)
    .map(([key, v]) => ({ key, ...v }))
    .sort((a, b) => (b.contest?.created_at || '').localeCompare(a.contest?.created_at || ''))

  // --- Contest handlers ---
  const handleCreateContest = async () => {
    if (!contestForm.platform || !contestForm.contest_id) { addToast({ title: '请填写平台和比赛ID', variant: 'destructive' }); return }
    await api.createContest(contestForm)
    addToast({ title: '比赛已创建' })
    setShowContestDlg(false)
    setContestForm({ platform: 'Codeforces', contest_id: '', contest_name: '', contest_url: '' })
    loadData()
  }

  const handleDeleteContest = (id: string) => {
    if (!id) return
    setConfirm({ open: true, title: '删除比赛', desc: '此操作将删除该比赛及所有题目，不可恢复', variant: 'destructive', action: async () => { await api.deleteContest(id); loadData(); addToast({ title: '比赛已删除' }) } })
  }

  const openEditContest = (id: string, name: string, url: string) => {
    setEditContestForm({ id, name, url: url || '' })
    setEditContestDlg(true)
  }

  const handleSaveContest = async () => {
    await api.updateContest(editContestForm.id, { contest_name: editContestForm.name, contest_url: editContestForm.url } as any)
    setEditContestDlg(false)
    addToast({ title: '比赛已更新' })
    loadData()
  }

  // --- Problem handlers ---
  const handleAddOrEditProblem = async () => {
    if (!problemForm.problem_index) { addToast({ title: '请填写题目编号', variant: 'destructive' }); return }
    if (problemForm.custom_tags.length === 0) { addToast({ title: '请至少选择一个题型标签', variant: 'destructive' }); return }
    try {
      if (editId) {
        await api.updateReviewEntry(editId, { status: problemForm.status, solution_url: problemForm.solution_url, notes: problemForm.notes, custom_tags: problemForm.custom_tags })
        addToast({ title: '修改已保存' })
      } else {
        await api.createReviewEntry(problemForm)
        addToast({ title: '题目已添加' })
      }
      setShowProblemDlg(false); setEditId(null); loadData()
    } catch (e: any) { addToast({ title: '操作失败', description: e?.message || '未知错误', variant: 'destructive' }) }
  }

  const handleEditProblem = (entry: ReviewEntry) => {
    setProblemForm({
      platform: entry.platform, contest_id: entry.contest_id, contest_name: entry.contest_name,
      problem_index: entry.problem_index, problem_name: entry.problem_name, problem_url: entry.problem_url || '',
      custom_tags: entry.custom_tags, status: entry.status, solution_url: entry.solution_url || '', notes: entry.notes || '',
    })
    setEditId(entry.id); setShowProblemDlg(true)
  }

  const handleAddProblem = (platform: string, contestId: string, contestName: string) => {
    setProblemForm(emptyProblemForm(platform, contestId, contestName))
    setEditId(null); setShowProblemDlg(true)
  }

  const handleDeleteProblem = (id: string) => {
    setConfirm({ open: true, title: '删除题目', desc: '确定删除此题目？', variant: 'destructive', action: async () => { await api.deleteReviewEntry(id); loadData(); addToast({ title: '题目已删除' }) } })
  }

  const handleToggleStatus = async (entry: ReviewEntry) => {
    try { await api.updateReviewEntry(entry.id, { status: entry.status === 'solved' ? 'unsolved' : 'solved' }); loadData() } catch {}
  }

  const handleSync = async () => {
    setSyncing(true)
    try { const r = await api.syncCFSubmissions() as any; addToast({ title: `同步完成: ${r?.synced || 0} 条记录` }) }
    catch (e: any) { addToast({ title: '同步失败', description: e?.message || '未知错误', variant: 'destructive' }) }
    setSyncing(false); loadData()
  }

  if (!user) return <div className="flex items-center justify-center min-h-[60vh]"><p className="text-muted-foreground">请先登录</p></div>

  const TagPicker = ({ selected, onChange }: { selected: string[]; onChange: (t: string[]) => void }) => (
    <div className="flex flex-wrap gap-1.5 max-h-44 overflow-y-auto rounded-md border border-input bg-background p-2">
      {CUSTOM_TAGS.map((t) => (
        <button key={t} type="button" onClick={() => onChange(selected.includes(t) ? selected.filter((x) => x !== t) : [...selected, t])}
          className={`rounded-full px-2.5 py-0.5 text-xs border transition-colors ${
            selected.includes(t) ? 'bg-primary/20 border-primary text-primary' : 'border-border text-muted-foreground hover:border-primary/50'
          }`}>{t}</button>
      ))}
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-4">
        <div><h1 className="text-xl sm:text-2xl font-bold">补题记录</h1><p className="text-xs sm:text-sm text-muted-foreground">新建比赛 → 添加题目</p></div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing} className="flex-1 sm:flex-none">
            <RefreshCw className={`h-4 w-4 mr-1 ${syncing ? 'animate-spin' : ''}`} />同步 CF
          </Button>
          <Dialog open={showContestDlg} onOpenChange={setShowContestDlg}>
            <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />新建比赛</Button></DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader><DialogTitle>新建比赛</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium mb-1 block">平台 <span className="text-red-400">*</span></label>
                  <select value={contestForm.platform} onChange={(e) => setContestForm({ ...contestForm, platform: e.target.value })}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                    {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">比赛 ID <span className="text-red-400">*</span></label>
                  <Input value={contestForm.contest_id} onChange={(e) => setContestForm({ ...contestForm, contest_id: e.target.value })} placeholder="如 2000 或 abc400" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">比赛名称</label>
                  <Input value={contestForm.contest_name} onChange={(e) => setContestForm({ ...contestForm, contest_name: e.target.value })} placeholder="自定义名称（可选）" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">比赛链接</label>
                  <Input value={contestForm.contest_url} onChange={(e) => setContestForm({ ...contestForm, contest_url: e.target.value })} placeholder="可选" />
                </div>
                <Button className="w-full" onClick={handleCreateContest}>创建比赛</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <select value={filterTag} onChange={(e) => setFilterTag(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm">
          <option value="">全部标签</option>
          {CUSTOM_TAGS.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {/* Problem dialog */}
      <Dialog open={showProblemDlg} onOpenChange={(v) => { setShowProblemDlg(v); if (!v) setEditId(null) }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader><DialogTitle>{editId ? '编辑题目' : '添加题目'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2 text-sm text-muted-foreground bg-muted rounded-md px-3 py-2">
              <span className="font-medium">{problemForm.platform}</span><span>·</span><span>{problemForm.contest_name || problemForm.contest_id}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-sm font-medium mb-1 block">题目编号 <span className="text-red-400">*</span></label>
                <Input value={problemForm.problem_index} onChange={(e) => setProblemForm({ ...problemForm, problem_index: e.target.value })} placeholder="A / B / C" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">题目名称</label>
                <Input value={problemForm.problem_name} onChange={(e) => setProblemForm({ ...problemForm, problem_name: e.target.value })} placeholder="可选" />
              </div>
            </div>
            <div><label className="text-sm font-medium mb-1 block">题目链接</label><Input value={problemForm.problem_url} onChange={(e) => setProblemForm({ ...problemForm, problem_url: e.target.value })} placeholder="可选" /></div>
            <div>
              <label className="text-sm font-medium mb-1 block">状态</label>
              <select value={problemForm.status} onChange={(e) => setProblemForm({ ...problemForm, status: e.target.value })}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                <option value="unsolved">未补</option><option value="solved">已补</option><option value="attempted">尝试中</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">题型标签 <span className="text-red-400">*</span></label>
              <TagPicker selected={problemForm.custom_tags} onChange={(t) => setProblemForm({ ...problemForm, custom_tags: t })} />
            </div>
            <div><label className="text-sm font-medium mb-1 block">题解链接</label><Input value={problemForm.solution_url} onChange={(e) => setProblemForm({ ...problemForm, solution_url: e.target.value })} placeholder="可选" /></div>
            <div><label className="text-sm font-medium mb-1 block">我的理解</label>
              <button onClick={() => { setMdReadOnly(false); setMdTitle(`${problemForm.platform} ${problemForm.contest_id} ${problemForm.problem_index}`); setMdOpen(true) }}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-left text-muted-foreground hover:border-primary/50 transition-colors h-10 flex items-center gap-2">
                <Maximize2 className="h-4 w-4" />{problemForm.notes ? problemForm.notes.slice(0, 60) + (problemForm.notes.length > 60 ? '...' : '') : '点击展开全屏编辑 Markdown...'}
              </button>
            </div>
            <Button className="w-full" onClick={handleAddOrEditProblem}>{editId ? '保存修改' : '添加题目'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Group list */}
      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" /></div>
      ) : groupList.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground"><BookOpen className="h-8 w-8 mx-auto mb-2 opacity-50" /><p>暂无补题记录，点击 "新建比赛" 开始</p></CardContent></Card>
      ) : (
        <div className="space-y-3">
          {groupList.map((group) => {
            const isOpen = expanded.has(group.key)
            const solved = group.entries.filter((e) => e.status === 'solved').length
            return (
              <Card key={group.key}>
                <CardHeader className="pb-2 cursor-pointer select-none" onClick={() => {
                  const next = new Set(expanded)
                  isOpen ? next.delete(group.key) : next.add(group.key)
                  setExpanded(next)
                }}>
                  <div className="flex items-center gap-2 text-sm font-medium">
                    {isOpen ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                    <Badge variant="outline" className="text-xs">{group.contest!.platform}</Badge>
                    {group.contest!.contest_url ? (
                      <a href={group.contest!.contest_url} target="_blank" onClick={(e) => e.stopPropagation()} className="hover:text-primary truncate flex items-center gap-1">
                        {group.contest!.contest_name} <ExternalLink className="h-3 w-3 shrink-0" />
                      </a>
                    ) : <span className="truncate">{group.contest!.contest_name}</span>}
                    {group.entries.length > 0 && (
                      <span className="text-xs text-muted-foreground ml-auto shrink-0">{solved}/{group.entries.length} 已补</span>
                    )}
                    {group.contest!.id && (
                      <div className="flex items-center gap-0.5 ml-auto shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => openEditContest(group.contest!.id, group.contest!.contest_name, group.contest!.contest_url)}
                          className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground"><Edit className="h-3.5 w-3.5" /></button>
                        <button onClick={() => handleDeleteContest(group.contest!.id)}
                          className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-red-400"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    )}
                  </div>
                </CardHeader>
                {isOpen && (
                  <CardContent className="space-y-1 pt-0">
                    {group.entries.map((entry) => {
                      const s = STATUS_MAP[entry.status] || STATUS_MAP.unsolved
                      return (
                        <div key={entry.id} className="flex items-center gap-3 rounded-md p-2 hover:bg-accent/50 transition-colors group">
                          <button onClick={(e) => { e.stopPropagation(); handleToggleStatus(entry) }} className={s.cls + ' rounded-full p-0.5 border'}>{s.icon}</button>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm font-medium">{entry.problem_index}</span>
                              {entry.problem_name && (entry.problem_url ? (
                                <a href={entry.problem_url} target="_blank" className="text-sm text-muted-foreground hover:text-primary truncate flex items-center gap-1">{entry.problem_name} <ExternalLink className="h-3 w-3" /></a>
                              ) : <span className="text-sm text-muted-foreground truncate">{entry.problem_name}</span>)}
                            </div>
                            <div className="flex flex-wrap gap-1 mt-0.5">
                              {entry.custom_tags.map((t, i) => <Badge key={i} variant="secondary" className="text-[10px]">{t}</Badge>)}
                              <span className="text-[10px] text-muted-foreground ml-1"><Calendar className="h-3 w-3 inline" /> {formatDate(entry.created_at)}</span>
                              {entry.completed_at && <span className="text-[10px] text-emerald-400"><CheckCircle className="h-3 w-3 inline" /> {formatDate(entry.completed_at)}</span>}
                            </div>
                            {entry.notes && (
                              <p className="text-xs text-muted-foreground mt-0.5 truncate cursor-pointer hover:text-primary transition-colors"
                                onClick={(e) => { e.stopPropagation(); setMdReadOnly(true); setMdContent(entry.notes); setMdTitle(`${entry.platform} ${entry.contest_id} ${entry.problem_index}`); setMdOpen(true) }}>
                                {entry.notes.replace(/\n/g, ' ')}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={(e) => { e.stopPropagation(); handleEditProblem(entry) }} className="p-1 rounded hover:bg-accent"><Edit className="h-3.5 w-3.5" /></button>
                            <button onClick={(e) => { e.stopPropagation(); handleDeleteProblem(entry.id) }} className="p-1 rounded hover:bg-accent text-red-400"><Trash2 className="h-3.5 w-3.5" /></button>
                          </div>
                        </div>
                      )
                    })}
                    <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => handleAddProblem(group.contest!.platform, group.contest!.contest_id, group.contest!.contest_name)}>
                      <Plus className="h-3 w-3 mr-1" />添加题目
                    </Button>
                  </CardContent>
                )}
              </Card>
            )
          })}
        </div>
      )}

      <MarkdownEditor
        open={mdOpen}
        onClose={() => setMdOpen(false)}
        value={mdReadOnly ? mdContent : problemForm.notes}
        onChange={(v) => setProblemForm({ ...problemForm, notes: v })}
        readOnly={mdReadOnly}
        title={mdTitle}
      />

      <Dialog open={editContestDlg} onOpenChange={setEditContestDlg}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>编辑比赛</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium mb-1 block">比赛名称</label>
              <Input value={editContestForm.name} onChange={(e) => setEditContestForm({ ...editContestForm, name: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">比赛链接</label>
              <Input value={editContestForm.url} onChange={(e) => setEditContestForm({ ...editContestForm, url: e.target.value })} placeholder="https://..." />
            </div>
            <Button className="w-full" onClick={handleSaveContest}>保存</Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirm.open}
        onOpenChange={(v) => { if (!v) setConfirm({ ...confirm, open: false }) }}
        title={confirm.title}
        description={confirm.desc}
        onConfirm={confirm.action}
        variant={confirm.variant}
      />
    </div>
  )
}
