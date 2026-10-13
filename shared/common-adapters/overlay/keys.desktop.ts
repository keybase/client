import {matchesCombo, parseKeyCombo, shouldIgnoreEvent, type KeyCombo} from './key-combo.desktop'
import {derive, entries, isClosing} from './registry.desktop'
import {keyHomeOf, scopeOf} from './stack.desktop'

// Keys in the overlay stack: hot keys, key handlers and Escape all go to the entry that has the keys.

type KeyType = 'keydown' | 'keypress'
// takes a key by returning true
type KeyReceiver = (type: KeyType, ev: KeyboardEvent) => boolean

const receivers: Array<{entry: string; receive: KeyReceiver}> = []

export const addKeyReceiver = (entry: string, receive: KeyReceiver) => {
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

// A field that handles Escape stops it. In a modal it is still delivered once the event is done, if
// the same entry still has the keys: only an Escape the field also prevented is handled in full and
// goes no further. Outside any modal a stopped Escape stays with the field.
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
  if (scope !== undefined && entries.get(scope)?.kind === 'modal') {
    deliver('keydown', ev, entry)
  }
}

export const onKeyDownCapture = (ev: KeyboardEvent) => {
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

export const onKeyDown = (ev: KeyboardEvent) => onKey('keydown', ev)
export const onKeyPress = (ev: KeyboardEvent) => onKey('keypress', ev)
