import {rootEntryId} from './context'
import {matchesCombo, parseKeyCombo, shouldIgnoreEvent} from './key-combo.desktop'
import {
  coveredIds,
  isInsideEntry,
  keyHomeOf,
  outsideClickEntry,
  planTopLayer,
  scopeOf,
  stackOrder,
  topKeyEntry,
  type EntryKind,
  type StackEntry,
  type Tier,
} from './stack.desktop'

// The one desktop overlay stack of this window. Every overlay registers here, and everything that
// asks "what is on top" (paint order, inertness, focus, hot keys, key handlers, Escape) reads the
// answer from here. Each overlay is a manual popover, and this is the only place that shows or hides
// one, so the top layer always matches the stack.

type KeyType = 'keydown' | 'keypress'
// takes a key by returning true
type KeyReceiver = (type: KeyType, ev: KeyboardEvent) => boolean

export type EntryStructure = {
  kind: Exclude<EntryKind, 'root'>
  parent: string
  tier?: Tier
  blocking: boolean
}

export type EntryBehavior = {
  acceptsKeys: boolean
  // Escape that nothing inside took
  onEscape?: () => void
  // for a modal: an Escape a field inside it stopped is still handled, as if it had not been
  stoppedEscapeCloses: boolean
  // closes on a click outside `content` and every entry opened from it
  outside: {content: () => Element | null; onOutside: () => void; propagate: boolean} | undefined
  // a popup checks its anchor again
  syncAnchor: (() => void) | undefined
  // a popup: the element it is anchored to
  anchor: (() => HTMLElement | null) | undefined
}

type Entry = StackEntry &
  EntryBehavior & {
    // the popover; none for the root
    element: HTMLElement | null
    // what had focus when it opened
    opener: HTMLElement | null
    // what last had focus in it
    lastFocused: HTMLElement | null
  }

const makeRoot = (): Entry => ({
  acceptsKeys: true,
  anchor: undefined,
  blocking: false,
  dismissable: false,
  element: null,
  id: rootEntryId,
  kind: 'root',
  lastFocused: null,
  opener: null,
  outside: undefined,
  parent: undefined,
  seq: 0,
  stoppedEscapeCloses: false,
  syncAnchor: undefined,
  tier: 'app',
})

const entries = new Map<string, Entry>([[rootEntryId, makeRoot()]])
let nextSeq = 1
let nextId = 1
// the popovers this has shown, in the order it showed them, which is their top-layer order
let shown: ReadonlyArray<HTMLElement> = []

type Derived = {order: ReadonlyArray<StackEntry>; covered: ReadonlySet<string>; top: string}
let derived: Derived | undefined
const derive = (): Derived => {
  if (!derived) {
    const order = stackOrder(entries)
    const covered = coveredIds(order)
    derived = {covered, order, top: topKeyEntry(order, covered)}
  }
  return derived
}

const activeElement = () => {
  const active = document.activeElement
  return active instanceof HTMLElement && active !== document.body ? active : null
}

