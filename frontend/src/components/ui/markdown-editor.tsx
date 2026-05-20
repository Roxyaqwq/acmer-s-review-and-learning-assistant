'use client'

import { useState, useEffect, useRef } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/base'
import { Eye, Edit3 } from 'lucide-react'

declare var hljs: any

interface MarkdownEditorProps {
  open: boolean
  onClose: () => void
  value: string
  onChange: (v: string) => void
  readOnly?: boolean
  title?: string
}

function renderMarkdown(text: string): string {
  let html = text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/^### (.+)$/gm, '<h3 class="text-base font-semibold mt-4 mb-1">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-lg font-semibold mt-4 mb-1">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-xl font-bold mt-4 mb-2">$1</h1>')
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code class="bg-muted px-1 rounded text-xs font-mono">$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" class="text-primary underline">$1</a>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
    .replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal">$1</li>')
    .replace(/```(\w*)\n?([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>')
    .replace(/^> (.+)$/gm, '<blockquote class="border-l-2 border-primary pl-3 my-2 text-muted-foreground">$1</blockquote>')
    .replace(/^---$/gm, '<hr class="my-3 border-border">')
    .replace(/\n\n/g, '</p><p class="my-1">')
    .replace(/\n/g, '<br/>')

  return '<p class="my-1">' + html + '</p>'
}

export function MarkdownEditor({ open, onClose, value, onChange, readOnly, title }: MarkdownEditorProps) {
  const [preview, setPreview] = useState(false)
  const previewRef = useRef<HTMLDivElement>(null)
  const safeValue = value || ''

  useEffect(() => {
    if ((readOnly || preview) && previewRef.current && typeof hljs !== 'undefined') {
      try {
        previewRef.current.querySelectorAll('pre code').forEach((el: any) => {
          hljs.highlightElement(el)
        })
      } catch {}
    }
  }, [preview, readOnly, safeValue])

  useEffect(() => {
    const existingScript = document.querySelector('script[src*="highlight.js"]')
    if (!existingScript) {
      const script = document.createElement('script')
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js'
      document.head.appendChild(script)
    }
  }, [])

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="max-w-4xl h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>{title || '我的理解'}</span>
            <div className="flex gap-1">
              <Button variant={preview ? 'outline' : 'secondary'} size="sm" onClick={() => setPreview(false)}>
                <Edit3 className="h-3.5 w-3.5 mr-1" />编辑
              </Button>
              <Button variant={preview ? 'secondary' : 'outline'} size="sm" onClick={() => setPreview(true)}>
                <Eye className="h-3.5 w-3.5 mr-1" />预览
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-hidden">
          {readOnly || preview ? (
          <div
            ref={previewRef}
            className="h-full overflow-y-auto p-4 rounded-md border border-border bg-background text-sm leading-relaxed"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(safeValue) }}
          />
          ) : (
            <textarea
              value={safeValue}
              onChange={(e) => onChange(e.target.value)}
              className="w-full h-full resize-none rounded-md border border-input bg-background p-4 text-sm font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="用 Markdown 记录你的理解...&#10;&#10;## 思路&#10;- 第一步...&#10;- 第二步...&#10;&#10;## 关键代码&#10;```cpp&#10;int main() {&#10;  return 0;&#10;}&#10;```"
            />
          )}
        </div>
        {!readOnly && (
          <div className="flex justify-between items-center pt-2">
            <span className="text-xs text-muted-foreground">支持 Markdown · 点击预览查看效果</span>
            <Button onClick={onClose} size="sm">完成</Button>
          </div>
        )}
        {readOnly && (
          <div className="flex justify-end pt-2">
            <Button onClick={onClose} size="sm">关闭</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
