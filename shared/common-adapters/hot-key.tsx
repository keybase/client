import * as React from 'react'
import * as C from '@/constants'
import {isMac} from '@/constants/platform'

// Desktop-only keyboard shortcut system. On mobile, useHotKey is a no-op.

type KeyEvent = {
  key: string
  ctrlKey: boolean
  shiftKey: boolean
  altKey: boolean
  metaKey: boolean
  preventDefault: () => void
  stopPropagation: () => void
  target: {tagName?: string; getAttribute?: (name: string) => string | null} | null
}

type DocEventTarget = {
  addEventListener: (type: string, listener: (e: KeyEvent) => void, useCapture?: boolean) => void
  removeEventListener: (type: string, listener: (e: KeyEvent) => void, useCapture?: boolean) => void
}

const keyToCBStack = new Map<string, Array<(cmd: string) => void>>()

const normalizeKey = (key: string): string => {
  const lower = key.toLowerCase()
  if (lower === 'mod') {
    return isMac ? 'meta' : 'ctrl'
  }
  if (lower === 'cmd' || lower === 'command') {
    return 'meta'
  }
  return lower
}

const parseKeyCombo = (
  combo: string
): {
  key: string
  ctrl: boolean
  shift: boolean
  alt: boolean
  meta: boolean
  hasMod: boolean
} => {
  const parts = combo.split('+').map(p => p.trim().toLowerCase())
  let key = ''
  let ctrl = false
  let shift = false
  let alt = false
  let meta = false
  let hasMod = false

  for (const part of parts) {
    const lower = part.toLowerCase()
    if (lower === 'mod') {
      hasMod = true
      if (isMac) {
        meta = true
      } else {
        ctrl = true
      }
    } else {
      const normalized = normalizeKey(part)
      if (normalized === 'ctrl') {
        ctrl = true
      } else if (normalized === 'shift') {
        shift = true
      } else if (normalized === 'alt') {
        alt = true
      } else if (normalized === 'meta') {
        meta = true
      } else {
        key = part
      }
    }
  }

  return {alt, ctrl, hasMod, key, meta, shift}
}

type KeyCombo = {key: string; ctrl: boolean; shift: boolean; alt: boolean; meta: boolean; hasMod: boolean}

const matchesCombo = (e: KeyEvent, combo: KeyCombo): boolean => {
  const eventKey = e.key.toLowerCase()
  const comboKey = combo.key.toLowerCase()

  const keyMatches =
    eventKey === comboKey ||
    (comboKey === 'esc' && eventKey === 'escape') ||
    (comboKey === 'left' && eventKey === 'arrowleft') ||
    (comboKey === 'right' && eventKey === 'arrowright') ||
    (comboKey === 'up' && eventKey === 'arrowup') ||
    (comboKey === 'down' && eventKey === 'arrowdown') ||
    (comboKey === 'space' && eventKey === ' ') ||
    (comboKey === 'enter' && eventKey === 'enter') ||
    (comboKey === 'tab' && eventKey === 'tab') ||
    (comboKey === 'backspace' && eventKey === 'backspace') ||
    (comboKey === 'delete' && eventKey === 'delete')

  if (!keyMatches) {
    return false
  }

  if (combo.hasMod) {
    if (isMac) {
      return e.metaKey && !e.ctrlKey && e.shiftKey === combo.shift && e.altKey === combo.alt
    } else {
      return e.ctrlKey && !e.metaKey && e.shiftKey === combo.shift && e.altKey === combo.alt
    }
  }

  return (
    e.ctrlKey === combo.ctrl &&
    e.shiftKey === combo.shift &&
    e.altKey === combo.alt &&
    e.metaKey === combo.meta
  )
}

const shouldIgnoreEvent = (e: KeyEvent): boolean => {
  const target = e.target
  if (!target) {
    return false
  }

  const tagName = target.tagName?.toLowerCase()
  if (tagName === 'input' || tagName === 'textarea') {
    return target.getAttribute?.('data-allow-keyboard-shortcuts') !== 'true'
  }

  return false
}

const handleKeyDown = (e: KeyEvent): void => {
  if (shouldIgnoreEvent(e)) {
    return
  }

  for (const [comboStr, callbacks] of keyToCBStack.entries()) {
    if (callbacks.length === 0) {
      continue
    }
    const combo = parseKeyCombo(comboStr)
    if (matchesCombo(e, combo)) {
      const lastCallback = callbacks[callbacks.length - 1]
      if (lastCallback) {
        e.preventDefault()
        e.stopPropagation()
        lastCallback(comboStr)
      }
      break
    }
  }
}

let globalHandlerAttached = false

const doc = (globalThis as unknown as {document?: DocEventTarget}).document

const ensureGlobalHandler = (): void => {
  if (!globalHandlerAttached) {
    globalHandlerAttached = true
    doc?.addEventListener('keydown', handleKeyDown, true)
  }
}

const removeGlobalHandler = (): void => {
  if (globalHandlerAttached && keyToCBStack.size === 0) {
    globalHandlerAttached = false
    doc?.removeEventListener('keydown', handleKeyDown, true)
  }
}

const registerKeys = (keysArr: Array<string>, cb: (key: string) => void) => {
  ensureGlobalHandler()
  keysArr.forEach(key => {
    const normalizedKey = key.toLowerCase().trim()
    let cbs = keyToCBStack.get(normalizedKey)
    if (!cbs) {
      cbs = []
      keyToCBStack.set(normalizedKey, cbs)
    }
    cbs.push(cb)
  })
}

const unregisterKeys = (keysArr: Array<string>, cb: (key: string) => void) => {
  keysArr.forEach(key => {
    const normalizedKey = key.toLowerCase().trim()
    const cbs = keyToCBStack.get(normalizedKey)
    if (!cbs) return
    const idx = cbs.indexOf(cb)
    if (idx !== -1) {
      cbs.splice(idx, 1)
    }
    if (cbs.length === 0) {
      keyToCBStack.delete(normalizedKey)
    }
  })
  removeGlobalHandler()
}

export function useHotKey(keys: Array<string> | string, cb: (key: string) => void) {
  // callers pass inline arrays/closures, so derive stable identities for both:
  // otherwise every render unregisters and re-registers, which also re-orders the
  // LIFO stack and lets a re-rendering background screen steal the key
  const keysKey = typeof keys === 'string' ? keys : keys.join(',')
  const keysArr = React.useMemo(() => keysKey.split(',').filter(k => k.length > 0), [keysKey])

  const cbRef = React.useRef(cb)
  React.useEffect(() => {
    cbRef.current = cb
  })
  const [stableCB] = React.useState(() => (key: string) => cbRef.current(key))

  // registering again on focus re-pushes us to the top of the stack so the
  // focused screen wins the key over screens that merely stayed mounted
  C.Router2.useSafeFocusEffect(
    React.useCallback(() => {
      if (isMobile || keysArr.length === 0) return
      registerKeys(keysArr, stableCB)
      return () => unregisterKeys(keysArr, stableCB)
    }, [keysArr, stableCB])
  )

  React.useEffect(() => {
    if (isMobile || keysArr.length === 0) return
    registerKeys(keysArr, stableCB)
    return () => unregisterKeys(keysArr, stableCB)
  }, [keysArr, stableCB])
}
