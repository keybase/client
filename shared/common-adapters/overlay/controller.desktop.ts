import {activeElement, focusWasIn, onFocusIn, returnFocus} from './focus.desktop'
import * as Keys from './keys.desktop'
import {onMouseDown, onMouseUp} from './outside-click.desktop'
import {derive, entries, invalidate, type EntryBehavior, type EntryStructure} from './registry.desktop'
import {descendantsOf, hiddenIds, type StackEntry} from './stack.desktop'

// Every overlay registers here, and everything that asks "what is on top" (paint order, inertness,
// focus, hot keys, key handlers, Escape) reads the answer from the registry. Each overlay is a
// fixed-position child of #modal-root, and this is the only place that sets their z-index, so what
// is drawn on top always matches the stack.

const elementOf = (entry: StackEntry) =>
  entry.kind === 'root' ? document.getElementById('root') : (entries.get(entry.id)?.element ?? null)

// Applies the stack: covered entries (and the app root, under any blocking entry) are inert, some of
// them are also not drawn (see hiddenIds), and each entry is drawn above the ones before it in the stack.
const reconcile = () => {
  invalidate()
  const {covered, order} = derive()
  const hidden = hiddenIds(entries, order, covered)
  order.forEach((entry, index) => {
    const element = elementOf(entry)
    if (!element) {
      return
    }
    element.toggleAttribute('inert', covered.has(entry.id))
    if (entry.kind !== 'root') {
      element.toggleAttribute('data-hidden', hidden.has(entry.id))
      element.style.zIndex = String(index)
    }
  })
}

const restackListeners = new Set<() => void>()

// Runs after any change to the stack.
export const onRestack = (listener: () => void) => {
  restackListeners.add(listener)
  return () => {
    restackListeners.delete(listener)
  }
}

const restack = () => {
  reconcile()
  for (const listener of restackListeners) {
    listener()
  }
}

export const isEntryRegistered = (id: string) => entries.has(id)

let nextSeq = 1
let nextId = 1
export const newEntryId = () => `overlay-${nextId++}`

const tierOf = ({kind, tier}: EntryStructure) => tier ?? (kind === 'modal' ? 'modal' : 'app')

// The element is the entry's own in #modal-root; it is drawn here, in its place in the stack.
export const registerEntry = (
  id: string,
  structure: EntryStructure,
  behavior: EntryBehavior,
  element: HTMLElement
) => {
  listen()
  const {blocking, kind, parent, route = false} = structure
  entries.set(id, {
    ...behavior,
    blocking,
    dismissable: !!behavior.outside,
    dormant: false,
    element,
    id,
    kind,
    lastFocused: null,
    opener: activeElement(),
    parent,
    route,
    seq: nextSeq++,
    tier: tierOf(structure),
  })
  restack()
}

// An entry can change what it is in place, like the error banner becoming the disconnect overlay. It
// keeps its place among the entries opened around it; one that starts blocking takes focus (in
// entryMounted) and gives it back when it stops.
export const updateEntryStructure = (id: string, structure: EntryStructure) => {
  const entry = entries.get(id)
  if (!entry) {
    return
  }
  const {blocking, kind, parent, route = false} = structure
  const tier = tierOf(structure)
  if (
    entry.blocking === blocking &&
    entry.kind === kind &&
    entry.parent === parent &&
    entry.route === route &&
    entry.tier === tier
  ) {
    return
  }
  const active = activeElement()
  const hadFocus = !!active && !!entry.element?.contains(active)
  const wasBlocking = entry.blocking
  if (blocking && !wasBlocking && !hadFocus) {
    entry.opener = active
  }
  Object.assign(entry, {blocking, kind, parent, route, tier})
  restack()
  if (wasBlocking && !blocking && hadFocus) {
    returnFocus(entry)
  }
}

export const updateEntry = (id: string, behavior: EntryBehavior) => {
  const entry = entries.get(id)
  if (!entry) {
    return
  }
  const changed = entry.acceptsKeys !== behavior.acceptsKeys || entry.dismissable !== !!behavior.outside
  Object.assign(entry, behavior, {dismissable: !!behavior.outside})
  if (changed) {
    restack()
  }
}

// A popup that lost its anchor stays open but is not drawn, so it gives up keys and outside clicks
// to what is under it until it has one again.
export const setEntryDormant = (id: string, dormant: boolean) => {
  const entry = entries.get(id)
  if (entry && entry.dormant !== dormant) {
    entry.dormant = dormant
    invalidate()
  }
}

// What was opened from an entry goes with it. React detaches the entry before what is inside it, so
// left registered they would drop to the root for a moment, restack and move focus.
export const unregisterEntry = (id: string) => {
  const entry = entries.get(id)
  if (!entry) {
    return
  }
  const goneIds = [...descendantsOf(entries, id).reverse(), id]
  const gone = goneIds.flatMap(i => {
    const e = entries.get(i)
    entries.delete(i)
    return e?.element ? [e.element] : []
  })
  const hadFocus = focusWasIn(goneIds, gone)
  restack()
  if (hadFocus || (entry.blocking && !activeElement())) {
    returnFocus(entry)
  }
}

export const addKeyReceiver: typeof Keys.addKeyReceiver = (entry, receive) => {
  listen()
  return Keys.addKeyReceiver(entry, receive)
}

export const registerHotKeys: typeof Keys.registerHotKeys = (keys, cb, entry) => {
  listen()
  return Keys.registerHotKeys(keys, cb, entry)
}

let listening = false
const listen = () => {
  if (listening) {
    return
  }
  listening = true
  window.addEventListener('focusin', onFocusIn, true)
  window.addEventListener('mousedown', onMouseDown, true)
  window.addEventListener('mouseup', onMouseUp, true)
  window.addEventListener('keydown', Keys.onKeyDownCapture, true)
  window.addEventListener('keydown', Keys.onKeyDown)
  window.addEventListener('keypress', Keys.onKeyPress)
}
