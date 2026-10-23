export type HeatmapDay = {
  date: string
  count: number
}

export type HeatmapCell = {
  /** Local midnight of the day this cell stands for. */
  date: Date
  count: number
}

export type HeatmapCalendar = {
  /** One array per column, each starting on a Sunday (GitHub-style grid). */
  weeks: HeatmapCell[][]
  /** Month labels and the column each one starts at. */
  months: { label: string; col: number }[]
  /** Submissions inside the visible window only, so the header matches the grid. */
  solved: number
  active: number
}

/**
 * Formats a Date as `YYYY-MM-DD` using its **local** calendar fields.
 *
 * `toISOString().slice(0, 10)` looks equivalent but is not: for any timezone
 * east of UTC, local midnight is still the previous day in UTC, so every cell
 * would read the wrong day's count. The API returns these keys as plain local
 * dates, so the key has to be local too.
 */
export function toLocalDayKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Accepts `YYYY-MM-DD` and also tolerates a full timestamp (`...T00:00:00Z`),
 * which is what a `date` column scans into when the API forgets to format it.
 * Without this the lookup silently misses every bucket and the grid renders
 * blank while the counters still show activity.
 */
function normalizeDayKey(value: string): string {
  return value.slice(0, 10)
}

/**
 * Builds the 365-day contribution grid ending today (inclusive), padded back to
 * the previous Sunday so every column holds a full week.
 */
export function buildHeatmapCalendar(days: HeatmapDay[], today: Date = new Date()): HeatmapCalendar {
  const counts = new Map<string, number>()
  for (const day of days) counts.set(normalizeDayKey(day.date), day.count)

  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const cursor = new Date(end)
  cursor.setDate(cursor.getDate() - 364)
  while (cursor.getDay() !== 0) cursor.setDate(cursor.getDate() - 1)

  const weeks: HeatmapCell[][] = []
  const months: { label: string; col: number }[] = []
  let week: HeatmapCell[] = []
  let lastMonth = -1
  let solved = 0
  let active = 0

  while (cursor <= end) {
    const count = counts.get(toLocalDayKey(cursor)) ?? 0
    if (cursor.getDay() === 0 && week.length > 0) {
      weeks.push(week)
      week = []
    }
    week.push({ date: new Date(cursor), count })
    if (count > 0) {
      solved += count
      active += 1
    }

    const month = cursor.getMonth()
    if (month !== lastMonth) {
      months.push({ label: `${month + 1}月`, col: weeks.length })
      lastMonth = month
    }
    cursor.setDate(cursor.getDate() + 1)
  }
  if (week.length > 0) weeks.push(week)

  return { weeks, months, solved, active }
}
