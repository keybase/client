/** @jest-environment jsdom */
/// <reference types="jest" />
// Pins where the desktop thread list scrolls, and when, by mounting it over a fake LegendList that
// records every imperative scroll. jsdom has no layout, so rows sit on a fixed grid (see the
// harness) and the list's own declarative scrolling (initialScrollAtEnd, maintainScrollAtEnd,
// maintainVisibleContentPosition) is pinned as the props it hands the list, not simulated.
import {Activity} from 'react'
import * as T from '@/constants/types'
import {act, cleanup, fireEvent, render, screen} from '@testing-library/react'
import {OrangeLineContext} from '../orange-line-context'
import {ThreadRefsContext} from '../normal/context'
import * as H from './desktop-list-harness.desktop'
import {makeStore, threadTransitions, useStore} from './list-test-store'
import ThreadList from '.'

jest.mock('@legendapp/list/react', () => require('./desktop-list-harness.desktop').legendListModule)
jest.mock('../thread-context', () => require('./desktop-list-harness.desktop').threadContextModule)
jest.mock('../center-context', () => require('./desktop-list-harness.desktop').centerContextModule)
jest.mock('../input-area/input-state', () => require('./desktop-list-harness.desktop').inputStateModule)
jest.mock('../thread-load-status-context', () => ({useThreadLoadStatusOptionsGetter: () => () => ({})}))
jest.mock('../thread-search-route', () => ({useChatThreadRouteParams: () => undefined}))
jest.mock('../messages/special-top-message', () => () => null)
jest.mock('../messages/special-bottom-message', () => () => null)
jest.mock('../messages/separator', () => ({__esModule: true, NativeSeparator: () => null, default: () => null}))
jest.mock('../messages/wrapper', () => ({MessageRow: () => null}))
jest.mock('@/stores/current-user', () => ({
  useCurrentUserState: (selector: (s: {username: string}) => unknown) => selector({username: 'testuser'}),
}))

const ord = T.Chat.numberToOrdinal
const noAnimation = {animated: false}

// Another tab selected hides the chat tab the way left-tab-navigator does, with Activity, which
// unmounts its effects; selecting it again re-mounts them with nothing changed.
const tabStore = makeStore({hidden: false})
const Harness = (p: {orangeLine?: number}) => {
  const hidden = useStore(tabStore, s => s.hidden)
  return (
    <Activity mode={hidden ? 'hidden' : 'visible'}>
      <OrangeLineContext value={ord(p.orangeLine ?? 0)}>
        <ThreadRefsContext value={H.threadRefsValue}>
          <ThreadList />
        </ThreadRefsContext>
      </OrangeLineContext>
    </Activity>
  )
}
const switchTabAwayAndBack = () => {
  update(() => tabStore.set({hidden: true}))
  update(() => tabStore.set({hidden: false}))
}

const update = (fn: () => void) => {
  act(fn)
}

const tick = async (ms: number) => {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms)
  })
}

// Opens a loaded conversation of `count` messages, ordinals 1..count, optionally centered.
const open = (p: {center?: number; count?: number; moreToLoadForward?: boolean; orangeLine?: number} = {}) => {
  const {center, count = 60, moreToLoadForward = false, orangeLine} = p
  update(() => {
    H.threadStore.set({loaded: true, messageOrdinals: H.range(1, count), moreToLoadForward})
    if (center !== undefined) H.setCenter(ord(center))
  })
  render(<Harness orangeLine={orangeLine} />)
}

const props = () => {
  const p = H.listProps.current
  if (!p) throw new Error('list not rendered')
  return p
}

// The header's first measurement is the baseline; the second is the growth that re-pins.
const growHeader = () => {
  update(() => {
    ;(props()['onMetricsChange'] as (m: {headerSize: number}) => void)({headerSize: 100})
  })
  update(() => {
    ;(props()['onMetricsChange'] as (m: {headerSize: number}) => void)({headerSize: 152})
  })
}

