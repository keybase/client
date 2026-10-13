import {rootEntryId, type Tier} from './context'
import {matchesCombo, parseKeyCombo, shouldIgnoreEvent, type KeyCombo} from './key-combo.desktop'
import {
  coveredIds,
  descendantsOf,
  hiddenIds,
  keyHomeOf,
  outsideClickEntry,
  planTopLayer,
  pressOn,
  scopeOf,
  stackOrder,
  topKeyEntry,
  topLayerOrder,
  type EntryKind,
  type StackEntry,
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
  // a router modal
  route?: boolean
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
  // already on its way out (its route is being removed): no Escape or click outside closes it again
  closing: (() => boolean) | undefined
  // a popup: whether it is anchored in this element, or was, when its anchor was last there
  anchoredWithin: ((element: Element) => boolean) | undefined
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
  anchoredWithin: undefined,
  blocking: false,
  closing: undefined,
  dismissable: false,
  dormant: false,
  element: null,
  id: rootEntryId,
  kind: 'root',
  lastFocused: null,
  opener: null,
  outside: undefined,
  parent: undefined,
  route: false,
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

const isClosing = (id: string) => !!entries.get(id)?.closing?.()

const elementOf = (entry: StackEntry) =>
  entry.kind === 'root' ? document.getElementById('root') : (entries.get(entry.id)?.element ?? null)

// Applies the stack: covered entries (and the app root, under any blocking entry) are inert, some of
// them are also not drawn (see hiddenIds), and the top layer is put in stack order (tooltips and toasts on top,
// see topLayerOrder). Only something inserted under an entry that is already shown re-shows
// anything: what is above it.
const reconcile = () => {
  derived = undefined
  const {covered, order} = derive()
  const hidden = hiddenIds(entries, order, covered)
  for (const entry of order) {
    const element = elementOf(entry)
    if (!element) {
      continue
    }
    element.toggleAttribute('inert', covered.has(entry.id))
    if (entry.kind !== 'root') {
      element.toggleAttribute('data-hidden', hidden.has(entry.id))
    }
  }
  const desired = topLayerOrder(entries, order).flatMap(e => {
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
    // shown again only to restack: it must not fade in a second time
    if (hide.includes(element)) {
      element.setAttribute('data-reshown', '')
    }
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

const tierOf = ({kind, tier}: EntryStructure) => tier ?? (kind === 'modal' ? 'modal' : 'app')

// The element is a manual popover; it is shown here, in its place in the stack.
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
  entry.acceptsKeys = behavior.acceptsKeys
  entry.onEscape = behavior.onEscape
  entry.stoppedEscapeCloses = behavior.stoppedEscapeCloses
  entry.outside = behavior.outside
  entry.dismissable = !!behavior.outside
  entry.syncAnchor = behavior.syncAnchor
  entry.anchoredWithin = behavior.anchoredWithin
  entry.closing = behavior.closing
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
    derived = undefined
  }
}

// What is inside an entry mounts once it is shown, or the entry started blocking. A blocking entry
// takes focus if nothing inside it did, so keys reach it and Tab starts in it.
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
const tryReturnFocus = (entry: Entry) => {
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
  return candidates.some(candidate => {
    if (!focusable(candidate)) {
      return false
    }
    candidate.focus({preventScroll: true})
    return document.activeElement === candidate
  })
}

// What focus goes back to can still be inert for a moment: react-navigation makes the screen under
// a modal inert, and lifts that later in the same commit that removes the modal. So when nothing can
// take it yet, try again once the commit is done, and once more a frame later, as long as focus has
// not gone anywhere since.
const returnFocus = (entry: Entry) => {
  if (tryReturnFocus(entry)) {
    return
  }
  queueMicrotask(() => {
    if (activeElement() || tryReturnFocus(entry)) {
      return
    }
    requestAnimationFrame(() => {
      if (!activeElement()) {
        tryReturnFocus(entry)
      }
    })
  })
}

// The entry focus was last in. Focus that falls to the document (what had it unmounted or was
// hidden, or a field blurred itself) leaves it, so an entry closing after its content let go of
// focus still gives focus back.
let focusedEntry: string | undefined

// What was opened from an entry goes with it. React detaches the entry before what is inside it, so
// left registered they would drop to the root for a moment, reorder the top layer and move focus.
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
  const active = activeElement()
  const hadFocus = active
    ? gone.some(element => element.contains(active))
    : focusedEntry !== undefined && goneIds.includes(focusedEntry)
  shown = shown.filter(e => !gone.includes(e))
  gone.forEach(element => {
    if (element.isConnected) {
      element.hidePopover()
    }
  })
  restack()
  if (hadFocus || (entry.blocking && !activeElement())) {
    returnFocus(entry)
  }
}

// A list recycled this row for another item: popups opened on what it showed before must not stay on
// what it shows now.
export const closePopupsAnchoredWithin = (row: Element) => {
  for (const entry of [...entries.values()]) {
    if (entry.kind === 'popup' && entry.anchoredWithin?.(row)) {
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
// in any entry opened from it, wherever that is in the DOM. A press on something above it, like an
// app-wide banner, leaves it open.
type Press = {entry: string; outside: boolean; x: number; y: number}
let press: Press | undefined

const isOutside = (id: string, target: EventTarget | null) => {
  const element = target instanceof Element ? target : null
  const hit = entryAt(element)?.id ?? rootEntryId
  const content = entries.get(id)?.outside?.content()
  const inContent = !!element && !!content?.contains(element)
  return pressOn(entries, derive().order, id, {entry: hit, inContent}) === 'outside'
}

const onMouseDown = (ev: MouseEvent) => {
  const {covered, order} = derive()
  const entry = outsideClickEntry(order, covered)
  press =
    entry === undefined ? undefined : {entry, outside: isOutside(entry, ev.target), x: ev.clientX, y: ev.clientY}
}

const onMouseUp = (ev: MouseEvent) => {
  const p = press
  press = undefined
  if (!p?.outside || Math.abs(ev.clientX - p.x) >= 5 || Math.abs(ev.clientY - p.y) >= 5) {
    return
  }
  const {covered, order} = derive()
  const outside = entries.get(p.entry)?.outside
  if (
    !outside ||
    outsideClickEntry(order, covered) !== p.entry ||
    !isOutside(p.entry, ev.target) ||
    isClosing(p.entry)
  ) {
    return
  }
  if (!outside.propagate) {
    ev.stopPropagation()
  }
  outside.onOutside()
}

const onFocusIn = (ev: FocusEvent) => {
  const entry = entryAt(ev.target)
  focusedEntry = entry?.id
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
// each combo is parsed once, when it is first registered
const hotKeys = new Map<string, {combo: KeyCombo; list: ReadonlyArray<HotKey>}>()

export const registerHotKeys = (keys: ReadonlyArray<string>, cb: (combo: string) => void, entry: string) => {
  listen()
  const item = {cb, entry}
  const combos = keys.map(k => k.toLowerCase().trim())
  combos.forEach(key => {
    const registered = hotKeys.get(key)
    hotKeys.set(key, {combo: registered?.combo ?? parseKeyCombo(key), list: [...(registered?.list ?? []), item]})
  })
  return () => {
    combos.forEach(key => {
      const registered = hotKeys.get(key)
      const rest = registered?.list.filter(h => h !== item) ?? []
      if (registered && rest.length) {
        hotKeys.set(key, {combo: registered.combo, list: rest})
      } else {
        hotKeys.delete(key)
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
  for (const [key, {combo, list}] of hotKeys) {
    if (!matchesCombo(ev, combo)) {
      continue
    }
    const hit = list.findLast(h => scopeOf(entries, h.entry) === scope)
    if (hit) {
      ev.preventDefault()
      ev.stopPropagation()
      hit.cb(key)
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
  if (!isClosing(top)) {
    entry?.onEscape?.()
  }
}

// An Escape seen on the way down, and the entry that had the keys then. If a field stops it, it
// never comes back up.
let pendingEscape: {ev: KeyboardEvent; entry: string} | undefined

// A field that handles Escape stops it. In a modal that wants it anyway it is delivered once the
// event is done, if the same entry still has the keys. One the field also prevented it handled in
// full, so it goes no further.
const onStoppedEscape = (ev: KeyboardEvent) => {
  if (pendingEscape?.ev !== ev) {
    return
  }
  const {entry} = pendingEscape
  pendingEscape = undefined
  // one the field handled by closing the modal itself must not close it, or what is under it, again
  if (ev.defaultPrevented || derive().top !== entry || isClosing(entry)) {
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
