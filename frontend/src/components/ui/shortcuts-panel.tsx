'use client'

import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

const SHORTCUTS = [
  { keys: '?', desc: '显示/隐藏快捷键帮助' },
  { keys: 'Ctrl + K', desc: '聚焦搜索框' },
  { keys: 'Ctrl + N', desc: '新建比赛（补题页）' },
  { keys: 'Ctrl + B', desc: 'Markdown 粗体' },
  { keys: 'Ctrl + I', desc: 'Markdown 斜体' },
  { keys: 'Ctrl + `', desc: 'Markdown 代码块' },
  { keys: 'Ctrl + H', desc: '回到首页' },
  { keys: 'Escape', desc: '关闭弹窗 / 面板' },
]

export function ShortcutsPanel() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const tag = (e.target as HTMLElement)?.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA') return
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>快捷键速查</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          {SHORTCUTS.map((s) => (
            <div key={s.keys} className="flex items-center justify-between py-1">
              <span className="text-sm text-muted-foreground">{s.desc}</span>
              <kbd className="inline-flex items-center gap-1 rounded border border-border bg-muted px-2 py-0.5 text-xs font-mono font-medium">
                {s.keys.split(' + ').map((k, i) => (
                  <span key={i}>
                    {i > 0 && <span className="text-muted-foreground">+</span>}
                    {k}
                  </span>
                ))}
              </kbd>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
