'use client'

import { BackToTop } from '@/components/ui/back-to-top'
import { ShortcutsPanel } from '@/components/ui/shortcuts-panel'
import { ErrorBoundary } from '@/components/ui/error-boundary'
import { Live2DMascot } from '@/components/live2d/Live2DMascot'
import { useGlobalShortcuts } from '@/hooks/useGlobalShortcuts'

export function GlobalOverlay() {
  useGlobalShortcuts()
  return (
    <>
      <BackToTop />
      <ShortcutsPanel />
      <ErrorBoundary fallback={null}>
        <Live2DMascot />
      </ErrorBoundary>
    </>
  )
}
