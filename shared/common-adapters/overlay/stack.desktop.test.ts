/// <reference types="jest" />
import {
  coveredIds,
  isInsideEntry,
  keyHomeOf,
  outsideClickEntry,
  planTopLayer,
  scopeOf,
  stackOrder,
  topKeyEntry,
  type StackEntry,
} from './stack.desktop'
import {rootEntryId} from './context'

type Spec = Partial<StackEntry> & Pick<StackEntry, 'id' | 'kind'>

const modal = (id: string, parent = rootEntryId): Spec => ({
  acceptsKeys: true,
  blocking: true,
  dismissable: true,
  id,
  kind: 'modal',
  parent,
})
const popup = (id: string, parent: string, keys = true): Spec => ({
  acceptsKeys: keys,
  dismissable: keys,
  id,
  kind: 'popup',
  parent,
})
const global = (id: string, tier: StackEntry['tier'], blocking: boolean): Spec => ({
  acceptsKeys: blocking,
  blocking,
  id,
  kind: 'global',
  parent: rootEntryId,
  tier,
})

// entries in the order they registered
const stackOf = (...specs: ReadonlyArray<Spec>) => {
  const entries = new Map<string, StackEntry>()
  const add = (s: Spec, seq: number) =>
    entries.set(s.id, {
      acceptsKeys: false,
      blocking: false,
      dismissable: false,
      parent: undefined,
      seq,
      tier: s.kind === 'modal' ? 'modal' : 'app',
      ...s,
    })
  add({acceptsKeys: true, id: rootEntryId, kind: 'root'}, 0)
  specs.forEach((s, i) => add(s, i + 1))
  const order = stackOrder(entries)
  const covered = coveredIds(order)
  return {covered, entries, ids: order.map(e => e.id), order, top: topKeyEntry(order, covered)}
}

