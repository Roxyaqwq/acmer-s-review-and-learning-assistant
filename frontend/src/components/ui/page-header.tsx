import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

/**
 * 页面标题区。
 *
 * 六个页面原来各写各的：有的 2xl、有的 3xl，副标题字号也不一致。
 * 这里统一一种「等宽小标签 + 标题 + 一句说明」的节奏，右侧留 actions 槽位。
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-wrap items-end justify-between gap-4', className)}>
      <div className="space-y-1.5">
        {eyebrow && (
          <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.28em] text-muted-foreground/80">
            <span className="h-px w-4 bg-primary/70" aria-hidden />
            {eyebrow}
          </p>
        )}
        <h1 className="text-2xl font-semibold tracking-tight sm:text-[1.7rem]">{title}</h1>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}
