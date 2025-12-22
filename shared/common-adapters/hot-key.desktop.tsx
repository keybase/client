import * as React from 'react'
import * as C from '@/constants'
import {isMac} from '@/constants/platform'

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

const parseKeyCombo = (combo: string): {
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

const matchesCombo = (
  e: KeyboardEvent,
  combo: {key: string; ctrl: boolean; shift: boolean; alt: boolean; meta: boolean; hasMod: boolean}
): boolean => {
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

const shouldIgnoreEvent = (e: KeyboardEvent): boolean => {
  const target = e.target as HTMLElement | null
  if (!target) {
    return false
  }

  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    return target.getAttribute('data-allow-keyboard-shortcuts') !== 'true'
  }

  return false
}

const handleKeyDown = (e: KeyboardEvent): void => {
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

const ensureGlobalHandler = (): void => {
  if (!globalHandlerAttached) {
    globalHandlerAttached = true
    document.addEventListener('keydown', handleKeyDown, true)
  }
}

const removeGlobalHandler = (): void => {
  if (globalHandlerAttached && keyToCBStack.size === 0) {
    globalHandlerAttached = false
    document.removeEventListener('keydown', handleKeyDown, true)
  }
}

export function useHotKey(keys: Array<string> | string, cb: (key: string) => void) {
  const keysArr = React.useMemo(() => {
    const arr = typeof keys === 'string' ? [keys] : keys
    return arr.filter(k => k.length > 0)
  }, [keys])

  const register = React.useCallback(() => {
    if (keysArr.length === 0) {
      return
    }
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
  }, [keysArr, cb])

  const unregister = React.useCallback(() => {
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
  }, [keysArr, cb])

  C.Router2.useSafeFocusEffect(
    React.useCallback(() => {
      register()
      return () => {
        unregister()
      }
    }, [register, unregister])
  )

  React.useEffect(() => {
    register()
    return () => {
      unregister()
    }
  }, [register, unregister])
}