describe('overlay stack', () => {
  test('with nothing open the root gets keys and nothing is covered', () => {
    const s = stackOf()
    expect(s.ids).toEqual([rootEntryId])
    expect(s.top).toBe(rootEntryId)
    expect(s.covered.size).toBe(0)
  })

  test('a modal covers the root and everything opened from it, and takes keys', () => {
    const s = stackOf(popup('tooltip', rootEntryId, false), modal('m'))
    expect(s.ids).toEqual([rootEntryId, 'tooltip', 'm'])
    expect([...s.covered]).toEqual(['tooltip', rootEntryId])
    expect(s.top).toBe('m')
  })

  // problem 1: a covered modal is never re-shown, so its popups stay above it
  test('a popup in a covered modal stays above it, and uncovering re-shows nothing', () => {
    const covered = stackOf(modal('a'), popup('menu', 'a'), modal('b'))
    expect(covered.ids).toEqual([rootEntryId, 'a', 'menu', 'b'])
    expect(covered.covered.has('menu')).toBe(true)
    expect(covered.top).toBe('b')

    const uncovered = stackOf(modal('a'), popup('menu', 'a'))
    expect(uncovered.top).toBe('menu')
    expect(planTopLayer(['a', 'menu', 'b'], uncovered.ids.slice(1))).toEqual({hide: ['b'], show: []})
  })

  // a lower modal's popup opened after a later modal is still below that modal
  test('a popup opened later from a covered modal stays under the modal covering it', () => {
    const s = stackOf(modal('a'), modal('b'), popup('toast', 'a', false))
    expect(s.ids).toEqual([rootEntryId, 'a', 'toast', 'b'])
    expect(s.covered.has('toast')).toBe(true)
  })

  // problem 3: the reset cover is above every router modal, whenever either opened
  test('a router modal opened while the reset cover is up goes under it and is covered', () => {
    const s = stackOf(global('reset', 'accountReset', false), modal('resetCover', 'reset'), modal('feedback'))
    expect(s.ids).toEqual([rootEntryId, 'feedback', 'reset', 'resetCover'])
    expect(s.covered.has('feedback')).toBe(true)
    expect(s.top).toBe('resetCover')
    expect(scopeOf(s.entries, s.top)).toBe('resetCover')
    // the cover is re-shown above the modal inserted under it
    expect(planTopLayer(['reset', 'resetCover', 'feedback'], s.ids.slice(1))).toEqual({
      hide: ['feedback', 'resetCover', 'reset'],
      show: ['feedback', 'reset', 'resetCover'],
    })
  })

  test('global tiers keep their order whatever order they opened in', () => {
    const s = stackOf(
      global('outOfDate', 'outOfDate', false),
      global('disconnect', 'disconnect', true),
      global('banner', 'globalError', false),
      modal('m'),
      global('reset', 'accountReset', false)
    )
    expect(s.ids).toEqual([rootEntryId, 'm', 'reset', 'banner', 'disconnect', 'outOfDate'])
    // the disconnect overlay blocks everything under it, the out-of-date strip stays usable
    expect(s.covered.has('banner')).toBe(true)
    expect(s.covered.has('m')).toBe(true)
    expect(s.covered.has('outOfDate')).toBe(false)
    expect(s.top).toBe('disconnect')
  })

  test('a popup sits in the tier of what it was opened from', () => {
    const s = stackOf(global('banner', 'globalError', false), popup('tip', 'banner', false), modal('m'))
    expect(s.ids).toEqual([rootEntryId, 'm', 'banner', 'tip'])
    expect(s.covered.has('tip')).toBe(false)
  })

  // problem 5: a modal opened from a popup is above it, and the popup is covered
  test('a modal opened from a popup is above it and covers it', () => {
    const s = stackOf(popup('menu', rootEntryId), modal('dialog', 'menu'))
    expect(s.ids).toEqual([rootEntryId, 'menu', 'dialog'])
    expect(s.covered.has('menu')).toBe(true)
    expect(s.top).toBe('dialog')
  })

  test('a child that registered before its parent still sorts after it', () => {
    const entries = stackOf(popup('inner', 'outer'), popup('outer', rootEntryId))
    expect(entries.ids).toEqual([rootEntryId, 'outer', 'inner'])
  })

  // problem 6: the key target and the hot-key scope come from the same stack
  test('a menu in a modal takes keys while the hot keys stay the modal’s', () => {
    const s = stackOf(modal('m'), popup('menu', 'm'))
    expect(s.top).toBe('menu')
    expect(scopeOf(s.entries, s.top)).toBe('m')
    const root = stackOf(popup('menu', rootEntryId))
    expect(scopeOf(root.entries, root.top)).toBe(rootEntryId)
  })

  test('a popup that takes no keys leaves them to what is under it', () => {
    const s = stackOf(modal('m'), popup('tooltip', 'm', false))
    expect(s.top).toBe('m')
    expect(keyHomeOf(s.entries, 'tooltip')).toBe('m')
  })

  test('an entry that is not registered has no key home or scope', () => {
    const s = stackOf()
    expect(keyHomeOf(s.entries, 'gone')).toBeUndefined()
    expect(scopeOf(s.entries, 'gone')).toBeUndefined()
  })

  describe('outside clicks', () => {
    test('only the topmost uncovered dismissable entry is considered', () => {
      const s = stackOf(modal('m'), popup('menu', 'm'), popup('tooltip', 'menu', false))
      expect(outsideClickEntry(s.order, s.covered)).toBe('menu')
      const covered = stackOf(popup('menu', rootEntryId), modal('m', 'menu'))
      expect(outsideClickEntry(covered.order, covered.covered)).toBe('m')
    })

    test('a press in a popup opened from an entry is inside that entry', () => {
      const s = stackOf(popup('menu', rootEntryId), popup('submenu', 'menu'))
      expect(isInsideEntry(s.entries, 'menu', {entry: 'submenu', inContent: false})).toBe(true)
      expect(isInsideEntry(s.entries, 'menu', {entry: 'menu', inContent: true})).toBe(true)
      expect(isInsideEntry(s.entries, 'menu', {entry: 'menu', inContent: false})).toBe(false)
      expect(isInsideEntry(s.entries, 'submenu', {entry: 'menu', inContent: true})).toBe(false)
      expect(isInsideEntry(s.entries, 'menu', {entry: rootEntryId, inContent: true})).toBe(false)
    })
  })

  describe('planTopLayer', () => {
    test('opening on top shows only the new entry', () => {
      expect(planTopLayer(['a'], ['a', 'b'])).toEqual({hide: [], show: ['b']})
    })
    test('a stack that already matches needs nothing', () => {
      expect(planTopLayer(['a', 'c'], ['a', 'c'])).toEqual({hide: [], show: []})
    })
    test('an insert below re-shows everything above it', () => {
      expect(planTopLayer(['a', 'banner'], ['a', 'b', 'banner'])).toEqual({
        hide: ['banner'],
        show: ['b', 'banner'],
      })
    })
  })
})
