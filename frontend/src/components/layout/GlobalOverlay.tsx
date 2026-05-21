'use client'

import { BackToTop } from '@/components/ui/back-to-top'
import { ShortcutsPanel } from '@/components/ui/shortcuts-panel'
import { useGlobalShortcuts } from '@/hooks/useGlobalShortcuts'

export function GlobalOverlay() {
  useGlobalShortcuts()
  return (
    <>
      <BackToTop />
      <ShortcutsPanel />
    </>
  )
}
