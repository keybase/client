import {isMac} from '@/constants/platform'

export type KeyCombo = {key: string; ctrl: boolean; shift: boolean; alt: boolean; meta: boolean; hasMod: boolean}

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

export const parseKeyCombo = (combo: string): KeyCombo => {
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

export const matchesCombo = (e: KeyboardEvent, combo: KeyCombo): boolean => {
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

// typing in a field is not a shortcut, unless the field opts in
export const shouldIgnoreEvent = (e: KeyboardEvent): boolean => {
  const target = e.target
  if (!(target instanceof Element)) {
    return false
  }
  const tagName = target.tagName.toLowerCase()
  if (tagName === 'input' || tagName === 'textarea') {
    return target.getAttribute('data-allow-keyboard-shortcuts') !== 'true'
  }
  return false
}
