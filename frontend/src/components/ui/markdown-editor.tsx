'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/base'
import { Eye, Edit3 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import 'highlight.js/styles/github-dark.css'

interface MarkdownEditorProps {
  open: boolean
  onClose: () => void
  value: string
  onChange: (v: string) => void
  readOnly?: boolean
  title?: string
}

const markdownOpts = {
  remarkPlugins: [remarkGfm],
  rehypePlugins: [rehypeHighlight],
  components: {
    a: ({ href, children }: any) => <a href={href} target="_blank" className="text-primary underline">{children}</a>,
    code: ({ className, children, ...props }: any) => {
      const isBlock = className?.startsWith('language-')
      if (isBlock) return <code className={className} {...props}>{children}</code>
      return <code className="bg-muted px-1 rounded text-xs font-mono" {...props}>{children}</code>
    },
    pre: ({ children }: any) => <pre className="my-2 rounded-md overflow-x-auto text-sm">{children}</pre>,
    table: ({ children }: any) => <div className="overflow-x-auto my-2"><table className="border-collapse border border-border text-sm">{children}</table></div>,
    th: ({ children }: any) => <th className="border border-border px-3 py-1 bg-muted font-medium">{children}</th>,
    td: ({ children }: any) => <td className="border border-border px-3 py-1">{children}</td>,
    blockquote: ({ children }: any) => <blockquote className="border-l-2 border-primary pl-3 my-2 text-muted-foreground">{children}</blockquote>,
    img: ({ src, alt }: any) => <img src={src} alt={alt} className="max-w-full rounded-md my-2" loading="lazy" />,
    hr: () => <hr className="my-3 border-border" />,
  },
}

let mdId = 0

export function MarkdownEditor({ open, onClose, value, onChange, readOnly, title }: MarkdownEditorProps) {
  const [preview, setPreview] = useState(false)
  const safeValue = value || ''

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
            <div className="h-full overflow-y-auto p-4 rounded-md border border-border bg-background text-sm leading-relaxed prose prose-invert max-w-none">
              <ReactMarkdown {...markdownOpts}>{safeValue}</ReactMarkdown>
            </div>
          ) : (
            <textarea
              key={++mdId}
              value={safeValue}
              onChange={(e) => onChange(e.target.value)}
              className="w-full h-full resize-none rounded-md border border-input bg-background p-4 text-sm font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder={"用 Markdown 记录你的理解...\n\n## 思路\n- 第一步...\n- 第二步...\n\n## 关键代码\n```cpp\nint main() {\n  return 0;\n}\n```"}
            />
          )}
        </div>
        {!readOnly && (
          <div className="flex justify-between items-center pt-2">
            <span className="text-xs text-muted-foreground">支持 Markdown · 表格 · 代码高亮 · 图片 · 任务列表</span>
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