const wheel = () => {
  fireEvent.wheel(screen.getByTestId('chat-message-list'))
}

// The thread's own transitions; thread-transitions.test.tsx holds them to the real thread store.
const clearThread = () => H.threadStore.set(threadTransitions.cleared(H.threadStore.get()))
const loadThread = (from: number, to: number) =>
  H.threadStore.set(threadTransitions.loaded(H.threadStore.get(), H.range(from, to)))

// Clears the thread the way a centered load does, then refills it.
const reloadDataset = (count = 60) => {
  update(() => {
    clearThread()
    H.listStore.set({isAtEnd: false, scroll: 0})
  })
  update(() => {
    loadThread(1, count)
  })
}

const scrollerNotAtEnd = () => {
  H.scroller.metrics = {clientHeight: 500, scrollHeight: 6000, scrollTop: 1000}
}
const scrollerAtEnd = () => {
  H.scroller.metrics = {clientHeight: 500, scrollHeight: 6000, scrollTop: 5499}
}

// Where the harness grid puts ordinal n dead centre in the viewport.
const centredOffset = (n: number) => (n - 1) * H.rowHeight + H.rowHeight / 2 - H.viewportHeight / 2

beforeEach(() => {
  jest.useFakeTimers()
  H.resetHarness()
  tabStore.reset({hidden: false})
  H.installLayout()
})

afterEach(() => {
  cleanup()
  jest.useRealTimers()
  jest.restoreAllMocks()
})

describe('opening a conversation', () => {
  test('lands at the end through the list props, with no imperative scroll', async () => {
    open()
    expect(props()['initialScrollAtEnd']).toBe(true)
    expect(props()['initialScrollIndex']).toBeUndefined()
    expect(props()['maintainScrollAtEnd']).toBe(true)
    expect(props()['maintainVisibleContentPosition']).toEqual({data: true})
    expect(props()['alignItemsAtEnd']).toBe(true)
    expect(props()['dataKey']).toBe('conv1:0')
    await tick(5000)
    expect(H.log).toEqual([])
  })

  test('opening centered starts at the target and hands the end to the reader', () => {
    open({center: 30})
    expect(props()['initialScrollAtEnd']).toBe(false)
    expect(props()['initialScrollIndex']).toEqual({index: 29, viewPosition: 0.5})
    expect(props()['maintainScrollAtEnd']).toBe(false)
    expect(props()['maintainVisibleContentPosition']).toEqual({data: true})
  })

  test('a centered ordinal not in the thread still disables the end anchor but starts at the end', () => {
    open({center: 500})
    expect(props()['initialScrollAtEnd']).toBe(true)
    expect(props()['initialScrollIndex']).toBeUndefined()
    expect(props()['maintainScrollAtEnd']).toBe(false)
  })

  test('the thread is marked read on the first onLoad only', () => {
    open()
    update(() => (props()['onLoad'] as () => void)())
    update(() => (props()['onLoad'] as () => void)())
    expect(H.markThreadAsRead).toHaveBeenCalledTimes(1)
  })
})

