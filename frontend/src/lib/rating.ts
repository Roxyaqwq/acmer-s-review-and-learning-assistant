/**
 * Codeforces 分数档位。
 *
 * 颜色只在这里定义一次：题目列表的 rating 徽章、个人资料页的分布图都从这里取，
 * 免得每个页面各写一份接近但不相同的色值。档位名称沿用 CF 官方叫法，
 * 但界面上给中文，中文用户不必记 div2 那套黑话。
 */
export type RatingTier = {
  /** 中文档位名，用于徽章 title 与图例 */
  label: string
  /** 文字色，直接给 className 用 */
  text: string
  /** 徽章底色 + 描边，浅一点，保证深色主题下不刺眼 */
  pill: string
  /** 进度条 / 分布图使用的实色 */
  bar: string
}

const TIERS: Array<{ min: number } & RatingTier> = [
  { min: 2400, label: '特级', text: 'text-red-400', pill: 'border-red-500/30 bg-red-500/10 text-red-300', bar: 'bg-red-500' },
  { min: 2100, label: '大师', text: 'text-amber-400', pill: 'border-amber-500/30 bg-amber-500/10 text-amber-300', bar: 'bg-amber-500' },
  { min: 1900, label: '专家', text: 'text-violet-400', pill: 'border-violet-500/30 bg-violet-500/10 text-violet-300', bar: 'bg-violet-500' },
  { min: 1600, label: '进阶', text: 'text-blue-400', pill: 'border-blue-500/30 bg-blue-500/10 text-blue-300', bar: 'bg-blue-500' },
  { min: 1400, label: '熟练', text: 'text-cyan-400', pill: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300', bar: 'bg-cyan-500' },
  { min: 1200, label: '入门', text: 'text-emerald-400', pill: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300', bar: 'bg-emerald-500' },
  { min: 0, label: '新手', text: 'text-slate-400', pill: 'border-slate-500/30 bg-slate-500/10 text-slate-300', bar: 'bg-slate-500' },
]

const UNRATED: RatingTier = {
  label: '未标注',
  text: 'text-muted-foreground',
  pill: 'border-border bg-muted/60 text-muted-foreground',
  bar: 'bg-muted-foreground/40',
}

/** 分数 → 档位；没有分数（0 / null / undefined）返回中性档。 */
export function ratingTier(rating?: number | null): RatingTier {
  if (!rating || rating <= 0) return UNRATED
  return TIERS.find((tier) => rating >= tier.min) ?? UNRATED
}

/** 档位百分位：0 表示最低档，用来给分布图算高度。 */
export function ratingTierIndex(rating?: number | null): number {
  if (!rating || rating <= 0) return -1
  return TIERS.findIndex((tier) => rating >= tier.min)
}

export const RATING_TIER_COUNT = TIERS.length
