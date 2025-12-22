import {isMac} from '@/constants/platform'
type KeyboardEventCallback = (e: {stopPropagation: () => void}, key: string) => void

const keyToCallback = new Map<string, KeyboardEventCallback>()
let globalHandler: ((e: KeyboardEvent) => void) | null = null

const normalizeKey = (key: string): string => {
  const lower = key.toLowerCase()
  if (lower === 'mod') {
    return isMac ? 'meta' : 'ctrl'
  }
  if (lower === 'cmd') {
    return 'meta'
  }
  if (lower === 'command') {
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

  for (const [comboStr, callback] of keyToCallback.entries()) {
    const combo = parseKeyCombo(comboStr)
    if (matchesCombo(e, combo)) {
      e.preventDefault()
      e.stopPropagation()
      callback(
        {
          stopPropagation: () => {
            e.stopPropagation()
          },
        },
        comboStr
      )
      break
    }
  }
}

const ensureGlobalHandler = (): void => {
  if (!globalHandler) {
    globalHandler = handleKeyDown
    document.addEventListener('keydown', globalHandler, true)
  }
}

const removeGlobalHandler = (): void => {
  if (globalHandler) {
    document.removeEventListener('keydown', globalHandler, true)
    globalHandler = null
  }
}

export const bind = (
  keys: Array<string> | string,
  callback: KeyboardEventCallback,
  _type?: 'keydown'
): void => {
  const keysArr = typeof keys === 'string' ? [keys] : keys
  ensureGlobalHandler()

  keysArr.forEach(key => {
    const normalizedKey = key.toLowerCase().trim()
    keyToCallback.set(normalizedKey, callback)
  })
}

export const unbind = (keys: Array<string> | string, _type?: 'keydown'): void => {
  const keysArr = typeof keys === 'string' ? [keys] : keys

  keysArr.forEach(key => {
    const normalizedKey = key.toLowerCase().trim()
    keyToCallback.delete(normalizedKey)
  })

  if (keyToCallback.size === 0) {
    removeGlobalHandler()
  }
}

export const reset = (): void => {
  keyToCallback.clear()
  removeGlobalHandler()
}