describe('header growth re-pins the end', () => {
  test('waits for the offset to hold still, then corrects once the end is reached', async () => {
    open()
    growHeader()
    await tick(50)
    expect(H.log).toEqual([])
    await tick(50)
    expect(H.log).toEqual([['scrollToEnd', noAnimation]])
    await tick(3000)
    expect(H.log).toEqual([['scrollToEnd', noAnimation]])
  })

  test('gives up after two corrections that do not reach the end', async () => {
    open()
    update(() => H.listStore.set({scrollToEndLands: false}))
    growHeader()
    await tick(3000)
    expect(H.log).toEqual([
      ['scrollToEnd', noAnimation],
      ['scrollToEnd', noAnimation],
    ])
  })

  test('the two corrections come 100ms apart', async () => {
    open()
    update(() => H.listStore.set({scrollToEndLands: false}))
    growHeader()
    await tick(100)
    expect(H.log).toHaveLength(1)
    await tick(99)
    expect(H.log).toHaveLength(1)
    await tick(1)
    expect(H.log).toHaveLength(2)
  })

  test('does nothing while the offset keeps moving, and stops after two seconds', async () => {
    open()
    update(() => H.listStore.set({scrollToEndLands: false}))
    growHeader()
    for (let t = 0; t < 2000; t += 50) {
      update(() => H.listStore.set({scroll: H.listStore.get().scroll + 1}))
      await tick(50)
    }
    expect(H.log).toEqual([])
    await tick(1000)
    expect(H.log).toEqual([])
  })

  test('does nothing when the list is already at its end', async () => {
    open()
    update(() => H.listStore.set({isAtEnd: true}))
    growHeader()
    await tick(3000)
    expect(H.log).toEqual([])
  })

  test('the first measurement is a baseline, not growth', async () => {
    open()
    update(() => (props()['onMetricsChange'] as (m: {headerSize: number}) => void)({headerSize: 152}))
    await tick(3000)
    expect(H.log).toEqual([])
  })

  test('an unchanged measurement is not growth', async () => {
    open()
    update(() => (props()['onMetricsChange'] as (m: {headerSize: number}) => void)({headerSize: 100}))
    update(() => (props()['onMetricsChange'] as (m: {headerSize: number}) => void)({headerSize: 100}))
    await tick(3000)
    expect(H.log).toEqual([])
  })

  test('a shrinking header re-pins too', async () => {
    open()
    update(() => (props()['onMetricsChange'] as (m: {headerSize: number}) => void)({headerSize: 152}))
    update(() => (props()['onMetricsChange'] as (m: {headerSize: number}) => void)({headerSize: 100}))
    await tick(100)
    expect(H.log).toEqual([['scrollToEnd', noAnimation]])
  })

  test('an empty thread has no end to hold', async () => {
    open({count: 0})
    growHeader()
    await tick(3000)
    expect(H.log).toEqual([])
  })

  test('not after the reader wheels away', async () => {
    open()
    wheel()
    growHeader()
    await tick(3000)
    expect(H.log).toEqual([])
  })

  test('a wheel mid-correction stops it before the correction that was due', async () => {
    open()
    growHeader()
    await tick(50)
    wheel()
    await tick(3000)
    expect(H.log).toEqual([])
  })

  test('a reload mid-correction stops it', async () => {
    open()
    growHeader()
    await tick(50)
    reloadDataset()
    await tick(3000)
    expect(H.log).toEqual([])
  })

  test('a wheel before the first check stops it outright', async () => {
    open()
    growHeader()
    wheel()
    await tick(3000)
    expect(H.log).toEqual([])
  })

  // The replaced loop does not fire the correction it was sleeping on; the new loop spends its own
  // budget of two.
  test('a second growth restarts the loop', async () => {
    open()
    update(() => H.listStore.set({scrollToEndLands: false}))
    growHeader()
    await tick(50)
    update(() => (props()['onMetricsChange'] as (m: {headerSize: number}) => void)({headerSize: 200}))
    await tick(50)
    expect(H.log).toHaveLength(0)
    await tick(3000)
    expect(H.log).toHaveLength(2)
  })
})

