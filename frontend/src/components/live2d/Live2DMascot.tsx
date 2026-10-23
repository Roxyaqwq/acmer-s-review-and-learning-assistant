'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent, KeyboardEvent as ReactKeyboardEvent } from 'react'
import { ChevronDown, Sparkles, X } from 'lucide-react'
import {
  LIVE2D_MODELS,
  loadLive2DPreference,
  saveLive2DPreference,
  subscribeLive2DPreference,
  type Live2DPreference,
  type Live2DPosition,
} from '@/lib/live2d/preferences'

// Official Live2D Cubism Core (proprietary runtime, locally bundled).
// Loaded lazily via <script> so it never touches the server bundle.
const CORE_SRC = '/live2d/core/live2dcubismcore.min.js'
const STAGE_WIDTH = 240
const STAGE_HEIGHT = 320
const DRAG_THRESHOLD_PX = 5
const MARGIN_RIGHT = 24
const MARGIN_BOTTOM = 24
// The page content is capped at max-w-7xl (80rem). Below this viewport width the
// mascot would sit on top of the content column, so it starts minimised instead.
const OVERLAP_VIEWPORT_PX = 1280 + (STAGE_WIDTH + MARGIN_RIGHT) * 2

interface EngineHandle {
  // The lapp runtime is untyped vendored code, so the engine handle stays opaque.
  subdelegate: any
  dispose: () => void
}

interface DragState {
  pointerId: number
  startX: number
  startY: number
  originX: number
  originY: number
  moved: boolean
}

function cardWidth(): number {
  if (typeof window === 'undefined') return STAGE_WIDTH
  return window.innerWidth < 640 ? 180 : STAGE_WIDTH
}

function cardHeight(width: number): number {
  return Math.round((width * STAGE_HEIGHT) / STAGE_WIDTH)
}

function loadCoreScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('ssr'))
  if ((window as unknown as { Live2DCubismCore?: unknown }).Live2DCubismCore) return Promise.resolve()

  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-live2d-core="1"]')
    const onLoad = () => resolve()
    const onError = () => reject(new Error('failed to load Live2D Cubism Core'))
    if (existing) {
      existing.addEventListener('load', onLoad, { once: true })
      existing.addEventListener('error', onError, { once: true })
      return
    }
    const script = document.createElement('script')
    script.src = CORE_SRC
    script.async = true
    script.dataset.live2dCore = '1'
    script.addEventListener('load', onLoad, { once: true })
    script.addEventListener('error', onError, { once: true })
    document.body.appendChild(script)
  })
}

/**
 * Live2D (Cubism Web Framework) mascot, rendered onto a fixed-position canvas
 * that the user can drag around. Replaces the former static-image mascot.
 *
 * Model switching is driven by the shared Live2D preference (`model`); the
 * picker lives in the Navbar so the mascot itself stays unobtrusive.
 */