// Re-showing a popover must not move the caret, so focus and the selection in a field are put back
type SavedFocus = {element: HTMLElement; selection?: [number, number, 'forward' | 'backward' | 'none']}
const saveFocus = (): SavedFocus | undefined => {
  const element = activeElement()
  if (!element) {
    return undefined
  }
  if (
    (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) &&
    element.selectionStart !== null &&
    element.selectionEnd !== null
  ) {
    return {element, selection: [element.selectionStart, element.selectionEnd, element.selectionDirection ?? 'none']}
  }
  return {element}
}
const restoreFocus = (saved: SavedFocus | undefined) => {
  if (!saved || document.activeElement === saved.element || !saved.element.isConnected) {
    return
  }
  saved.element.focus({preventScroll: true})
  const {element, selection} = saved
  if (selection && (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) {
    element.setSelectionRange(...selection)
  }
}

const elementOf = (entry: StackEntry) =>
  entry.kind === 'root' ? document.getElementById('root') : (entries.get(entry.id)?.element ?? null)

// Applies the stack: covered entries (and the app root, under any blocking entry) are inert and
// covered overlays are hidden, and the top layer is put in stack order. Only something inserted under
// an entry that is already shown re-shows anything: what is above it.
const reconcile = () => {
  derived = undefined
  const {covered, order} = derive()
  for (const entry of order) {
    const element = elementOf(entry)
    if (!element) {
      continue
    }
    const isCovered = covered.has(entry.id)
    element.toggleAttribute('inert', isCovered)
    if (entry.kind !== 'root') {
      element.toggleAttribute('data-covered', isCovered)
    }
  }
  const desired = order.flatMap(e => {
    const element = e.kind === 'root' ? null : elementOf(e)
    return element ? [element] : []
  })
  const {hide, show} = planTopLayer(shown, desired)
  if (!hide.length && !show.length) {
    return
  }
  const saved = saveFocus()
  hide.forEach(element => {
    if (element.isConnected) {
      element.hidePopover()
    }
  })
  show.forEach(element => {
    element.showPopover()
  })
  shown = desired
  restoreFocus(saved)
}

// After any change to the stack: one popup may have mounted before what it anchors to.
const restack = () => {
  reconcile()
  for (const entry of entries.values()) {
    entry.syncAnchor?.()
  }
}

export const newEntryId = () => `overlay-${nextId++}`

// The element is a manual popover; it is shown here, in its place in the stack.
export const registerEntry = (
  id: string,
  structure: EntryStructure,
  behavior: EntryBehavior,
  element: HTMLElement
) => {
  listen()
  const {blocking, kind, parent, tier} = structure
  entries.set(id, {
    ...behavior,
    blocking,
    dismissable: !!behavior.outside,
    element,
    id,
    kind,
    lastFocused: null,
    opener: activeElement(),
    parent,
    seq: nextSeq++,
    tier: tier ?? (kind === 'modal' ? 'modal' : 'app'),
  })
  restack()
}

export const updateEntry = (id: string, behavior: EntryBehavior) => {
  const entry = entries.get(id)
  if (!entry) {
    return
  }
  const changed = entry.acceptsKeys !== behavior.acceptsKeys || entry.dismissable !== !!behavior.outside
  entry.acceptsKeys = behavior.acceptsKeys
  entry.onEscape = behavior.onEscape
  entry.stoppedEscapeCloses = behavior.stoppedEscapeCloses
  entry.outside = behavior.outside
  entry.dismissable = !!behavior.outside
  entry.syncAnchor = behavior.syncAnchor
  entry.anchor = behavior.anchor
  if (changed) {
    restack()
  }
}

// What is inside an entry mounts once it is shown. A blocking entry takes focus if nothing inside
// it did, so keys reach it and Tab starts in it.
export const entryMounted = (id: string) => {
  const entry = entries.get(id)
  const element = entry?.element
  if (!entry?.blocking || !element || element.contains(document.activeElement)) {
    return
  }
  element.focus({preventScroll: true})
}

const focusable = (element: HTMLElement | null | undefined): element is HTMLElement =>
  !!element?.isConnected && !element.closest('[inert]')

// Focus goes back to what opened the entry, else to where it last was in what is now on top.
const returnFocus = (entry: Entry) => {
  const {order, covered} = derive()
  const blocking = order.findLast(e => e.blocking && !covered.has(e.id))
  const top = blocking ? entries.get(blocking.id) : undefined
  const owner = entry.parent === undefined ? undefined : entries.get(entry.parent)
  const candidates = [
    entry.opener,
    owner?.lastFocused,
    top?.lastFocused,
    top?.element,
    entries.get(rootEntryId)?.lastFocused,
  ]
  for (const candidate of candidates) {
    if (focusable(candidate)) {
      candidate.focus({preventScroll: true})
      if (document.activeElement === candidate) {
        return
      }
    }
  }
}

export const unregisterEntry = (id: string) => {
  const entry = entries.get(id)
  if (!entry) {
    return
  }
  const {element} = entry
  const hadFocus = !!element?.contains(document.activeElement)
  entries.delete(id)
  if (element) {
    shown = shown.filter(e => e !== element)
    if (element.isConnected) {
      element.hidePopover()
    }
  }
  restack()
  if (hadFocus || (entry.blocking && !activeElement())) {
    returnFocus(entry)
  }
}

// A list recycled this row for another item: popups opened on what it showed before must not stay on
// what it shows now.
export const closePopupsAnchoredWithin = (row: Element) => {
  for (const entry of [...entries.values()]) {
    const anchor = entry.anchor?.()
    if (entry.kind === 'popup' && anchor && row.contains(anchor)) {
      entry.outside?.onOutside()
    }
  }
}

const entryAt = (target: EventTarget | null) => {
  const element = target instanceof Element ? target.closest('[data-overlay-entry]') : null
  return entries.get(element?.getAttribute('data-overlay-entry') ?? rootEntryId)
}

// One entry per click: the topmost dismissable one closes when a press both starts and ends outside
// it, without moving (a drag, like selecting text, is not a click). Inside means in its content or
// in any entry opened from it, wherever that is in the DOM.
type Press = {entry: string; inside: boolean; x: number; y: number}
let press: Press | undefined

const isInside = (id: string, target: EventTarget | null) => {
  const element = target instanceof Element ? target : null
  const hit = entryAt(element)?.id ?? rootEntryId
  const content = entries.get(id)?.outside?.content()
  return isInsideEntry(entries, id, {entry: hit, inContent: !!element && !!content?.contains(element)})
}

const onMouseDown = (ev: MouseEvent) => {
  const {covered, order} = derive()
  const entry = outsideClickEntry(order, covered)
  press =
    entry === undefined ? undefined : {entry, inside: isInside(entry, ev.target), x: ev.clientX, y: ev.clientY}
}

const onMouseUp = (ev: MouseEvent) => {
  const p = press
  press = undefined
  if (!p || p.inside || Math.abs(ev.clientX - p.x) >= 5 || Math.abs(ev.clientY - p.y) >= 5) {
    return
  }
  const {covered, order} = derive()
  const outside = entries.get(p.entry)?.outside
  if (!outside || outsideClickEntry(order, covered) !== p.entry || isInside(p.entry, ev.target)) {
    return
  }
  if (!outside.propagate) {
    ev.stopPropagation()
  }
  outside.onOutside()
}

const onFocusIn = (ev: FocusEvent) => {
  const entry = entryAt(ev.target)
  if (entry && ev.target instanceof HTMLElement) {
    entry.lastFocused = ev.target
  }
}

const receivers: Array<{entry: string; receive: KeyReceiver}> = []

export const addKeyReceiver = (entry: string, receive: KeyReceiver) => {
  listen()
  const item = {entry, receive}
  receivers.push(item)
  return () => {
    const i = receivers.indexOf(item)
    if (i !== -1) {
      receivers.splice(i, 1)
    }
  }
}

type HotKey = {cb: (combo: string) => void; entry: string}
const hotKeys = new Map<string, Array<HotKey>>()

export const registerHotKeys = (keys: ReadonlyArray<string>, cb: (combo: string) => void, entry: string) => {
  listen()
  const item = {cb, entry}
  const combos = keys.map(k => k.toLowerCase().trim())
  combos.forEach(combo => {
    hotKeys.set(combo, [...(hotKeys.get(combo) ?? []), item])
  })
  return () => {
    combos.forEach(combo => {
      const rest = (hotKeys.get(combo) ?? []).filter(h => h !== item)
      if (rest.length) {
        hotKeys.set(combo, rest)
      } else {
        hotKeys.delete(combo)
      }
    })
  }
}

// Hot keys registered in the modal (or the app root) that has the keys, the newest first.
const fireHotKey = (ev: KeyboardEvent, top: string) => {
  if (shouldIgnoreEvent(ev)) {
    return false
  }
  const scope = scopeOf(entries, top)
  for (const [combo, list] of hotKeys) {
    if (!matchesCombo(ev, parseKeyCombo(combo))) {
      continue
    }
    const hit = list.findLast(h => scopeOf(entries, h.entry) === scope)
    if (hit) {
      ev.preventDefault()
      ev.stopPropagation()
      hit.cb(combo)
      return true
    }
  }
  return false
}

// Only the newest handler in the entry that has the keys gets a key; keys never fall through to
// what is under it.
const deliver = (type: KeyType, ev: KeyboardEvent, top: string) => {
  const receiver = receivers.findLast(r => keyHomeOf(entries, r.entry) === top)
  if (receiver?.receive(type, ev) || type !== 'keydown' || ev.key !== 'Escape') {
    return
  }
  const entry = entries.get(top)
  // a blocking entry keeps Escape from everything under it even with nothing to do with it
  if (entry?.onEscape || entry?.blocking) {
    ev.preventDefault()
  }
  entry?.onEscape?.()
}

// An Escape seen on the way down, and the entry that had the keys then. If a field stops it, it
// never comes back up.
let pendingEscape: {ev: KeyboardEvent; entry: string} | undefined

// A field that handles Escape stops it. In a modal that wants it anyway it is delivered once the
// event is done, if the same entry still has the keys.
const onStoppedEscape = (ev: KeyboardEvent) => {
  if (pendingEscape?.ev !== ev) {
    return
  }
  const {entry} = pendingEscape
  pendingEscape = undefined
  if (derive().top !== entry) {
    return
  }
  const scope = scopeOf(entries, entry)
  if (scope !== undefined && entries.get(scope)?.stoppedEscapeCloses) {
    deliver('keydown', ev, entry)
  }
}

const onKeyDownCapture = (ev: KeyboardEvent) => {
  const {top} = derive()
  if (fireHotKey(ev, top) || ev.key !== 'Escape') {
    return
  }
  pendingEscape = {entry: top, ev}
  setTimeout(() => onStoppedEscape(ev), 0)
}

const onKey = (type: KeyType, ev: KeyboardEvent) => {
  if (pendingEscape?.ev === ev) {
    pendingEscape = undefined
  }
  deliver(type, ev, derive().top)
}

const onKeyDown = (ev: KeyboardEvent) => onKey('keydown', ev)
const onKeyPress = (ev: KeyboardEvent) => onKey('keypress', ev)

let listening = false
const listen = () => {
  if (listening) {
    return
  }
  listening = true
  window.addEventListener('focusin', onFocusIn, true)
  window.addEventListener('mousedown', onMouseDown, true)
  window.addEventListener('mouseup', onMouseUp, true)
  window.addEventListener('keydown', onKeyDownCapture, true)
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keypress', onKeyPress)
}
