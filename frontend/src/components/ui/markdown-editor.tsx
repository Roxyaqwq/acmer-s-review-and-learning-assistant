'use client'

import { useState, useRef } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/base'
import { Bold, Italic, Heading1, Heading2, Heading3, Code, Quote, List, ListOrdered, Link, Table, Image } from 'lucide-react'

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

    // escape html
    line = line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

    // code block
    if (/^```/.test(line)) {
      const lang = line.slice(3).trim() || ''
      result.push(`<pre class="bg-zinc-900 rounded-lg p-4 my-3 overflow-x-auto"><code class="text-sm font-mono">`)
      if (lang) result.push(`<span class="text-zinc-500 text-xs">${lang}</span>\n`)
      i++
      while (i < lines.length && !/^```/.test(lines[i])) {
        let cl = lines[i].replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        // Number highlighting must come FIRST before any span with digits in class names
        cl = cl.replace(/\b(\d+)\b/g, '<span class="cl-num">$1</span>')
        cl = cl.replace(/\b(int|double|char|float|void|bool|long|short|unsigned|auto|const|static|extern|return|if|else|for|while|do|switch|case|break|continue|struct|class|public|private|protected|virtual|override|new|delete|true|false|nullptr|using|namespace|template|typename|include|define|typedef|sizeof)\b/g, '<span class="cl-kw">$1</span>')
        cl = cl.replace(/\b(string|vector|map|set|queue|stack|pair|cout|cin|endl)\b/g, '<span class="cl-type">$1</span>')
        cl = cl.replace(/([a-zA-Z_]\w*)\s*(?=\()/g, '<span class="cl-fn">$1</span>')
        cl = cl.replace(/(\/\/.*)/g, '<span class="cl-cmt">$1</span>')
        cl = cl.replace(/#(\s)*(include|define|ifdef|endif|pragma).*/g, '<span class="cl-pp">$&</span>')
        cl = cl.replace(/(&quot;.*?&quot;)/g, '<span class="cl-str">$1</span>')
        result.push(cl + '\n')
        i++
      }
      result.push('</code></pre>')
      i++
      continue
    }

    // Headers
    if (/^### /.test(line)) { result.push(`<h3 class="text-base font-semibold mt-4 mb-1">${line.slice(4)}</h3>`); i++; continue }
    if (/^## /.test(line)) { result.push(`<h2 class="text-lg font-semibold mt-4 mb-1">${line.slice(3)}</h2>`); i++; continue }
    if (/^# /.test(line)) { result.push(`<h1 class="text-xl font-bold mt-4 mb-2">${line.slice(2)}</h1>`); i++; continue }

    // Horizontal rule
    if (/^-{3,}$/.test(line)) { result.push('<hr class="my-3 border-zinc-700">'); i++; continue }

    // Blockquote
    if (/^> /.test(line)) {
      result.push('<blockquote class="border-l-2 border-primary pl-3 my-2 text-zinc-400">')
      while (i < lines.length && /^>/.test(lines[i])) {
        result.push(lines[i].replace(/^>\s?/, '') + '<br/>')
        i++
      }
      result.push('</blockquote>')
      continue
    }

    // Unordered list
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

    // Ordered list
    if (/^\d+\.\s/.test(line)) {
      result.push('<ol class="list-decimal ml-5 my-2 space-y-0.5">')
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        result.push(`<li>${renderInline(lines[i].replace(/^\d+\.\s/, ''))}</li>`)
        i++
      }
      result.push('</ol>')
      continue
    }

    // Table
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

    // Empty line
    if (line === '') { result.push('<br/>'); i++; continue }

    // Paragraph
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
  { icon: Bold, label: '粗体', insert: (t: string) => `**${t || '文字'}**` },
  { icon: Italic, label: '斜体', insert: () => `*文字*` },
  { icon: Heading1, label: 'H1', insert: () => `# 标题` },
  { icon: Heading2, label: 'H2', insert: () => `## 标题` },
  { icon: Heading3, label: 'H3', insert: () => `### 标题` },
  { icon: Code, label: '代码块', insert: () => `\`\`\`cpp\n代码\n\`\`\`` },
  { icon: Quote, label: '引用', insert: () => `> 引用文字` },
  { icon: Link, label: '链接', insert: () => `[文字](https://)` },
  { icon: Image, label: '图片', insert: () => `![描述](https://)` },
  { icon: List, label: '无序列表', insert: () => `- 项目` },
  { icon: ListOrdered, label: '有序列表', insert: () => `1. 项目` },
  { icon: Table, label: '表格', insert: () => `| 列1 | 列2 |\n| --- | --- |\n| | |` },
]

export function MarkdownEditor({ open, onClose, value, onChange, readOnly, title }: MarkdownEditorProps) {
  const [showPreview, setShowPreview] = useState(readOnly || false)
  const textRef = useRef<HTMLTextAreaElement>(null)
  const selRef = useRef({ start: 0, end: 0 })
  const safeValue = value || ''

  const saveSelection = () => {
    const ta = textRef.current
    if (ta) selRef.current = { start: ta.selectionStart, end: ta.selectionEnd }
  }

  const insertAtCursor = (insertFn: (sel: string) => string) => {
    const { start, end } = selRef.current
    const ta = textRef.current
    if (!ta) return
    const sel = safeValue.slice(Math.min(start, end), Math.max(start, end))
    const before = safeValue.slice(0, Math.min(start, end))
    const after = safeValue.slice(Math.max(start, end))
    const inserted = insertFn(sel)
    onChange(before + inserted + after)
    setTimeout(() => {
      ta.focus()
      const pos = start + inserted.length
      ta.setSelectionRange(pos, pos)
    }, 0)
  }

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
            <div className="flex flex-wrap gap-0.5 px-4 py-2 border-b border-border">
              {TOOLS.map((t) => (
                <button key={t.label} onClick={() => insertAtCursor(t.insert)}
                  className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                  title={t.label}
                >
                  <t.icon className="h-3.5 w-3.5" />
                </button>
              ))}
            </div>
            <textarea
              ref={textRef}
              value={safeValue}
              onChange={(e) => onChange(e.target.value)}
              onMouseUp={saveSelection}
              onKeyUp={saveSelection}
              onBlur={saveSelection}
              onFocus={saveSelection}
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
              dangerouslySetInnerHTML={{ __html: renderMarkdown(safeValue) }}
            />
            <div className="flex justify-end px-4 py-2 border-t border-border">
              <Button onClick={onClose} size="sm">{readOnly ? '关闭' : '完成'}</Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
