import { cn } from '@/lib/utils'
import { ratingTier } from '@/lib/rating'

/**
 * 题目难度徽章。
 *
 * 只用颜色不足以区分档位（色盲用户看不出来），所以档位名放进 title 和
 * 屏幕阅读器文本里，视觉上仍然是紧凑的一枚铜色方块。
 */
export function RatingBadge({
  rating,
  className,
}: {
  rating?: number | null
  className?: string
}) {
  const tier = ratingTier(rating)
  return (
    <span
      title={tier.label}
      className={cn(
        'inline-flex h-6 min-w-[3.5rem] items-center justify-center rounded-md border px-1.5 font-mono text-xs font-semibold tabular-nums',
        tier.pill,
        className
      )}
    >
      <span className="sr-only">{tier.label} </span>
      {rating && rating > 0 ? rating : '—'}
    </span>
  )
}
