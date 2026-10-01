/** @jest-environment jsdom */
/// <reference types="jest" />
import * as React from 'react'
import {act, renderHook} from '@testing-library/react'
import {useHeldLatest, useScrollTarget} from './use-scroll-target'

describe('useScrollTarget', () => {
  test('keeps one target for the life of the list, and listOwnsEnd follows its state', () => {
    const {rerender, result} = renderHook(() => useScrollTarget())
    const {scrollTarget} = result.current
    expect(result.current.listOwnsEnd).toBe(true)
    act(() => {
      scrollTarget.decide({type: 'userScrolled'})
    })
    expect(result.current.listOwnsEnd).toBe(false)
    rerender()
    expect(result.current.scrollTarget).toBe(scrollTarget)
  })
})

describe('useHeldLatest', () => {
  type Rows = {containsLatest: boolean; datasetKey: string; rows: ReadonlyArray<number>}
  // Every value the hook returned, render by render, as the list would lay each one out.
  const mount = (initial: Rows) => {
    const seen: Array<boolean> = []
    const set: {current: (r: Rows) => void} = {current: () => {}}
    renderHook(() => {
      const [rows, setRows] = React.useState(initial)
      set.current = setRows
      const held = useHeldLatest(rows.containsLatest, rows.datasetKey, rows.rows)
      seen.push(held)
      return held
    })
    return {
      seen,
      set: (r: Rows, transition = false) =>
        act(() => {
          if (transition) React.startTransition(() => set.current(r))
          else set.current(r)
        }),
    }
  }
  const history = {containsLatest: false, datasetKey: 'conv1:1', rows: [10, 11, 12]}

  test('a thread holding the newest message holds it from the start', () => {
    expect(mount({containsLatest: true, datasetKey: 'conv1:0', rows: [1, 2]}).seen).toEqual([true])
  })

  test.each([false, true])(
    'the page that brings the newest message into a window of history lands unheld (in a transition: %p), and the rows after it are held',
    transition => {
      const h = mount(history)
      h.set({...history, containsLatest: true, rows: [10, 11, 12, 13, 14]}, transition)
      expect(h.seen.at(-1)).toBe(false)
      expect(h.seen.slice(1)).not.toContain(true)
      h.set({...history, containsLatest: true, rows: [10, 11, 12, 13, 14, 15]}, transition)
      expect(h.seen.at(-1)).toBe(true)
    }
  )

  test.each([false, true])(
    'jump to recent: the newest rows refilling a cleared thread are held at once (in a transition: %p)',
    transition => {
      const h = mount(history)
      h.set({containsLatest: false, datasetKey: 'conv1:2', rows: []}, transition)
      const before = h.seen.length
      h.set({containsLatest: true, datasetKey: 'conv1:2', rows: [50, 51]}, transition)
      expect(h.seen.slice(before)).not.toContain(false)
      expect(h.seen.at(-1)).toBe(true)
    }
  )

  test('a new dataset that holds the newest message is held at once', () => {
    const h = mount(history)
    const before = h.seen.length
    h.set({containsLatest: true, datasetKey: 'conv2:0', rows: [1, 2]})
    expect(h.seen.slice(before)).not.toContain(false)
  })
})
