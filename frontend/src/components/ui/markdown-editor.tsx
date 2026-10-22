'use client'

import { useState, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import rehypeHighlight from 'rehype-highlight'
import 'highlight.js/styles/github-dark.css'
import 'katex/dist/katex.min.css'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/base'
import { Bold, Italic, Heading1, Heading2, Heading3, Code, Quote, List, ListOrdered, Link, Table, Image, FileCode, Search, Sigma, ListTodo } from 'lucide-react'
import { api } from '@/lib/api'
import { useToast } from '@/components/ui/toaster'

interface MarkdownEditorProps {
  open: boolean
  onClose: () => void
  value: string
  onChange: (v: string) => void
  readOnly?: boolean
  title?: string
}

// 基于 react-markdown 的标准 GFM 渲染（对齐 Typora：表格/任务列表/删除线/脚注/公式/多级列表/全级标题）
// react-markdown 默认不渲染原始 HTML，天然免疫 XSS，无需 DOMPurify
export function MarkdownView({ text }: { text: string }) {
  return (
    <div className="markdown-body prose prose-sm dark:prose-invert max-w-none prose-headings:scroll-mt-16 prose-pre:bg-transparent prose-pre:p-0">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex, [rehypeHighlight, { ignoreMissing: true, detect: false }]]}
        components={{
          a: ({ node, ...props }) => <a target="_blank" rel="noopener noreferrer" {...props} />,
          pre: ({ node, ...props }) => <pre className="bg-zinc-900 rounded-lg p-4 my-3 overflow-x-auto" {...props} />,
          // Markdown author content: we cannot know the hosts up front, so no next/image.
          // eslint-disable-next-line @next/next/no-img-element
          img: ({ node, alt, ...props }) => <img loading="lazy" alt={alt ?? ''} className="max-w-full rounded-md" {...props} />,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  )
}

const TOOLS = [
  { icon: Bold,       label: '粗体',    insert: (t: string) => `**${t || '文字'}**` },
  { icon: Italic,     label: '斜体',    insert: (t: string) => `*${t || '文字'}*` },
  { icon: Heading1,   label: 'H1',      insert: (t: string) => t ? `# ${t}` : `# 标题` },
  { icon: Heading2,   label: 'H2',      insert: (t: string) => t ? `## ${t}` : `## 标题` },
  { icon: Heading3,   label: 'H3',      insert: (t: string) => t ? `### ${t}` : `### 标题` },
  { icon: Code,       label: '代码块',  insert: (t: string) => t ? '```cpp\n' + t + '\n```' : '```cpp\n代码\n```' },
  { icon: Quote,      label: '引用',    insert: (t: string) => t ? t.split('\n').map(l => `> ${l}`).join('\n') : `> 引用文字` },
  { icon: Link,       label: '链接',    insert: (t: string) => `[${t || '文字'}](https://)` },
  { icon: Image,      label: '图片',    insert: (t: string) => `![${t || '描述'}](https://)` },
  { icon: List,       label: '无序列表', insert: (t: string) => t ? t.split('\n').map(l => `- ${l}`).join('\n') : `- 项目` },
  { icon: ListOrdered, label: '有序列表', insert: (t: string) => t ? t.split('\n').map((l, i) => `${i + 1}. ${l}`).join('\n') : `1. 项目` },
  { icon: Table,      label: '表格',    insert: () => `| 列1 | 列2 |\n| --- | --- |\n| | |` },
  { icon: ListTodo,   label: '任务列表', insert: (t: string) => t ? t.split('\n').map(l => `- [ ] ${l}`).join('\n') : `- [ ] 待办` },
  { icon: Sigma,      label: '公式',    insert: (t: string) => t ? `$${t}$` : '$E = mc^2$' },
]

export function MarkdownEditor({ open, onClose, value, onChange, readOnly, title }: MarkdownEditorProps) {
  const [showPreview, setShowPreview] = useState(readOnly || false)
  const [snippetOpen, setSnippetOpen] = useState(false)
  const [snippets, setSnippets] = useState<any[]>([])
  const [snippetSearch, setSnippetSearch] = useState('')
  const textRef = useRef<HTMLTextAreaElement>(null)
  const { addToast } = useToast()
  const safeValue = value || ''

  const doAction = (insertFn: (sel: string) => string) => {
    const ta = textRef.current
    if (!ta) return
    const s = ta.selectionStart
    const e = ta.selectionEnd
    const sel = safeValue.slice(s, e)
    const before = safeValue.slice(0, s)
    const after = safeValue.slice(e)
    const inserted = insertFn(sel)
    onChange(before + inserted + after)
    requestAnimationFrame(() => {
      ta.focus()
      const pos = sel ? s + inserted.length : s + inserted.length
      ta.setSelectionRange(pos, pos)
    })
  }

  const openSnippetPicker = async () => {
    try {
      const data = await api.getSnippets()
      setSnippets(Array.isArray(data) ? data : [])
      setSnippetSearch('')
      setSnippetOpen(true)
    } catch { addToast({ title: '加载模板失败', variant: 'destructive' }) }
  }

  const insertSnippet = (snippet: any) => {
    const ta = textRef.current
    if (!ta) return
    const s = ta.selectionStart
    const before = safeValue.slice(0, s)
    const after = safeValue.slice(s)
    const lines = snippet.code.split('\n')
    const insertText = '```' + (snippet.language || 'cpp') + ' —— ' + snippet.name + '\n' + lines.join('\n') + '\n```\n'
    onChange(before + insertText + after)
    setSnippetOpen(false)
    requestAnimationFrame(() => {
      ta.focus()
      const pos = s + insertText.length
      ta.setSelectionRange(pos, pos)
    })
  }

  const filteredSnippets = snippetSearch.trim()
    ? snippets.filter((s: any) => s.name.includes(snippetSearch) || s.description.includes(snippetSearch))
    : snippets

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-4 pt-4 pb-0">
          <DialogTitle className="flex items-center justify-between">
            <span className="text-base">{title || 'Markdown 编辑器'}</span>
            <div className="flex gap-1">
              {!readOnly && (
                <Button variant={showPreview ? 'outline' : 'default'} size="sm" onClick={() => setShowPreview(false)}>编辑</Button>
              )}
              <Button variant={showPreview ? 'default' : 'outline'} size="sm" onClick={() => setShowPreview(true)}>预览</Button>
            </div>
          </DialogTitle>
        </DialogHeader>

        {!readOnly && !showPreview && (
          <>
            <div
              className="flex flex-wrap gap-0.5 px-4 py-2 border-b border-border"
              onMouseDown={(e) => e.preventDefault()}
            >
              {TOOLS.map((t) => (
                <button key={t.label} onClick={() => doAction(t.insert)}
                  className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                  title={t.label}
                >
                  <t.icon className="h-3.5 w-3.5" />
                </button>
              ))}
              <div className="w-px bg-border mx-1 self-stretch opacity-50" />
              <button onClick={openSnippetPicker}
                className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                title="插入模板"
              >
                <FileCode className="h-3.5 w-3.5" />
                <span className="text-[11px] font-medium">模板</span>
              </button>
            </div>
            <textarea
              ref={textRef}
              value={safeValue}
              onChange={(e) => onChange(e.target.value)}
              className="flex-1 resize-none bg-background px-4 py-3 text-sm font-mono leading-relaxed focus:outline-none"
              placeholder="# 思路\n\n## 分析\n- 注意到...\n- 可以转化...\n\n## 代码\n```cpp\nint main() {\n  return 0;\n}\n```"
            />
            <div className="flex justify-between items-center px-4 py-2 border-t border-border bg-muted/30">
              <span className="text-xs text-muted-foreground">Markdown · 选中文字后点工具栏按钮可包裹 · 代码块自动着色</span>
              <Button onClick={onClose} size="sm">完成</Button>
            </div>
          </>
        )}

        {(showPreview || readOnly) && (
          <>
            <div className="flex-1 overflow-y-auto px-4 py-3 text-sm leading-relaxed">
              <MarkdownView text={safeValue} />
            </div>
            <div className="flex justify-end px-4 py-2 border-t border-border">
              <Button onClick={onClose} size="sm">{readOnly ? '关闭' : '完成'}</Button>
            </div>
          </>
        )}
      </DialogContent>

      <Dialog open={snippetOpen} onOpenChange={setSnippetOpen}>
        <DialogContent className="max-w-md max-h-[70vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-base">插入代码模板</DialogTitle>
          </DialogHeader>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={snippetSearch}
              onChange={e => setSnippetSearch(e.target.value)}
              placeholder="搜索模板..."
              className="w-full h-9 rounded-md border border-input bg-background pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              autoFocus
            />
          </div>
          <div className="flex-1 overflow-y-auto -mx-1 px-1 space-y-1 mt-2">
            {filteredSnippets.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">无匹配模板</p>
            ) : (
              filteredSnippets.map((s: any) => (
                <button
                  key={s.id}
                  onClick={() => insertSnippet(s)}
                  className="w-full text-left px-3 py-2 rounded-md hover:bg-accent transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{s.name}</span>
                    <span className="text-[10px] text-muted-foreground font-mono">{s.language}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{s.description}</p>
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  )
}