export function Live2DMascot() {
  const [enabled, setEnabled] = useState(false)
  // null = follow the viewport-width heuristic, true/false = the user chose.
  const [collapsedPref, setCollapsedPref] = useState<boolean | null>(null)
  const [viewportWidth, setViewportWidth] = useState(0)
  const [mounted, setMounted] = useState(false)
  const [position, setPosition] = useState<Live2DPosition | null>(null)
  const [dragging, setDragging] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<EngineHandle | null>(null)
  const positionRef = useRef<Live2DPosition | null>(null)
  const dragState = useRef<DragState | null>(null)
  // Model index that should be shown; applied once the engine is ready.
  const pendingModelRef = useRef(0)
  const appliedModelRef = useRef(-1)

  useEffect(() => {
    positionRef.current = position
  }, [position])

  const clampToViewport = useCallback((p: Live2DPosition): Live2DPosition => {
    const w = cardWidth()
    const h = cardHeight(w)
    return {
      x: Math.min(Math.max(0, p.x), Math.max(0, window.innerWidth - w)),
      y: Math.min(Math.max(0, p.y), Math.max(0, window.innerHeight - h)),
    }
  }, [])

  const defaultPosition = useCallback((): Live2DPosition => {
    const w = cardWidth()
    const h = cardHeight(w)
    return {
      x: window.innerWidth - w - MARGIN_RIGHT,
      y: window.innerHeight - h - MARGIN_BOTTOM,
    }
  }, [])

  // Applies a model index. Returns false when the engine is not ready yet
  // (the index is remembered and applied after init).
  const applyModel = useCallback((index: number): boolean => {
    const manager = engineRef.current?.subdelegate?.getLive2DManager?.()
    if (manager) {
      manager.changeScene(index)
      appliedModelRef.current = index
      pendingModelRef.current = index
      return true
    }
    pendingModelRef.current = index
    return false
  }, [])

  // Preference reading / subscription (enabled, collapsed, position, model).
  useEffect(() => {
    const applyPreference = (pref: Live2DPreference) => {
      setEnabled(pref.enabled)
      setCollapsedPref(pref.collapsed)
      pendingModelRef.current = pref.model
      if (!pref.enabled) return
      setPosition(clampToViewport(pref.position ?? defaultPosition()))
      if (pref.model !== appliedModelRef.current) applyModel(pref.model)
    }

    setViewportWidth(window.innerWidth)
    applyPreference(loadLive2DPreference())

    const unsubscribe = subscribeLive2DPreference((p) => {
      setEnabled(p.enabled)
      setCollapsedPref(p.collapsed)
      if (!p.enabled) return
      setPosition(clampToViewport(p.position ?? defaultPosition()))
      if (p.model !== appliedModelRef.current) applyModel(p.model)
    })

    const onResize = () => {
      setViewportWidth(window.innerWidth)
      setPosition((prev) => (prev ? clampToViewport(prev) : prev))
    }
    window.addEventListener('resize', onResize)

    return () => {
      unsubscribe()
      window.removeEventListener('resize', onResize)
    }
  }, [applyModel, clampToViewport, defaultPosition])

  // Collapsed by default on viewports where the stage would overlap the content.
  const collapsed = collapsedPref ?? (viewportWidth > 0 && viewportWidth < OVERLAP_VIEWPORT_PX)
  const visible = enabled && !collapsed

  useEffect(() => {
    if (!visible) {
      setMounted(false)
      return
    }
    setMounted(true)
    setPosition((prev) => prev ?? clampToViewport(loadLive2DPreference().position ?? defaultPosition()))
  }, [visible, clampToViewport, defaultPosition])

  // Engine lifecycle: load Core, boot Cubism Framework, run the render loop.
  useEffect(() => {
    if (!mounted) return
    const canvas = canvasRef.current
    if (!canvas) return

    let disposed = false
    let raf = 0
    let frameErrorLogged = false
    const loopControl = {
      start: () => {},
      stop: () => {},
    }

    // Pause rendering while the tab is hidden so an unseen mascot does not
    // keep burning GPU/CPU.
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') loopControl.start()
      else loopControl.stop()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    void (async () => {
      try {
        await loadCoreScript()
        if (disposed) return

        const framework = await import('@framework/live2dcubismframework')
        const { LAppPal } = await import('@/lib/live2d/lapp/lapppal')
        const { LAppSubdelegate } = await import('@/lib/live2d/lapp/lappsubdelegate')
        if (disposed) return

        const option = new framework.Option()
        option.logFunction = LAppPal.printMessage
        option.loggingLevel = framework.LogLevel.LogLevel_Error
        framework.CubismFramework.startUp(option)
        framework.CubismFramework.initialize()

        const subdelegate = new LAppSubdelegate()
        const ok = subdelegate.initialize(canvas)
        if (!ok) {
          framework.CubismFramework.dispose()
          return
        }
        if (disposed) {
          subdelegate.release()
          framework.CubismFramework.dispose()
          return
        }

        console.info('[live2d] engine initialized; loading model…')
        engineRef.current = {
          subdelegate,
          dispose: () => framework.CubismFramework.dispose(),
        }

        // Apply the currently selected model (initialize() loads index 0).
        const target = pendingModelRef.current
        if (target !== 0) {
          subdelegate.getLive2DManager().changeScene(target)
        }
        appliedModelRef.current = target

        let running = false
        const loop = () => {
          if (disposed || !running) return
          LAppPal.updateTime()
          try {
            subdelegate.update()
          } catch (err) {
            if (!frameErrorLogged) {
              frameErrorLogged = true
              console.error('[live2d] render loop error', err)
            }
          }
          raf = requestAnimationFrame(loop)
        }
        loopControl.start = () => {
          if (disposed || running) return
          running = true
          // Reset the time base so the first resumed frame does not receive an
          // inflated delta (which would make motions jump).
          LAppPal.updateTime()
          raf = requestAnimationFrame(loop)
        }
        loopControl.stop = () => {
          running = false
          if (raf) {
            cancelAnimationFrame(raf)
            raf = 0
          }
        }
        if (document.visibilityState === 'visible') loopControl.start()

      } catch (err) {
        console.error('[live2d] initialization failed', err)
      }
    })()

    return () => {
      disposed = true
      document.removeEventListener('visibilitychange', onVisibilityChange)
      loopControl.stop()
      if (raf) cancelAnimationFrame(raf)
      const engine = engineRef.current
      engineRef.current = null
      appliedModelRef.current = -1
      if (engine) {
        try {
          engine.subdelegate.release()
        } catch {
          // ignore teardown errors
        }
        try {
          engine.dispose()
        } catch {
          // ignore teardown errors
        }
      }
    }
  }, [mounted])

  const handlePointerDown = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    const origin = positionRef.current
    if (!origin) return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragState.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originX: origin.x,
      originY: origin.y,
      moved: false,
    }
    engineRef.current?.subdelegate.onPointBegan(e.clientX, e.clientY)
  }, [])

  const handlePointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const st = dragState.current
      if (!st || st.pointerId !== e.pointerId) return
      const dx = e.clientX - st.startX
      const dy = e.clientY - st.startY
      if (!st.moved && Math.hypot(dx, dy) >= DRAG_THRESHOLD_PX) {
        st.moved = true
        setDragging(true)
      }
      if (st.moved) {
        const next = clampToViewport({ x: st.originX + dx, y: st.originY + dy })
        positionRef.current = next
        setPosition(next)
      }
      engineRef.current?.subdelegate.onPointMoved(e.clientX, e.clientY)
    },
    [clampToViewport]
  )

  const handlePointerUp = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const st = dragState.current
      if (!st || st.pointerId !== e.pointerId) return
      dragState.current = null
      engineRef.current?.subdelegate.onPointEnded(e.clientX, e.clientY)
      if (!st.moved) return
      setDragging(false)
      const final = clampToViewport(positionRef.current ?? { x: 0, y: 0 })
      positionRef.current = final
      setPosition(final)
      saveLive2DPreference({ position: final })
    },
    [clampToViewport]
  )

  const handleKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLDivElement>) => {
      const origin = positionRef.current
      if (!origin) return
      const STEP = 16
      let dx = 0
      let dy = 0
      switch (e.key) {
        case 'ArrowLeft': dx = -STEP; break
        case 'ArrowRight': dx = STEP; break
        case 'ArrowUp': dy = -STEP; break
        case 'ArrowDown': dy = STEP; break
        default: return
      }
      e.preventDefault()
      const next = clampToViewport({ x: origin.x + dx, y: origin.y + dy })
      positionRef.current = next
      setPosition(next)
      saveLive2DPreference({ position: next })
    },
    [clampToViewport]
  )

  const handleHide = useCallback(() => {
    saveLive2DPreference({ enabled: false })
    setEnabled(false)
    setMounted(false)
    positionRef.current = null
    setPosition(null)
  }, [])

  const handleCollapse = useCallback(() => {
    saveLive2DPreference({ collapsed: true })
    setCollapsedPref(true)
  }, [])

  const handleExpand = useCallback(() => {
    saveLive2DPreference({ collapsed: false })
    setCollapsedPref(false)
  }, [])

  if (!enabled) return null

  if (!visible) {
    const modelName = LIVE2D_MODELS[loadLive2DPreference().model] ?? LIVE2D_MODELS[0]
    return (
      <div className="pointer-events-none fixed bottom-6 right-6 z-40">
        <button
          type="button"
          onClick={handleExpand}
          aria-label={`展开看板娘（${modelName}）`}
          title={`展开看板娘 · ${modelName}`}
          className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full border border-border/80 bg-background/80 text-muted-foreground shadow-lg backdrop-blur transition-colors hover:border-primary/50 hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Sparkles className="h-4 w-4" />
        </button>
      </div>
    )
  }

  if (!mounted || !position) return null

  const width = cardWidth()
  const height = cardHeight(width)
  const style: CSSProperties = {
    left: position.x,
    top: position.y,
    width,
    height,
    transition: dragging ? 'none' : 'left 0.2s ease-out, top 0.2s ease-out',
  }

  return (
    <div role="presentation" className="pointer-events-none fixed z-40 select-none" style={style}>
      <div
        className="group pointer-events-auto relative h-full w-full cursor-grab active:cursor-grabbing focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        style={{ touchAction: 'none' }}
        role="button"
        tabIndex={0}
        aria-label="看板娘，可拖动或用方向键移动位置"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onKeyDown={handleKeyDown}
      >
        <canvas ref={canvasRef} className="block h-full w-full" aria-hidden="true" />
        <div className="absolute -right-1 -top-1 flex flex-col gap-1 opacity-60 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          <button
            onClick={handleCollapse}
            onPointerDown={(e) => e.stopPropagation()}
            aria-label="收起看板娘"
            title="收起"
            className="rounded-full border border-border bg-popover p-1 text-popover-foreground shadow hover:text-foreground"
          >
            <ChevronDown className="h-3 w-3" />
          </button>
          <button
            onClick={handleHide}
            onPointerDown={(e) => e.stopPropagation()}
            aria-label="隐藏看板娘"
            title="隐藏"
            className="rounded-full border border-border bg-popover p-1 text-popover-foreground shadow hover:text-foreground"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  )
}