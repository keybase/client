// Native stub — this modal wrapper is desktop-only (screen-layout.tsx uses it only in
// an isMobile === false branch). Typed structurally (not via the .desktop module) so
// native tsc doesn't type-check the DOM-using desktop file.
import type * as React from 'react'

export const ModalWrapper: React.ComponentType<{children?: React.ReactNode; [key: string]: unknown}> = () =>
  null