describe('centering on a target', () => {
  test('corrects to the measured centre once, then settles', async () => {
    open({center: 30})
    expect(H.log).toEqual([['scrollToOffset', {animated: false, offset: centredOffset(30)}]])
    await tick(5000)
    expect(H.log).toHaveLength(1)
  })

  test('mounts an unrendered target with scrollToIndex, then corrects the estimate', async () => {
    update(() => H.listStore.set({rendered: new Set(H.range(1, 10)), scrollToIndexError: 120}))
    open({center: 30})
    expect(H.log).toEqual([['scrollToIndex', {animated: false, index: 29, viewPosition: 0.5}]])
    await tick(100)
    expect(H.log).toEqual([
      ['scrollToIndex', {animated: false, index: 29, viewPosition: 0.5}],
      ['scrollToOffset', {animated: false, offset: centredOffset(30)}],
    ])
    await tick(5000)
    expect(H.log).toHaveLength(2)
  })

  test('keeps asking for an unmounted target every 100ms for three seconds', async () => {
    update(() => H.listStore.set({mountsOnScrollToIndex: false, rendered: new Set()}))
    open({center: 30})
    await tick(5000)
    expect(H.log).toHaveLength(30)
    expect(new Set(H.log.map(([name]) => name))).toEqual(new Set(['scrollToIndex']))
  })

  test('stops when pinned against an edge it cannot centre past', async () => {
    open({center: 1})
    expect(H.log).toEqual([['scrollToOffset', {animated: false, offset: centredOffset(1)}]])
    await tick(5000)
    expect(H.log).toHaveLength(1)
  })

  test('once stopped at an edge it stays stopped, even if the offset later moves', async () => {
    open({center: 1})
    await tick(150)
    update(() => H.listStore.set({scroll: 300}))
    await tick(5000)
    expect(H.log).toHaveLength(1)
  })

  test('re-corrects when the target drifts before it settles', async () => {
    open({center: 30})
    await tick(50)
    update(() => H.listStore.set({scroll: H.listStore.get().scroll - 40}))
    await tick(50)
    expect(H.log).toEqual([
      ['scrollToOffset', {animated: false, offset: centredOffset(30)}],
      ['scrollToOffset', {animated: false, offset: centredOffset(30)}],
    ])
  })

  test('drift inside the 8px deadband is left alone', async () => {
    open({center: 30})
    await tick(50)
    update(() => H.listStore.set({scroll: H.listStore.get().scroll - 8}))
    await tick(5000)
    expect(H.log).toHaveLength(1)
  })

  test('waits until the reload brings the target', () => {
    update(() => {
      H.setCenter(ord(30))
      clearThread()
    })
    render(<Harness />)
    expect(H.log).toEqual([])
    update(() => loadThread(1, 60))
    expect(H.log).toEqual([['scrollToOffset', {animated: false, offset: centredOffset(30)}]])
  })

  test('centres once per target: a prepend that shifts its index does not re-centre', async () => {
    open({center: 30})
    await tick(5000)
    update(() => H.threadStore.set({messageOrdinals: H.range(1, 90)}))
    await tick(5000)
    expect(H.log).toHaveLength(1)
  })

  test('a new target takes over from an in-flight loop', async () => {
    update(() => H.listStore.set({mountsOnScrollToIndex: false, rendered: new Set()}))
    open({center: 30})
    update(() => {
      H.setCenter(ord(40))
      clearThread()
    })
    update(() => loadThread(1, 60))
    await tick(250)
    expect(H.log).toEqual([
      ['scrollToIndex', {animated: false, index: 29, viewPosition: 0.5}],
      ['scrollToIndex', {animated: false, index: 39, viewPosition: 0.5}],
      ['scrollToIndex', {animated: false, index: 39, viewPosition: 0.5}],
      ['scrollToIndex', {animated: false, index: 39, viewPosition: 0.5}],
    ])
  })

  test('a wheel stops the loop', async () => {
    update(() => H.listStore.set({mountsOnScrollToIndex: false, rendered: new Set()}))
    open({center: 30})
    wheel()
    await tick(5000)
    expect(H.log).toHaveLength(1)
  })

  test('a thread update mid-loop does not stop it', async () => {
    update(() => H.listStore.set({mountsOnScrollToIndex: false, rendered: new Set()}))
    open({center: 30})
    update(() => H.threadStore.set({messageOrdinals: H.range(1, 70)}))
    await tick(250)
    expect(H.log).toHaveLength(3)
  })

  test('centering hands the end to the reader', async () => {
    open({center: 30})
    await tick(5000)
    H.log.length = 0
    growHeader()
    await tick(3000)
    expect(H.log).toEqual([])
  })

  test('re-centring on the same target after a reload scrolls to it again', async () => {
    open({center: 30})
    await tick(5000)
    H.log.length = 0
    reloadDataset()
    expect(props()['dataKey']).toBe('conv1:1')
    expect(H.log).toEqual([['scrollToOffset', {animated: false, offset: centredOffset(30)}]])
  })

  test('a reload mid-loop restarts centering, with a fresh budget, once the target is back', async () => {
    update(() => H.listStore.set({mountsOnScrollToIndex: false, rendered: new Set()}))
    open({center: 30})
    update(() => clearThread())
    await tick(250)
    // The target is gone from the emptied thread, so there is nothing to ask for.
    expect(H.log).toHaveLength(1)
    update(() => loadThread(1, 60))
    expect(H.log).toHaveLength(2)
    await tick(5000)
    expect(H.log).toHaveLength(31)
  })
})

