import {rootEntryId} from './context'

// The desktop overlay stack as data: which overlay is above which, which are covered, and which one
// gets keys and outside clicks. No DOM here; the controller applies the answers.

// Paint order, low to high. An entry is never below the entry it was opened from.
export const tiers = {
  app: 0,
  modal: 1,
  accountReset: 2,
  globalError: 3,
  disconnect: 4,
  outOfDate: 5,
} as const
export type Tier = keyof typeof tiers

export type EntryKind = 'root' | 'modal' | 'popup' | 'global'

export type StackEntry = {
  id: string
  kind: EntryKind
  // the entry this one was opened from, or undefined for the root
  parent: string | undefined
  // the lowest tier it may sit in; it also sits at least as high as its parent
  tier: Tier
  // registration order
  seq: number
  // makes everything below it inert
  blocking: boolean
  // can be the entry keys go to
  acceptsKeys: boolean
  // closes on a click outside it
  dismissable: boolean
  // open but not drawn, like a popup with nothing to anchor to: takes neither keys nor clicks
  dormant: boolean
}

type Entries = ReadonlyMap<string, StackEntry>

const parentOf = (entries: Entries, entry: StackEntry) =>
  entry.parent === undefined ? undefined : (entries.get(entry.parent) ?? entries.get(rootEntryId))

const effectiveTier = (entries: Entries, entry: StackEntry): number => {
  const parent = parentOf(entries, entry)
  const own = tiers[entry.tier]
  return parent && parent !== entry ? Math.max(own, effectiveTier(entries, parent)) : own
}

// Every entry, bottom to top: a tree walk from the root with siblings in the order they opened,
// then lifted into tiers. A child is always above its parent, and a sibling opened later is above
// everything opened from an earlier one.
export const stackOrder = (entries: Entries): ReadonlyArray<StackEntry> => {
  const root = entries.get(rootEntryId)
  if (!root) {
    return []
  }
  const children = new Map<string, Array<StackEntry>>()
  for (const entry of entries.values()) {
    if (entry === root) {
      continue
    }
    const parent = parentOf(entries, entry) ?? root
    const list = children.get(parent.id) ?? []
    list.push(entry)
    children.set(parent.id, list)
  }
  const walked: Array<StackEntry> = []
  const walk = (entry: StackEntry) => {
    walked.push(entry)
    const list = children.get(entry.id) ?? []
    list.sort((a, b) => a.seq - b.seq)
    list.forEach(walk)
  }
  walk(root)
  const tierOf = new Map(walked.map(e => [e.id, effectiveTier(entries, e)]))
  return walked
    .map((entry, index) => ({entry, index}))
    .sort((a, b) => (tierOf.get(a.entry.id) ?? 0) - (tierOf.get(b.entry.id) ?? 0) || a.index - b.index)
    .map(({entry}) => entry)
}

// Entries with a blocking entry above them: inert and, if they are overlays, hidden.
export const coveredIds = (order: ReadonlyArray<StackEntry>): ReadonlySet<string> => {
  const covered = new Set<string>()
  let blockingAbove = false
  for (let i = order.length - 1; i >= 0; --i) {
    const entry = order[i]
    if (!entry) {
      continue
    }
    if (blockingAbove) {
      covered.add(entry.id)
    }
    blockingAbove = blockingAbove || entry.blocking
  }
  return covered
}

// The entry keys go to: the topmost one that takes keys and is neither covered nor dormant.
export const topKeyEntry = (order: ReadonlyArray<StackEntry>, covered: ReadonlySet<string>) =>
  order.findLast(e => e.acceptsKeys && !e.dormant && !covered.has(e.id))?.id ?? rootEntryId

const isScope = (entry: StackEntry) => entry.kind !== 'popup' && (entry.kind !== 'global' || entry.blocking)

// The modal, blocking global overlay or root an entry belongs to. Hot keys registered anywhere in it
// count as its own, so a menu open in a modal leaves the modal's hot keys on.
// Undefined for an entry that is not registered.
export const scopeOf = (entries: Entries, id: string) => {
  let entry = entries.get(id)
  if (!entry) {
    return undefined
  }
  while (entry && !isScope(entry)) {
    entry = parentOf(entries, entry)
  }
  return entry?.id ?? rootEntryId
}

// The entry a key handler registered in this one listens through: the nearest that takes keys.
// Undefined for an entry that is not registered.
export const keyHomeOf = (entries: Entries, id: string) => {
  let entry = entries.get(id)
  if (!entry) {
    return undefined
  }
  while (entry && !entry.acceptsKeys) {
    entry = parentOf(entries, entry)
  }
  return entry?.id ?? rootEntryId
}

const isDescendant = (entries: Entries, id: string, ancestor: string) => {
  let entry = entries.get(id)
  while (entry) {
    const parent = parentOf(entries, entry)
    if (!parent || parent === entry) {
      return false
    }
    if (parent.id === ancestor) {
      return true
    }
    entry = parent
  }
  return false
}

// Every entry opened from this one, at any depth.
export const descendantsOf = (entries: Entries, id: string) =>
  [...entries.keys()].filter(other => isDescendant(entries, other, id))

// The one entry a click outside can close: the topmost dismissable one neither covered nor dormant.
export const outsideClickEntry = (order: ReadonlyArray<StackEntry>, covered: ReadonlySet<string>) =>
  order.findLast(e => e.dismissable && !e.dormant && !covered.has(e.id))?.id

type Hit = {entry: string; inContent: boolean}

// A press is inside an entry when it lands in its content, or in any entry opened from it, wherever
// that is in the DOM.
export const isInsideEntry = (entries: Entries, id: string, hit: Hit) =>
  hit.entry === id ? hit.inContent : isDescendant(entries, hit.entry, id)

// Where a press lands for the entry a click outside would close. One on something drawn above it (an
// app-wide banner, or a popup opened from one) is that thing's, not a click outside.
export const pressOn = (entries: Entries, order: ReadonlyArray<StackEntry>, id: string, hit: Hit) => {
  if (isInsideEntry(entries, id, hit)) {
    return 'inside'
  }
  const index = (entry: string) => order.findIndex(e => e.id === entry)
  return index(hit.entry) > index(id) ? 'above' : 'outside'
}

// The top layer stacks in show order. To make it match `desired`, hide everything from the first
// difference up and show the rest of `desired` in order.
export const planTopLayer = <T>(shown: ReadonlyArray<T>, desired: ReadonlyArray<T>) => {
  let same = 0
  while (same < shown.length && same < desired.length && shown[same] === desired[same]) {
    ++same
  }
  return {hide: shown.slice(same).reverse(), show: desired.slice(same)}
}
