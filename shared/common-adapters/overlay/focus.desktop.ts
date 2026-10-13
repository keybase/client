import {rootEntryId} from './context'
import {derive, entries, entryAt, type Entry} from './registry.desktop'

// Focus in the overlay stack: a blocking entry takes it, and it goes back when an entry closes.

export const activeElement = () => {
  const active = document.activeElement
  return active instanceof HTMLElement && active !== document.body ? active : null
}

// What is inside an entry mounts once it is registered, or the entry started blocking. A blocking entry
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
export const returnFocus = (entry: Entry) => {
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

// Whether focus is in these entries, which are being removed, or was last in one of them.
export const focusWasIn = (ids: ReadonlyArray<string>, elements: ReadonlyArray<HTMLElement>) => {
  const active = activeElement()
  return active
    ? elements.some(element => element.contains(active))
    : focusedEntry !== undefined && ids.includes(focusedEntry)
}

export const onFocusIn = (ev: FocusEvent) => {
  const entry = entryAt(ev.target)
  focusedEntry = entry?.id
  if (entry && ev.target instanceof HTMLElement) {
    entry.lastFocused = ev.target
  }
}
