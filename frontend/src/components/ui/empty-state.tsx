import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

/**
 * 空状态。
 *
 * 之前每个页面各写一句「暂无数据」，用户看不出下一步该做什么。
 * 统一成：图钉 + 一句现状 + 一句怎么办 + 可选按钮。
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon
  title: string
  description?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border/80 bg-card/40 px-6 py-14 text-center',
        className
      )}
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-full border border-border/70 bg-background/60">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium">{title}</p>
        {description && (
          <p className="mx-auto max-w-sm text-xs leading-relaxed text-muted-foreground">{description}</p>
        )}
      </div>
      {action}
    </div>
  )
}
