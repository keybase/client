import {rootEntryId, type Tier} from './context'
import {coveredIds, stackOrder, topKeyEntry, type EntryKind, type StackEntry} from './stack.desktop'

// The one desktop overlay stack of this window: every registered entry, and what is on top of them.
// The controller changes it; focus, outside clicks and keys read it.

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
  // closes on a click outside `content` and every entry opened from it
  outside: {content: () => Element | null; onOutside: () => void; propagate: boolean} | undefined
  // already on its way out (its route is being removed): no Escape or click outside closes it again
  closing: (() => boolean) | undefined
}

export type Entry = StackEntry &
  EntryBehavior & {
    // the entry's element in #modal-root; none for the root
    element: HTMLElement | null
    // what had focus when it opened
    opener: HTMLElement | null
    // what last had focus in it
    lastFocused: HTMLElement | null
  }

const makeRoot = (): Entry => ({
  acceptsKeys: true,
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
  tier: 'app',
})

export const entries = new Map<string, Entry>([[rootEntryId, makeRoot()]])

type Derived = {order: ReadonlyArray<StackEntry>; covered: ReadonlySet<string>; top: string}
let derived: Derived | undefined
export const derive = (): Derived => {
  if (!derived) {
    const order = stackOrder(entries)
    const covered = coveredIds(order)
    derived = {covered, order, top: topKeyEntry(order, covered)}
  }
  return derived
}

// after any change to an entry that the stack order or what is on top depends on
export const invalidate = () => {
  derived = undefined
}

export const isClosing = (id: string) => !!entries.get(id)?.closing?.()

export const entryAt = (target: EventTarget | null) => {
  const element = target instanceof Element ? target.closest('[data-overlay-entry]') : null
  return entries.get(element?.getAttribute('data-overlay-entry') ?? rootEntryId)
}
