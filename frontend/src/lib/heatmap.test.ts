import { describe, expect, it } from 'vitest'
import { buildHeatmapCalendar, toLocalDayKey } from './heatmap'

const day = (date: string, count: number) => ({ date, count })

describe('toLocalDayKey', () => {
  it('formats local calendar fields, not the UTC instant', () => {
    // Local midnight in any positive-offset zone is the previous day in UTC.
    const localMidnight = new Date(2026, 9, 23)
    expect(localMidnight.toISOString().slice(0, 10)).not.toBe('2026-10-23')
    expect(toLocalDayKey(localMidnight)).toBe('2026-10-23')
  })

  it('pads single-digit months and days', () => {
    expect(toLocalDayKey(new Date(2026, 0, 5))).toBe('2026-01-05')
  })
})

describe('buildHeatmapCalendar', () => {
  const today = new Date(2026, 9, 23) // 2026-10-23, a Friday

  it('ends on today and reads the last three days from the right buckets', () => {
    const calendar = buildHeatmapCalendar(
      [day('2026-10-23', 11), day('2026-10-22', 7), day('2026-10-21', 4)],
      today,
    )
    const cells = calendar.weeks.flat()
    const last = cells[cells.length - 1]

    expect(toLocalDayKey(last.date)).toBe('2026-10-23')
    expect(last.count).toBe(11)

    const byKey = new Map(cells.map((c) => [toLocalDayKey(c.date), c.count]))
    expect(byKey.get('2026-10-22')).toBe(7)
    expect(byKey.get('2026-10-21')).toBe(4)
    expect(byKey.get('2026-10-20')).toBe(0)
  })

  it('covers 365 days padded back to the previous Sunday', () => {
    const calendar = buildHeatmapCalendar([], today)
    const cells = calendar.weeks.flat()

    expect(cells.length).toBeGreaterThanOrEqual(365)
    expect(cells.length).toBeLessThanOrEqual(371)
    expect(cells[0].date.getDay()).toBe(0)
    // Every column is a full week except the current one, which stops at today.
    expect(calendar.weeks.slice(0, -1).every((w) => w.length === 7)).toBe(true)
    expect(calendar.weeks[calendar.weeks.length - 1].length).toBe(today.getDay() + 1)
    // First cell is the Sunday on or before 2025-10-24.
    expect(toLocalDayKey(cells[0].date)).toBe('2025-10-19')
  })

  it('counts only the visible window in the totals', () => {
    const calendar = buildHeatmapCalendar(
      [
        day('2026-10-23', 3),
        day('2026-10-20', 2),
        day('2025-01-01', 99), // outside the grid
      ],
      today,
    )
    expect(calendar.solved).toBe(5)
    expect(calendar.active).toBe(2)
  })

  it('labels every month boundary once, at the column it starts in', () => {
    const calendar = buildHeatmapCalendar([], today)
    // 365 days always cross 12 boundaries, and October shows up at both ends.
    expect(calendar.months.length).toBe(13)
    expect(calendar.months[0]).toEqual({ label: '10月', col: 0 })
    expect(calendar.months[calendar.months.length - 1].label).toBe('10月')

    const cols = calendar.months.map((m) => m.col)
    expect(cols).toEqual([...cols].sort((a, b) => a - b))
    expect(new Set(cols).size).toBe(cols.length)
  })

  it('tolerates timestamp-shaped keys from the API', () => {
    const calendar = buildHeatmapCalendar(
      [{ date: '2026-10-23T00:00:00Z', count: 5 }],
      today,
    )
    const cells = calendar.weeks.flat()
    expect(cells[cells.length - 1].count).toBe(5)
    expect(calendar.solved).toBe(5)
  })

  it('handles an empty payload without inventing days', () => {
    const calendar = buildHeatmapCalendar([], today)
    expect(calendar.solved).toBe(0)
    expect(calendar.active).toBe(0)
    expect(calendar.weeks.flat().every((c) => c.count === 0)).toBe(true)
  })
})