describe('clearing the centre', () => {
  test('leaves the reader where they are, holding the end, and re-arms the list anchor', async () => {
    open({center: 30})
    await tick(5000)
    H.log.length = 0
    update(() => H.setCenter(undefined))
    expect(H.log).toEqual([])
    expect(props()['maintainScrollAtEnd']).toBe(true)
    expect(props()['initialScrollAtEnd']).toBe(true)
    update(() => H.listStore.set({isAtEnd: false}))
    growHeader()
    await tick(3000)
    expect(H.log).toEqual([])
  })

  test('after asking for the bottom, the end stays with the list', async () => {
    open({center: 30})
    await tick(5000)
    scrollerNotAtEnd()
    update(() => H.threadRefs.current?.scrollToBottom())
    update(() => H.setCenter(undefined))
    H.log.length = 0
    update(() => H.listStore.set({isAtEnd: false}))
    growHeader()
    await tick(100)
    expect(H.log).toEqual([['scrollToEnd', noAnimation]])
  })

  test('the latest messages arriving later does not scroll', async () => {
    open({center: 30, moreToLoadForward: true})
    await tick(5000)
    H.log.length = 0
    update(() => H.setCenter(undefined))
    update(() => H.threadStore.set({messageOrdinals: H.range(1, 70), moreToLoadForward: false}))
    await tick(3000)
    expect(H.log).toEqual([])
  })

  test('stops an in-flight loop', async () => {
    update(() => H.listStore.set({mountsOnScrollToIndex: false, rendered: new Set()}))
    open({center: 30})
    update(() => H.setCenter(undefined))
    await tick(5000)
    expect(H.log).toEqual([['scrollToIndex', {animated: false, index: 29, viewPosition: 0.5}]])
  })

  test('does nothing when the target never arrived', async () => {
    open({center: 500})
    update(() => H.setCenter(undefined))
    await tick(3000)
    expect(H.log).toEqual([])
  })

  test('does nothing after a reload forgot the centred target', async () => {
    open({center: 30})
    await tick(5000)
    update(() => clearThread())
    H.log.length = 0
    update(() => H.setCenter(undefined))
    expect(H.log).toEqual([])
  })
})

