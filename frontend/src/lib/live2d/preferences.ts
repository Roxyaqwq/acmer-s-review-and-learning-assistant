export interface Live2DPosition {
  x: number
  y: number
}

export interface Live2DPreference {
  enabled: boolean
  position: Live2DPosition | null
  model: number
  // null means "decide from the viewport width"; true/false means the user chose.
  collapsed: boolean | null
}

// Candidate mascot models. Order must match ModelDir in lappdefine.ts.
export const LIVE2D_MODELS = ['Haru', 'Hiyori', 'Mao', 'Zundamon', 'Koharu'] as const
export type Live2DModelName = (typeof LIVE2D_MODELS)[number]

export const LIVE2D_DEFAULTS: Live2DPreference = { enabled: true, position: null, model: 0, collapsed: null }

export const STORAGE_KEYS = {
  enabled: 'live2d.enabled',
  position: 'live2d.position',
  model: 'live2d.model',
  collapsed: 'live2d.collapsed',
} as const

export const LIVE2D_EVENT = 'live2d:changed'

export function loadLive2DPreference(): Live2DPreference {
  try {
    if (typeof window === 'undefined') return { ...LIVE2D_DEFAULTS }
    const pref: Live2DPreference = { ...LIVE2D_DEFAULTS }
    const enabledRaw = window.localStorage.getItem(STORAGE_KEYS.enabled)
    if (enabledRaw === '0') pref.enabled = false
    else if (enabledRaw === '1') pref.enabled = true
    const posRaw = window.localStorage.getItem(STORAGE_KEYS.position)
    if (posRaw) {
      try {
        const parsed = JSON.parse(posRaw)
        if (parsed && typeof parsed === 'object' && Number.isFinite(parsed.x) && Number.isFinite(parsed.y)) {
          pref.position = { x: Number(parsed.x), y: Number(parsed.y) }
        }
      } catch {
        // invalid JSON: fall back to default (null)
      }
    }
    const modelRaw = window.localStorage.getItem(STORAGE_KEYS.model)
    if (modelRaw != null) {
      const parsedModel = Number(modelRaw)
      if (Number.isInteger(parsedModel) && parsedModel >= 0 && parsedModel < LIVE2D_MODELS.length) {
        pref.model = parsedModel
      }
    }
    const collapsedRaw = window.localStorage.getItem(STORAGE_KEYS.collapsed)
    if (collapsedRaw === '1') pref.collapsed = true
    else if (collapsedRaw === '0') pref.collapsed = false
    return pref
  } catch {
    return { ...LIVE2D_DEFAULTS }
  }
}

export function saveLive2DPreference(patch: Partial<Live2DPreference>): void {
  try {
    if (typeof window === 'undefined') return
    const current = loadLive2DPreference()
    const next = { ...current, ...patch }
    window.localStorage.setItem(STORAGE_KEYS.enabled, next.enabled ? '1' : '0')
    if (next.position) {
      window.localStorage.setItem(STORAGE_KEYS.position, JSON.stringify(next.position))
    } else {
      window.localStorage.removeItem(STORAGE_KEYS.position)
    }
    if (Number.isInteger(next.model)) {
      window.localStorage.setItem(STORAGE_KEYS.model, String(next.model))
    }
    if (next.collapsed === null) {
      window.localStorage.removeItem(STORAGE_KEYS.collapsed)
    } else {
      window.localStorage.setItem(STORAGE_KEYS.collapsed, next.collapsed ? '1' : '0')
    }
    window.dispatchEvent(new CustomEvent(LIVE2D_EVENT))
  } catch {
    // storage unavailable (private mode etc.): in-memory state still applies
  }
}

export function subscribeLive2DPreference(listener: (pref: Live2DPreference) => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const handler = () => listener(loadLive2DPreference())
  window.addEventListener(LIVE2D_EVENT, handler)
  return () => window.removeEventListener(LIVE2D_EVENT, handler)
}