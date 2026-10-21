import * as React from 'react'
import {isDarwin} from '@/constants/platform'

type Rect = {x: number; width: number; height: number}
type Overlay = EventTarget & {visible: boolean; getTitlebarAreaRect: () => Rect}

// Space the OS window controls cover at each top corner, and the height of the strip they sit in
export type WindowControlsInsets = {left: number; right: number; height: number}

export const noInsets: WindowControlsInsets = {height: 0, left: 0, right: 0}

// The title bar area is the part of the top strip the controls leave free: whatever lies left or right
// of it is covered (Linux button layouts can put controls on either side, or both)
export const controlsInsets = (visible: boolean, rect: Rect, viewportWidth: number): WindowControlsInsets => {
  if (!visible) return noInsets
  const left = Math.max(0, Math.round(rect.x))
  const right = Math.max(0, Math.round(viewportWidth - (rect.x + rect.width)))
  if (!left && !right) return noInsets
  return {height: Math.round(rect.height), left, right}
}

export const sameInsets = (a: WindowControlsInsets, b: WindowControlsInsets) =>
  a.left === b.left && a.right === b.right && a.height === b.height

// Only Windows and Linux without the native frame have the overlay (main decides at window creation)
const getOverlay = () =>
  isDarwin ? undefined : (navigator as Navigator & {windowControlsOverlay?: Overlay}).windowControlsOverlay

const read = () => {
  const overlay = getOverlay()
  return overlay ? controlsInsets(overlay.visible, overlay.getTitlebarAreaRect(), window.innerWidth) : noInsets
}

// One cached value and one DOM listener shared by every subscriber
let current: WindowControlsInsets | undefined
const listeners = new Set<() => void>()

const update = () => {
  const next = read()
  if (current && sameInsets(current, next)) return
  current = next
  listeners.forEach(l => l())
}

// geometrychange fires whenever the title bar area moves or resizes, window resizes included
const subscribe = (onChange: () => void) => {
  const overlay = getOverlay()
  if (!overlay) return () => {}
  listeners.add(onChange)
  if (listeners.size === 1) {
    overlay.addEventListener('geometrychange', update)
    // nothing listened while there were no subscribers
    update()
  }
  return () => {
    listeners.delete(onChange)
    if (!listeners.size) {
      overlay.removeEventListener('geometrychange', update)
    }
  }
}

const getSnapshot = () => {
  current ??= read()
  return current
}

const getServerSnapshot = () => noInsets

// The space the OS window controls take at the top of the window, all zeros when there are none
export const useWindowControlsInsets = () =>
  React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
