'use client'

import { useState, useRef, useMemo } from 'react'
import DOMPurify from 'dompurify'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/base'
import { Bold, Italic, Heading1, Heading2, Heading3, Code, Quote, List, ListOrdered, Link, Table, Image, FileCode, Search, Copy } from 'lucide-react'
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

function renderMarkdown(text: string): string {
  const lines = text.split('\n')
  const result: string[] = []
  let i = 0

  while (i < lines.length) {
    let line = lines[i]
    line = line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

    if (/^```/.test(line)) {
      const lang = line.slice(3).trim() || ''
      result.push(`<pre class="bg-zinc-900 rounded-lg p-4 my-3 overflow-x-auto"><code class="text-sm font-mono">`)
      if (lang) result.push(`<span class="text-zinc-500 text-xs">${lang}</span>\n`)
      i++
      while (i < lines.length && !/^```/.test(lines[i])) {
        const cl = lines[i].replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

        interface Token { start: number; end: number; cls: string }
        const tokens: Token[] = []

        function collect(re: RegExp, cls: string, group?: number) {
          const r = new RegExp(re.source, re.flags)
          let m: RegExpExecArray | null
          while ((m = r.exec(cl)) !== null) {
            const idx = group !== undefined ? m.index + m[0].indexOf(m[group]) : m.index
            tokens.push({ start: idx, end: idx + (group !== undefined ? m[group].length : m[0].length), cls })
          }
        }

        collect(/(\/\/.*)/g, 'cl-cmt')
        collect(/(&quot;.*?&quot;)/g, 'cl-str')
        collect(/#(\s)*(include|define|ifdef|endif|pragma).*/g, 'cl-pp')
        collect(/\b(int|double|char|float|void|bool|long|short|unsigned|auto|const|static|extern|return|if|else|for|while|do|switch|case|break|continue|struct|class|public|private|protected|virtual|override|new|delete|true|false|nullptr|using|namespace|template|typename|include|define|typedef|sizeof)\b/g, 'cl-kw')
        collect(/\b(string|vector|map|set|queue|stack|pair|cout|cin|endl)\b/g, 'cl-type')
        collect(/([a-zA-Z_]\w*)(?=\s*\()/g, 'cl-fn', 1)
        collect(/\b(\d+)\b/g, 'cl-num')

        tokens.sort((a, b) => a.start - b.start || b.end - a.end)
        const filtered: Token[] = []
        let lastEnd = 0
        for (const t of tokens) {
          if (t.start >= lastEnd) { filtered.push(t); lastEnd = t.end }
        }

        let out = '', pos = 0
        for (const t of filtered) {
          out += cl.slice(pos, t.start) + `<span class="${t.cls}">${cl.slice(t.start, t.end)}</span>`
          pos = t.end
        }
        out += cl.slice(pos)
        result.push(out + '\n')
        i++
      }
      result.push('</code></pre>')
      i++
      continue
    }

    if (/^### /.test(line)) { result.push(`<h3 class="text-base font-semibold mt-4 mb-1">${line.slice(4)}</h3>`); i++; continue }
    if (/^## /.test(line)) { result.push(`<h2 class="text-lg font-semibold mt-4 mb-1">${line.slice(3)}</h2>`); i++; continue }
    if (/^# /.test(line)) { result.push(`<h1 class="text-xl font-bold mt-4 mb-2">${line.slice(2)}</h1>`); i++; continue }
    if (/^-{3,}$/.test(line)) { result.push('<hr class="my-3 border-zinc-700">'); i++; continue }

    if (/^> /.test(line)) {
      result.push('<blockquote class="border-l-2 border-primary pl-3 my-2 text-zinc-400">')
      while (i < lines.length && /^>/.test(lines[i])) {
        result.push(lines[i].replace(/^>\s?/, '') + '<br/>')
        i++
      }
      result.push('</blockquote>')
      continue
    }

    if (/^[\-\*]\s/.test(line)) {
      result.push('<ul class="list-disc ml-5 my-2 space-y-0.5">')
      while (i < lines.length && (/^[\-\*]\s/.test(lines[i]) || /^\s{2,}[\-\*]\s/.test(lines[i]))) {
        const it = lines[i].replace(/^[\-\*]\s/, '')
        const nested = /^\s{2,}/.test(lines[i])
        result.push(`<li class="${nested ? 'ml-4' : ''}">${renderInline(it)}</li>`)
        i++
      }
      result.push('</ul>')
      continue
    }

    if (/^\d+\.\s/.test(line)) {
      result.push('<ol class="list-decimal ml-5 my-2 space-y-0.5">')
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        result.push(`<li>${renderInline(lines[i].replace(/^\d+\.\s/, ''))}</li>`)
        i++
      }
      result.push('</ol>')
      continue
    }

    if (/\|.*\|/.test(line) && !/^[\-\*>#\s]/.test(line)) {
      const cells = line.split('|').filter(c => c.trim())
      const next = i + 1 < lines.length && /^\|[\s\-:]+\|/.test(lines[i + 1])
      result.push('<div class="overflow-x-auto my-2"><table class="border-collapse border border-zinc-700 text-sm w-full">')
      result.push('<thead><tr class="bg-zinc-800">')
      cells.forEach(c => result.push(`<th class="border border-zinc-700 px-3 py-1.5 font-medium text-left">${renderInline(c.trim())}</th>`))
      result.push('</tr></thead><tbody>')
      i += next ? 2 : 1
      while (i < lines.length && /\|.*\|/.test(lines[i]) && !/^[\-\*>\s]/.test(lines[i])) {
        const row = lines[i].split('|').filter(c => c.trim())
        result.push('<tr>')
        row.forEach(c => result.push(`<td class="border border-zinc-700 px-3 py-1.5">${renderInline(c.trim())}</td>`))
        result.push('</tr>')
        i++
      }
      result.push('</tbody></table></div>')
      continue
    }

    if (line === '') { result.push('<br/>'); i++; continue }
    result.push(`<p class="my-1">${renderInline(line)}</p>`)
    i++
  }

  return result.join('')
}

function renderInline(text: string): string {
  return text
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="max-w-full rounded-md my-2" loading="lazy"/>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" class="text-primary underline">$1</a>')
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/~~(.+?)~~/g, '<del class="text-zinc-500">$1</del>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code class="bg-zinc-800 px-1.5 py-0.5 rounded text-xs font-mono text-rose-300">$1</code>')
}

const TOOLS = [
  { icon: Bold,       label: '粗体',    insert: (t: string) => `**${t || '文字'}**` },
  { icon: Italic,     label: '斜体',    insert: (t: string) => `*${t || '文字'}*` },
  { icon: Heading1,   label: 'H1',      insert: (t: string) => t ? `# ${t}` : `# 标题` },
  { icon: Heading2,   label: 'H2',      insert: (t: string) => t ? `## ${t}` : `## 标题` },
  { icon: Heading3,   label: 'H3',      insert: (t: string) => t ? `### ${t}` : `### 标题` },
  { icon: Code,       label: '代码块',  insert: (t: string) => t ? `\`\`\`cpp\n${t}\n\`\`\`` : `\`\`\`cpp\n代码\n\`\`\`` },
  { icon: Quote,      label: '引用',    insert: (t: string) => t ? t.split('\n').map(l => `> ${l}`).join('\n') : `> 引用文字` },
  { icon: Link,       label: '链接',    insert: (t: string) => `[${t || '文字'}](https://)` },
  { icon: Image,      label: '图片',    insert: (t: string) => `![${t || '描述'}](https://)` },
  { icon: List,       label: '无序列表', insert: (t: string) => t ? t.split('\n').map(l => `- ${l}`).join('\n') : `- 项目` },
  { icon: ListOrdered, label: '有序列表', insert: (t: string) => t ? t.split('\n').map((l, i) => `${i + 1}. ${l}`).join('\n') : `1. 项目` },
  { icon: Table,      label: '表格',    insert: () => `| 列1 | 列2 |\n| --- | --- |\n| | |` },
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

  const sanitized = useMemo(() => DOMPurify.sanitize(renderMarkdown(safeValue)), [safeValue])

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
    const insertText = `\`\`\`${snippet.language || 'cpp'} —— ${snippet.name}\n${lines.join('\n')}\n\`\`\`\n`
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
            <div
              className="flex-1 overflow-y-auto px-4 py-3 text-sm leading-relaxed"
              dangerouslySetInnerHTML={{ __html: sanitized }}
            />
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