describe('jump to recent', () => {
  test('scrolls to the end before asking the thread to jump, then hides search', async () => {
    open({center: 30, moreToLoadForward: true})
    await tick(5000)
    H.log.length = 0
    scrollerNotAtEnd()
    fireEvent.click(screen.getByText('Jump to recent messages'))
    expect(H.log).toEqual([['scrollToEnd', noAnimation], ['jumpToRecent'], ['toggleThreadSearch', true]])
    // The provider clears the centre and the thread in one commit, then the newest messages load.
    update(() => {
      H.setCenter(undefined)
      clearThread()
    })
    update(() => {
      loadThread(1, 70)
      H.threadStore.set({moreToLoadForward: false})
    })
    await tick(3000)
    expect(H.log).toEqual([['scrollToEnd', noAnimation], ['jumpToRecent'], ['toggleThreadSearch', true]])
  })

  test('already at the end, it only asks the thread to jump', () => {
    open({moreToLoadForward: true})
    scrollerAtEnd()
    fireEvent.click(screen.getByText('Jump to recent messages'))
    expect(H.log).toEqual([['jumpToRecent'], ['toggleThreadSearch', true]])
  })

  test('re-pins the end even after a wheel', async () => {
    open({moreToLoadForward: true})
    wheel()
    scrollerAtEnd()
    fireEvent.click(screen.getByText('Jump to recent messages'))
    H.log.length = 0
    growHeader()
    await tick(100)
    expect(H.log).toEqual([['scrollToEnd', noAnimation]])
  })

  test('stops an in-flight centring loop, so the reader lands at the newest', async () => {
    update(() => H.listStore.set({mountsOnScrollToIndex: false, rendered: new Set()}))
    open({center: 30, moreToLoadForward: true})
    // The thread's jump clears the centre and the thread in one commit, then loads the newest.
    update(() => {
      H.setCenter(undefined)
      clearThread()
    })
    update(() => {
      loadThread(1, 70)
      H.threadStore.set({moreToLoadForward: false})
    })
    await tick(5000)
    expect(H.log).toEqual([['scrollToIndex', {animated: false, index: 29, viewPosition: 0.5}]])
  })

  test('is only offered when newer messages exist', () => {
    open()
    expect(screen.queryByText('Jump to recent messages')).toBeNull()
  })
})

describe('thread refs (keyboard and composer scrolling)', () => {
  test('scrollToBottom scrolls when away from the end', () => {
    open()
    scrollerNotAtEnd()
    update(() => H.threadRefs.current?.scrollToBottom())
    expect(H.log).toEqual([['scrollToEnd', noAnimation]])
  })

  test('scrollToBottom leaves an at-end list to its own anchor', () => {
    open()
    scrollerAtEnd()
    update(() => H.threadRefs.current?.scrollToBottom())
    expect(H.log).toEqual([])
  })

  test('scrollToBottom re-pins after a wheel', async () => {
    open()
    wheel()
    scrollerAtEnd()
    update(() => H.threadRefs.current?.scrollToBottom())
    growHeader()
    await tick(100)
    expect(H.log).toEqual([['scrollToEnd', noAnimation]])
  })

  test('scrollToBottom stops an in-flight centering loop, and a new message does not restart it', async () => {
    update(() => H.listStore.set({mountsOnScrollToIndex: false, rendered: new Set()}))
    open({center: 30})
    scrollerNotAtEnd()
    update(() => H.threadRefs.current?.scrollToBottom())
    update(() => H.threadStore.set({messageOrdinals: H.range(1, 61)}))
    await tick(3000)
    expect(H.log).toEqual([
      ['scrollToIndex', {animated: false, index: 29, viewPosition: 0.5}],
      ['scrollToEnd', noAnimation],
    ])
  })

  test('scrollToBottom before a centred target loads is not undone once it arrives', async () => {
    open()
    update(() => {
      H.setCenter(ord(30))
      clearThread()
    })
    H.log.length = 0
    act(() => H.threadRefs.current?.scrollToBottom())
    update(() => loadThread(1, 60))
    await tick(5000)
    expect(H.log).toEqual([['scrollToEnd', noAnimation]])
  })

  test('scrollUp pages up by one viewport and hands the end to the reader', async () => {
    open()
    update(() => H.listStore.set({scroll: 1200}))
    update(() => H.threadRefs.current?.scrollUp())
    expect(H.log).toEqual([['scrollToOffset', {animated: false, offset: 700}]])
    H.log.length = 0
    growHeader()
    await tick(3000)
    expect(H.log).toEqual([])
  })

  test('scrollUp stops at the top', () => {
    open()
    update(() => H.listStore.set({scroll: 200}))
    update(() => H.threadRefs.current?.scrollUp())
    expect(H.log).toEqual([['scrollToOffset', {animated: false, offset: 0}]])
  })

  test('scrollUp does not stop an in-flight centering loop', async () => {
    update(() => H.listStore.set({mountsOnScrollToIndex: false, rendered: new Set()}))
    open({center: 30})
    update(() => H.threadRefs.current?.scrollUp())
    await tick(100)
    expect(H.log.filter(([name]) => name === 'scrollToIndex')).toHaveLength(2)
  })

  test('scrollDown pages down by one viewport and keeps the end pinned', async () => {
    open()
    update(() => H.listStore.set({scroll: 1200}))
    update(() => H.threadRefs.current?.scrollDown())
    expect(H.log).toEqual([['scrollToOffset', {animated: false, offset: 1700}]])
    H.log.length = 0
    growHeader()
    await tick(100)
    expect(H.log).toEqual([['scrollToEnd', noAnimation]])
  })
})

