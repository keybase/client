import * as React from 'react'
import {isDarwin} from '@/constants/platform'

type Rect = {x: number; width: number}
type Overlay = EventTarget & {visible: boolean; getTitlebarAreaRect: () => Rect}

// How much of the right edge the OS window controls cover: the gap between the end of the title bar
// area and the right of the viewport
export const controlsRightInset = (overlay: Overlay | undefined, viewportWidth: number) => {
  if (!overlay?.visible) return 0
  const rect = overlay.getTitlebarAreaRect()
  return Math.max(0, Math.round(viewportWidth - (rect.x + rect.width)))
}

// Only Windows and Linux without the native frame have the overlay (main decides at window creation)
const getOverlay = () =>
  isDarwin ? undefined : (navigator as Navigator & {windowControlsOverlay?: Overlay}).windowControlsOverlay

const subscribe = (onChange: () => void) => {
  const overlay = getOverlay()
  if (!overlay) return () => {}
  overlay.addEventListener('geometrychange', onChange)
  window.addEventListener('resize', onChange)
  return () => {
    overlay.removeEventListener('geometrychange', onChange)
    window.removeEventListener('resize', onChange)
  }
}

const getSnapshot = () => controlsRightInset(getOverlay(), window.innerWidth)

// The width the OS window controls take at the top right of the window, 0 when there are none
export const useWindowControlsWidth = () => React.useSyncExternalStore(subscribe, getSnapshot, () => 0)
