import {rootEntryId} from './context'
import {matchesCombo, parseKeyCombo, shouldIgnoreEvent} from './key-combo.desktop'
import {
  coveredIds,
  keyHomeOf,
  scopeOf,
  stackOrder,
  topKeyEntry,
  type EntryKind,
  type StackEntry,
  type Tier,
} from './stack.desktop'

// The one desktop overlay stack of this window. Every overlay registers here, and everything that
// asks "what is on top" (hot keys, key handlers, Escape) reads the answer from here.

type KeyType = 'keydown' | 'keypress'
// takes a key by returning true
export type KeyReceiver = (type: KeyType, ev: KeyboardEvent) => boolean

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
}

type Entry = StackEntry & EntryBehavior

const makeRoot = (): Entry => ({
  acceptsKeys: true,
  blocking: false,
  dismissable: false,
  id: rootEntryId,
  kind: 'root',
  parent: undefined,
  seq: 0,
  stoppedEscapeCloses: false,
  tier: 'app',
})

const entries = new Map<string, Entry>([[rootEntryId, makeRoot()]])
let nextSeq = 1
let nextId = 1

type Derived = {top: string}
let derived: Derived | undefined
const derive = (): Derived => {
  if (!derived) {
    const order = stackOrder(entries)
    derived = {top: topKeyEntry(order, coveredIds(order))}
  }
  return derived
}
const changed = () => {
  derived = undefined
}

export const newEntryId = () => `overlay-${nextId++}`

export const registerEntry = (id: string, structure: EntryStructure, behavior: EntryBehavior) => {
  listen()
  const {blocking, kind, parent, tier} = structure
  entries.set(id, {
    ...behavior,
    blocking,
    dismissable: false,
    id,
    kind,
    parent,
    seq: nextSeq++,
    tier: tier ?? (kind === 'modal' ? 'modal' : 'app'),
  })
  changed()
}

export const updateEntry = (id: string, behavior: EntryBehavior) => {
  const entry = entries.get(id)
  if (!entry) {
    return
  }
  if (entry.acceptsKeys !== behavior.acceptsKeys) {
    changed()
  }
  Object.assign(entry, behavior)
}

export const unregisterEntry = (id: string) => {
  entries.delete(id)
  changed()
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
  window.addEventListener('keydown', onKeyDownCapture, true)
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keypress', onKeyPress)
}