describe('new messages', () => {
  test('appending while pinned leaves the end to the list anchor', async () => {
    open()
    update(() => H.threadStore.set({messageOrdinals: H.range(1, 61)}))
    update(() => H.threadStore.set({messageOrdinals: H.range(1, 62)}))
    await tick(3000)
    expect(H.log).toEqual([])
    expect(props()['maintainScrollAtEnd']).toBe(true)
  })

  test('appending while centred neither scrolls nor re-arms the anchor', async () => {
    open({center: 30})
    await tick(5000)
    H.log.length = 0
    update(() => H.threadStore.set({messageOrdinals: H.range(1, 61)}))
    await tick(3000)
    expect(H.log).toEqual([])
    expect(props()['maintainScrollAtEnd']).toBe(false)
  })
})

describe('editing', () => {
  test('reveals the message being edited, animated', () => {
    open()
    update(() => H.inputStore.set({editing: ord(15)}))
    expect(H.log).toEqual([['scrollToIndex', {animated: true, index: 14, viewPosition: 0.5}]])
  })

  test('once per edit, not on every render', () => {
    open()
    update(() => H.inputStore.set({editing: ord(15)}))
    update(() => H.threadStore.set({messageOrdinals: H.range(1, 61)}))
    expect(H.log).toHaveLength(1)
  })

  test('editing the same message again after stopping reveals it again', () => {
    open()
    update(() => H.inputStore.set({editing: ord(15)}))
    update(() => H.inputStore.set({editing: undefined}))
    update(() => H.inputStore.set({editing: ord(15)}))
    expect(H.log).toHaveLength(2)
  })

  test('stopping an edit does not scroll', () => {
    open()
    update(() => H.inputStore.set({editing: ord(15)}))
    H.log.length = 0
    update(() => H.inputStore.set({editing: undefined}))
    expect(H.log).toEqual([])
  })

  test('a message outside the thread is not revealed, even once it loads', () => {
    open({count: 10})
    update(() => H.inputStore.set({editing: ord(15)}))
    update(() => H.threadStore.set({messageOrdinals: H.range(1, 60)}))
    expect(H.log).toEqual([])
  })

  test('an edit already under way when the list mounts is revealed', () => {
    update(() => H.inputStore.set({editing: ord(15)}))
    open()
    expect(H.log).toEqual([['scrollToIndex', {animated: true, index: 14, viewPosition: 0.5}]])
  })

  test('revealing keeps the end pinned', async () => {
    open()
    update(() => H.inputStore.set({editing: ord(15)}))
    H.log.length = 0
    growHeader()
    await tick(100)
    expect(H.log).toEqual([['scrollToEnd', noAnimation]])
  })

  test('the reveal survives a reload: the same edit is not revealed twice', () => {
    open()
    update(() => H.inputStore.set({editing: ord(15)}))
    reloadDataset()
    expect(H.log).toHaveLength(1)
  })
})

describe('dataset reset', () => {
  test('changes the dataKey and hands the end back to the list', async () => {
    open()
    wheel()
    reloadDataset()
    expect(props()['dataKey']).toBe('conv1:1')
    growHeader()
    await tick(100)
    expect(H.log).toEqual([['scrollToEnd', noAnimation]])
  })

  test('resets the header baseline, so the first measurement after it is not growth', async () => {
    open()
    update(() => (props()['onMetricsChange'] as (m: {headerSize: number}) => void)({headerSize: 100}))
    reloadDataset()
    update(() => (props()['onMetricsChange'] as (m: {headerSize: number}) => void)({headerSize: 152}))
    await tick(3000)
    expect(H.log).toEqual([])
  })
})

describe('returning to the chat tab', () => {
  test('keeps a reader who wheeled away from a centred hit where they are', async () => {
    open({center: 30})
    await tick(5000)
    wheel()
    update(() => H.listStore.set({scroll: 0}))
    H.log.length = 0
    switchTabAwayAndBack()
    await tick(5000)
    expect(H.log).toEqual([])
  })

  test('keeps the end with a reader who wheeled away', async () => {
    open()
    wheel()
    switchTabAwayAndBack()
    growHeader()
    await tick(3000)
    expect(H.log).toEqual([])
  })

  test('keeps the header baseline: the next change is growth, not a new baseline', async () => {
    open()
    update(() => (props()['onMetricsChange'] as (m: {headerSize: number}) => void)({headerSize: 100}))
    switchTabAwayAndBack()
    update(() => (props()['onMetricsChange'] as (m: {headerSize: number}) => void)({headerSize: 152}))
    await tick(100)
    expect(H.log).toEqual([['scrollToEnd', noAnimation]])
  })

  test('a hit that finished centring is not centred again, however the rows moved it', async () => {
    update(() => {
      H.threadStore.set({loaded: true, messageOrdinals: H.range(21, 80)})
      H.setCenter(ord(50))
    })
    render(<Harness />)
    await tick(5000)
    // Older rows loading as the reader scrolls up move the hit down the grid.
    update(() => loadThread(1, 20))
    H.log.length = 0
    switchTabAwayAndBack()
    await tick(5000)
    expect(H.log).toEqual([])
  })

  test('a hit still centring when the tab was hidden is centred afresh', async () => {
    update(() => H.listStore.set({mountsOnScrollToIndex: false, rendered: new Set()}))
    open({center: 30})
    await tick(250)
    H.log.length = 0
    switchTabAwayAndBack()
    expect(H.log).toEqual([['scrollToIndex', {animated: false, index: 29, viewPosition: 0.5}]])
  })

  test('nothing scheduled fires while the tab is hidden', async () => {
    update(() => H.listStore.set({mountsOnScrollToIndex: false, rendered: new Set()}))
    open({center: 30})
    growHeader()
    H.log.length = 0
    update(() => tabStore.set({hidden: true}))
    await tick(5000)
    expect(H.log).toEqual([])
  })
})

describe('catch up', () => {
  test('the pill centres on the orange line through the centre actions', async () => {
    open({orangeLine: 10})
    update(() =>
      (props()['onViewableItemsChanged'] as (i: {viewableItems: Array<{item: T.Chat.Ordinal}>}) => void)({
        viewableItems: [{item: ord(50)}],
      })
    )
    fireEvent.click(screen.getByText('Catch up'))
    expect(H.log).toEqual([['centerOnMessage', {highlightMode: 'none', messageID: T.Chat.numberToMessageID(10)}]])
    // The provider sets the centre and clears the thread in one go, then reloads around it.
    update(() => {
      H.setCenter(ord(10))
      clearThread()
    })
    update(() => loadThread(1, 60))
    expect(H.log.at(-1)).toEqual(['scrollToOffset', {animated: false, offset: centredOffset(10)}])
    await tick(5000)
    expect(H.log).toHaveLength(2)
  })
})
