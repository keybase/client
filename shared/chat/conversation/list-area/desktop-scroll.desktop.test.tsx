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
    H.measureHeader(100)
  })
  update(() => {
    H.measureHeader(152)
  })
}

// The reader moving the scroller a notch, which is what a wheel does; the wheel event itself decides
// nothing.
const wheel = () => {
  fireEvent.wheel(screen.getByTestId('chat-message-list'))
  const {scroll} = H.listStore.get()
  update(() => H.moveScroller(scroll >= 100 ? scroll - 100 : scroll + 100))
}

// The thread's own transitions; thread-transitions.test.tsx holds them to the real thread store.
const clearThread = () => H.threadStore.set(threadTransitions.cleared(H.threadStore.get()))
const loadThread = (from: number, to: number) =>
  H.threadStore.set(threadTransitions.loaded(H.threadStore.get(), H.range(from, to)))

// Clears the thread the way a centered load does, then refills it.
const reloadDataset = (count = 60) => {
  update(() => {
    clearThread()
    H.listStore.set({scroll: 0})
  })
  update(() => {
    loadThread(1, count)
  })
}

// Where the list has put the scroller.
const endOffset = () => H.contentHeight() - H.viewportHeight
const scrollerNotAtEnd = () => {
  update(() => H.listStore.set({scroll: 1000}))
}
const scrollerAtEnd = () => {
  update(() => H.listStore.set({scroll: endOffset()}))
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
    growHeader()
    // The list's own anchor re-pinned it before the first check.
    scrollerAtEnd()
    await tick(3000)
    expect(H.log).toEqual([])
  })

  test('the first measurement is a baseline, not growth', async () => {
    open()
    update(() => H.measureHeader(152))
    await tick(3000)
    expect(H.log).toEqual([])
  })

  test('an unchanged measurement is not growth', async () => {
    open()
    update(() => H.measureHeader(100))
    update(() => H.measureHeader(100))
    await tick(3000)
    expect(H.log).toEqual([])
  })

  test('a shrinking header re-pins too', async () => {
    open()
    update(() => H.measureHeader(152))
    update(() => H.measureHeader(100))
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
    update(() => H.measureHeader(200))
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

  test('a centre whose target has not arrived keeps header growth from re-pinning the end', async () => {
    open()
    update(() => {
      H.setCenter(ord(500))
      clearThread()
    })
    update(() => loadThread(1, 60))
    growHeader()
    await tick(3000)
    expect(H.log).toEqual([])
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

describe('closing thread search (clearing the centre)', () => {
  test('leaves the reader where they are, not at the newest, holding the end, with the list anchor off until they come back to it', async () => {
    open({center: 30})
    await tick(5000)
    H.log.length = 0
    update(() => H.setCenter(undefined))
    expect(H.log).toEqual([])
    expect(props()['maintainScrollAtEnd']).toBe(false)
    expect(props()['initialScrollAtEnd']).toBe(true)
    growHeader()
    await tick(3000)
    expect(H.log).toEqual([])
    update(() => H.moveScroller(endOffset()))
    H.scrollEnds()
    expect(props()['maintainScrollAtEnd']).toBe(true)
  })

  // A hit among the newest rows cannot reach the middle, and centring leaves the list at its end.
  test('with the list resting at the newest message, hands the end back to the list, whose anchor follows new messages', async () => {
    open({center: 59})
    await tick(5000)
    expect(H.listStore.get().scroll).toBe(endOffset())
    expect(props()['maintainScrollAtEnd']).toBe(false)
    H.log.length = 0
    update(() => H.setCenter(undefined))
    expect(H.log).toEqual([])
    expect(props()['maintainScrollAtEnd']).toBe(true)
  })

  test('with the list resting at the end of a window of history, leaves the end with the reader', async () => {
    open({center: 59, moreToLoadForward: true})
    await tick(5000)
    update(() => H.setCenter(undefined))
    update(() => H.threadStore.set({messageOrdinals: H.range(1, 70), moreToLoadForward: false}))
    update(() => H.threadStore.set({messageOrdinals: H.range(1, 71)}))
    expect(props()['maintainScrollAtEnd']).toBe(false)
  })

  test('after asking for the bottom, the end stays with the list', async () => {
    open({center: 30})
    await tick(5000)
    scrollerNotAtEnd()
    update(() => H.threadRefs.current?.scrollToBottom())
    update(() => H.setCenter(undefined))
    H.log.length = 0
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

describe('a window of history (the thread does not hold the newest message)', () => {
  // Newer pages load at the end as the reader nears it; one landing must not carry the list along.
  test('the list does not hold its end, even with nothing centred', () => {
    open({center: 30, moreToLoadForward: true})
    update(() => H.setCenter(undefined))
    expect(props()['maintainScrollAtEnd']).toBe(false)
  })

  test('the page that brings the newest message lands unheld, and the end is held from the next rows on', () => {
    open({center: 30, moreToLoadForward: true})
    update(() => H.setCenter(undefined))
    update(() => H.threadStore.set({messageOrdinals: H.range(1, 90), moreToLoadForward: false}))
    // The reader, holding the end since the centre, scrolls down to it.
    update(() => H.moveScroller(endOffset()))
    H.scrollEnds()
    expect(H.listCommits.filter(c => c.data.length === 90).map(c => c['maintainScrollAtEnd'])).not.toContain(true)
    update(() => H.threadStore.set({messageOrdinals: H.range(1, 91)}))
    expect(props()['maintainScrollAtEnd']).toBe(true)
  })

  test('jump to recent lays the newest rows out held from their first commit', () => {
    open({center: 30, moreToLoadForward: true})
    update(() => {
      H.setCenter(undefined)
      clearThread()
    })
    update(() => {
      loadThread(1, 70)
      H.threadStore.set({moreToLoadForward: false})
    })
    expect(H.listCommits.filter(c => c.data.length === 70).map(c => c['maintainScrollAtEnd'])).not.toContain(false)
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
    // The cleared thread has nothing to scroll, so it is at its end already.
    act(() => H.threadRefs.current?.scrollToBottom())
    update(() => loadThread(1, 60))
    await tick(5000)
    expect(H.log).toEqual([])
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

  test.each(['scrollUp', 'scrollDown'] as const)('%s stops an in-flight centering loop', async page => {
    update(() => H.listStore.set({mountsOnScrollToIndex: false, rendered: new Set()}))
    open({center: 30})
    scrollerNotAtEnd()
    update(() => H.threadRefs.current?.[page]())
    await tick(3000)
    expect(H.log.filter(([name]) => name === 'scrollToIndex')).toHaveLength(1)
  })

  test('scrollDown pages down by one viewport, and short of the end hands the end to the reader', async () => {
    open()
    scrollerNotAtEnd()
    update(() => H.listStore.set({scroll: 1200}))
    update(() => H.threadRefs.current?.scrollDown())
    expect(H.log).toEqual([['scrollToOffset', {animated: false, offset: 1700}]])
    H.log.length = 0
    growHeader()
    await tick(3000)
    expect(H.log).toEqual([])
  })

  test('scrollDown that lands on the end hands it back to the list', async () => {
    open()
    scrollerNotAtEnd()
    update(() => H.threadRefs.current?.scrollDown())
    scrollerAtEnd()
    fireEvent(screen.getByTestId('fake-scroller'), new Event('scrollend'))
    H.log.length = 0
    growHeader()
    await tick(100)
    expect(H.log).toEqual([['scrollToEnd', noAnimation]])
  })

  test('scrollDown in a thread too short to scroll, which moves nothing, keeps the end with the list', async () => {
    open({count: 3})
    update(() => H.threadRefs.current?.scrollDown())
    expect(H.log).toEqual([])
    // Grows the thread past its viewport, so it has an end to scroll to.
    update(() => H.measureHeader(100))
    update(() => H.measureHeader(400))
    await tick(100)
    expect(H.log).toEqual([['scrollToEnd', noAnimation]])
  })

  test('scrollDown at the end, which moves nothing, keeps the end with the list', async () => {
    open()
    scrollerAtEnd()
    update(() => H.threadRefs.current?.scrollDown())
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

  // The list's own anchor counts a list within a tenth of its viewport of the end as at it.
  test('after the reader wheels a little way up, a new message leaves them there, until they come back down', () => {
    open()
    scrollerAtEnd()
    update(() => H.moveScroller(endOffset() - 30))
    update(() => H.threadStore.set({messageOrdinals: H.range(1, 61)}))
    expect(props()['maintainScrollAtEnd']).toBe(false)
    update(() => H.moveScroller(endOffset()))
    H.scrollEnds()
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

  test('editing the same message again after stopping, once it has left the view, reveals it again', () => {
    open()
    update(() => H.inputStore.set({editing: ord(15)}))
    update(() => H.inputStore.set({editing: undefined}))
    update(() => H.moveScroller(0))
    update(() => H.inputStore.set({editing: ord(15)}))
    expect(H.log).toHaveLength(2)
  })

  test('editing the same message again while the reveal still holds it in view does not scroll', () => {
    open()
    update(() => H.inputStore.set({editing: ord(15)}))
    update(() => H.inputStore.set({editing: undefined}))
    update(() => H.inputStore.set({editing: ord(15)}))
    expect(H.log).toHaveLength(1)
  })

  // Measuring a row forces a layout.
  test('the edited row is measured as the edit starts, not again on every change to the rows while it is open', () => {
    open()
    const measured = () =>
      (HTMLElement.prototype.getBoundingClientRect as jest.Mock).mock.contexts.filter(
        el => (el as HTMLElement).getAttribute('data-ordinal') === '15'
      ).length
    update(() => H.inputStore.set({editing: ord(15)}))
    const whenRevealed = measured()
    expect(whenRevealed).toBeGreaterThan(0)
    for (let n = 61; n <= 65; n++) update(() => H.threadStore.set({messageOrdinals: H.range(1, n)}))
    expect(measured()).toBe(whenRevealed)
  })

  test('stopping an edit does not scroll', () => {
    open()
    update(() => H.inputStore.set({editing: ord(15)}))
    H.log.length = 0
    update(() => H.inputStore.set({editing: undefined}))
    expect(H.log).toEqual([])
  })

  test('a message outside the thread is revealed once it loads', () => {
    open({count: 10})
    update(() => H.inputStore.set({editing: ord(15)}))
    expect(H.log).toEqual([])
    update(() => loadThread(11, 60))
    expect(H.log).toEqual([['scrollToIndex', {animated: true, index: 14, viewPosition: 0.5}]])
    update(() => loadThread(61, 70))
    expect(H.log).toHaveLength(1)
  })

  test('a message outside the thread whose edit stopped before it loaded is not revealed', () => {
    open({count: 10})
    update(() => H.inputStore.set({editing: ord(15)}))
    update(() => H.inputStore.set({editing: undefined}))
    update(() => loadThread(11, 60))
    expect(H.log).toEqual([])
  })

  test('an edit already under way when the list mounts is revealed', () => {
    update(() => H.inputStore.set({editing: ord(15)}))
    open()
    expect(H.log).toEqual([['scrollToIndex', {animated: true, index: 14, viewPosition: 0.5}]])
  })

  // At the end, the viewport shows rows 56..60 of 60.
  const atEnd = () => update(() => H.listStore.set({scroll: 60 * H.rowHeight - H.viewportHeight}))

  test('revealing a message out of view takes the reader off the end, and header growth leaves them on it', async () => {
    open()
    atEnd()
    update(() => H.inputStore.set({editing: ord(15)}))
    H.log.length = 0
    growHeader()
    await tick(3000)
    expect(H.log).toEqual([])
  })

  test('a message partly cut off at the edge of the view is revealed, and takes the reader off the end', async () => {
    open()
    update(() => H.listStore.set({scroll: 60 * H.rowHeight - H.viewportHeight - 50}))
    update(() => H.inputStore.set({editing: ord(55)}))
    expect(H.log).toEqual([['scrollToIndex', {animated: true, index: 54, viewPosition: 0.5}]])
    H.log.length = 0
    growHeader()
    await tick(3000)
    expect(H.log).toEqual([])
  })

  // The wrapper's padding below the scroller is not part of the view: a row reaching into it is cut off.
  // Measured where the reader left the list: one holding the end would be measured at the end.
  test('a message cut off at the bottom of the scroller, though inside the wrapper, is revealed', () => {
    open()
    update(() => H.moveScroller(60 * H.rowHeight - H.viewportHeight - H.wrapperPaddingBottom / 2))
    update(() => H.inputStore.set({editing: ord(60)}))
    expect(H.log).toEqual([['scrollToIndex', {animated: true, index: 59, viewPosition: 0.5}]])
  })

  // In either half: moving a row already in view to the middle only moves the list off its end.
  test.each([57, 59])('a message already wholly in view (%p) is not scrolled to, and header growth re-pins the end', async n => {
    open()
    atEnd()
    update(() => H.inputStore.set({editing: ord(n)}))
    expect(H.log).toEqual([])
    growHeader()
    await tick(100)
    expect(H.log).toEqual([['scrollToEnd', noAnimation]])
  })

  test('the reveal is the list\'s own scroll: a centring under way goes on', async () => {
    update(() => H.listStore.set({mountsOnScrollToIndex: false, rendered: new Set()}))
    open({center: 30})
    update(() => H.inputStore.set({editing: ord(15)}))
    await tick(250)
    expect(H.log.filter(([name, opts]) => name === 'scrollToIndex' && !(opts as {animated: boolean}).animated)).toHaveLength(3)
  })

  test('the reveal coming to rest at the end does not hand the end back while a centre is on its way', async () => {
    open()
    update(() => {
      H.setCenter(ord(500))
      clearThread()
    })
    update(() => loadThread(1, 60))
    scrollerNotAtEnd()
    update(() => H.inputStore.set({editing: ord(58)}))
    H.scrollEnds()
    H.log.length = 0
    growHeader()
    await tick(3000)
    expect(H.log).toEqual([])
  })

  // A row taller than the view is never wholly in it; centred already, revealing it moves nothing.
  test('a reveal that cannot move the list is not in flight: the reader wheeling to the end right after hands it back', async () => {
    update(() => H.listStore.set({rowHeights: new Map([[ord(58), 700]])}))
    open()
    update(() => H.listStore.set({scroll: 57 * H.rowHeight + 350 - H.viewportHeight / 2}))
    update(() => H.inputStore.set({editing: ord(58)}))
    expect(H.log).toEqual([])
    update(() => H.moveScroller(59 * H.rowHeight + 700 - H.viewportHeight))
    H.scrollEnds()
    growHeader()
    await tick(100)
    expect(H.log).toEqual([['scrollToEnd', noAnimation]])
  })

  // The reader's wheel interrupts the reveal's animated scroll before it comes to rest.
  test('the reader moving the list against a reveal in flight is the reader: wheeling back to the end hands it back', async () => {
    open()
    update(() => H.listStore.set({scroll: endOffset()}))
    update(() => H.inputStore.set({editing: ord(15)}))
    expect(H.log).toEqual([['scrollToIndex', {animated: true, index: 14, viewPosition: 0.5}]])
    update(() => H.moveScroller(endOffset()))
    H.scrollEnds()
    H.log.length = 0
    growHeader()
    await tick(100)
    expect(H.log).toEqual([['scrollToEnd', noAnimation]])
  })

  // The reveal is aimed at the viewport as the edit starts; the viewport shrinking after holds it
  // there again, but only while the reader has not moved the list.
  const revealAnimated = () => {
    update(() => H.listStore.set({animatedScrollsLand: false}))
    open()
    atEnd()
    update(() => H.inputStore.set({editing: ord(15)}))
    expect(H.log).toEqual([['scrollToIndex', {animated: true, index: 14, viewPosition: 0.5}]])
    H.log.length = 0
  }
  const shrinkAndHear = () => {
    update(() => H.resizeViewport(H.viewportHeight - 4))
    H.listHearsLayout()
  }

  test('a reveal animating for longer than a second is the list\'s own all the way', async () => {
    revealAnimated()
    update(() => H.moveScroller(4000))
    await tick(1500)
    update(() => H.moveScroller(2000))
    update(() => H.moveScroller(1200))
    H.scrollEnds()
    shrinkAndHear()
    expect(H.log).toEqual([['scrollToIndex', {animated: true, index: 14, viewPosition: 0.5}]])
  })

  test('a reveal landing past where it was measured to land is the list\'s own', () => {
    revealAnimated()
    update(() => H.moveScroller(2000))
    update(() => H.moveScroller(1100))
    update(() => H.moveScroller(1000))
    H.scrollEnds()
    shrinkAndHear()
    expect(H.log).toEqual([['scrollToIndex', {animated: true, index: 14, viewPosition: 0.5}]])
  })

  test('the reader moving the list back against a reveal still animating is the reader', () => {
    revealAnimated()
    update(() => H.moveScroller(2000))
    update(() => H.moveScroller(2500))
    H.scrollEnds()
    shrinkAndHear()
    expect(H.log).toEqual([])
  })

  test('the reveal survives a reload: the same edit is not revealed twice', () => {
    open()
    update(() => H.inputStore.set({editing: ord(15)}))
    reloadDataset()
    expect(H.log).toHaveLength(1)
  })
})

// The scroller changes height (the composer growing for typed lines or for the edit banner, a window
// resize) and keeps its scrollTop, as the browser does; the list hears of its new viewport only when
// its resize observer reports, after the commit that changed it. Starting an edit grows the composer in
// the same commit, so the edit is decided before the list has heard.
describe('the viewport changing height', () => {
  const shrunk = H.viewportHeight - 4
  const scrollerTop = () => screen.getByTestId('fake-scroller').scrollTop
  const scrollerEnd = () => {
    const s = screen.getByTestId('fake-scroller')
    return s.scrollHeight - s.clientHeight
  }
  // At the end, which the list's own anchor put it at.
  const heldAtEnd = () => scrollerAtEnd()
  const shrink = () => update(() => H.resizeViewport(shrunk))

  test('while the list holds its end, it re-pins it once it has heard of the new viewport', async () => {
    open()
    heldAtEnd()
    shrink()
    H.listHearsLayout()
    await tick(150)
    expect(H.log).toEqual([['scrollToEnd', noAnimation]])
    expect(scrollerTop()).toBe(scrollerEnd())
  })

  test('the list\'s first layout is where it starts, not a change', async () => {
    open()
    H.listHearsLayout()
    await tick(3000)
    expect(H.log).toEqual([])
  })

  test('a reader who holds the end is left where they are', async () => {
    open()
    heldAtEnd()
    wheel()
    shrink()
    H.listHearsLayout()
    await tick(3000)
    expect(H.log).toEqual([])
  })

  test('a window of history is left where it is, even with the reader resting at its end', async () => {
    open({center: 30, moreToLoadForward: true})
    update(() => H.setCenter(undefined))
    await tick(5000)
    update(() => H.moveScroller(endOffset()))
    H.scrollEnds()
    H.log.length = 0
    shrink()
    H.listHearsLayout()
    await tick(3000)
    expect(H.log).toEqual([])
  })

  test('entering an edit of the newest message keeps the end with the list, which re-pins it', async () => {
    open()
    heldAtEnd()
    update(() => {
      H.resizeViewport(shrunk)
      H.inputStore.set({editing: ord(60)})
    })
    expect(H.log).toEqual([])
    expect(props()['maintainScrollAtEnd']).toBe(true)
    H.listHearsLayout()
    await tick(150)
    expect(H.log).toEqual([['scrollToEnd', noAnimation]])
    expect(scrollerTop()).toBe(scrollerEnd())
  })

  const revealFromHistory = () => {
    open()
    heldAtEnd()
    update(() => H.moveScroller(1000))
    H.scrollEnds()
    update(() => {
      H.resizeViewport(shrunk)
      H.inputStore.set({editing: ord(60)})
    })
    expect(H.log).toEqual([['scrollToIndex', {animated: true, index: 59, viewPosition: 0.5}]])
    H.log.length = 0
  }

  test('an edit revealed from out of view lands in the viewport as it ends up', () => {
    revealFromHistory()
    // Aimed at the viewport the list knew of, the reveal stops short of the scroller's new end.
    expect(scrollerTop()).toBe(endOffset())
    H.listHearsLayout()
    expect(H.log).toEqual([['scrollToIndex', {animated: true, index: 59, viewPosition: 0.5}]])
    expect(scrollerTop()).toBe(scrollerEnd())
  })

  test('the reveal is held only until the reader moves the list', async () => {
    revealFromHistory()
    wheel()
    H.listHearsLayout()
    await tick(3000)
    expect(H.log).toEqual([])
  })

  test('the reveal is held only while the edit lasts', async () => {
    revealFromHistory()
    update(() => H.inputStore.set({editing: undefined}))
    H.listHearsLayout()
    await tick(3000)
    expect(H.log).toEqual([])
  })
})

// A row measuring at a new height after the list laid it out: the newest message, just received,
// measuring a few pixels taller once the thread has opened on it. The list's own end anchor re-pins
// only for a change of more than a few pixels.
describe('a row changing size', () => {
  const scrollerTop = () => screen.getByTestId('fake-scroller').scrollTop
  const scrollerEnd = () => {
    const s = screen.getByTestId('fake-scroller')
    return s.scrollHeight - s.clientHeight
  }
  // At the end, which the list's own anchor put it at.
  const heldAtEnd = () => scrollerAtEnd()
  const newestGrows = () => H.remeasureRow(ord(60), H.rowHeight + 3)

  // The list re-reads its isAtEnd only when it scrolls, so after the row grows with nothing scrolling
  // it still reads at-end; the thread has to be measured to see it is short.
  test('while the list holds its end, a late re-measure of a few pixels on the newest row ends at the end', async () => {
    open()
    heldAtEnd()
    H.log.length = 0
    newestGrows()
    expect(scrollerEnd() - scrollerTop()).toBe(3)
    await tick(3000)
    expect(H.log).toEqual([['scrollToEnd', noAnimation]])
    expect(scrollerEnd() - scrollerTop()).toBe(0)
  })

  // A reaction landing on the newest row: the list's own end anchor re-pins that.
  test('a change of more than five pixels is left to the list\'s own end anchor', async () => {
    open()
    heldAtEnd()
    H.log.length = 0
    H.remeasureRow(ord(60), H.rowHeight + 40)
    await tick(3000)
    expect(H.log).toEqual([])
  })

  // Rows measure for the first time as a thread opens, each within a few pixels of its estimate
  // here; the list's own end anchor re-pins for those. The header's re-pin corrects on schedule,
  // 100ms after the header grew, however many rows measure meanwhile.
  test('rows measuring for the first time do not restart the end loop', async () => {
    open()
    heldAtEnd()
    growHeader()
    await tick(75)
    update(() => {
      H.listStore.set({rowHeights: new Map([[ord(61), 74]])})
      H.threadStore.set({messageOrdinals: H.range(1, 61)})
    })
    await tick(25)
    expect(H.log).toEqual([['scrollToEnd', noAnimation]])
  })

  test('a re-measure of a few pixels restarts the end loop', async () => {
    open()
    heldAtEnd()
    growHeader()
    await tick(75)
    H.remeasureRow(ord(10), H.rowHeight + 3)
    await tick(25)
    expect(H.log).toEqual([])
    await tick(75)
    expect(H.log).toEqual([['scrollToEnd', noAnimation]])
  })

  test('while the list holds its end, a row growing there re-pins it, as the list\'s own scroll', async () => {
    open()
    heldAtEnd()
    newestGrows()
    await tick(150)
    expect(H.log).toEqual([['scrollToEnd', noAnimation]])
    expect(scrollerTop()).toBe(scrollerEnd())
    expect(props()['maintainScrollAtEnd']).toBe(true)
  })

  test('a list already at its end is left to its own anchor', async () => {
    open()
    heldAtEnd()
    H.remeasureRow(ord(10), H.rowHeight + 3)
    scrollerAtEnd()
    await tick(3000)
    expect(H.log).toEqual([])
  })

  test('a reader who holds the end is left where they are', async () => {
    open()
    heldAtEnd()
    wheel()
    newestGrows()
    await tick(3000)
    expect(H.log).toEqual([])
  })

  test('a centred target is left to its centring', async () => {
    open({center: 30})
    await tick(5000)
    H.log.length = 0
    newestGrows()
    await tick(3000)
    expect(H.log).toEqual([])
  })

  test('a window of history is left where it is, even with the reader resting at its end', async () => {
    open({center: 30, moreToLoadForward: true})
    update(() => H.setCenter(undefined))
    await tick(5000)
    update(() => H.moveScroller(endOffset()))
    H.scrollEnds()
    H.log.length = 0
    newestGrows()
    await tick(3000)
    expect(H.log).toEqual([])
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

  // The list reports its header only when its size changes, never for a new dataset, so the size
  // measured before the clear is still the one the list builds on.
  test('keeps the header baseline: after jump to recent, the header growing re-pins the end', async () => {
    open({center: 30, moreToLoadForward: true})
    update(() => H.measureHeader(100))
    await tick(5000)
    fireEvent.click(screen.getByText('Jump to recent messages'))
    update(() => {
      H.setCenter(undefined)
      clearThread()
    })
    update(() => {
      loadThread(1, 70)
      H.threadStore.set({moreToLoadForward: false})
    })
    H.log.length = 0
    update(() => H.measureHeader(152))
    await tick(100)
    expect(H.log).toEqual([['scrollToEnd', noAnimation]])
  })
})

describe('whatever moves the scroller, when the list did not, is the reader', () => {
  const scroller = () => screen.getByTestId('fake-scroller')
  // Drives an in-flight centring loop that keeps asking for an unmounted target.
  const openCentring = () => {
    update(() => H.listStore.set({mountsOnScrollToIndex: false, rendered: new Set()}))
    open({center: 30})
  }
  const centringAsks = () => H.log.filter(([name]) => name === 'scrollToIndex').length
  const moveBy = (delta: number) => update(() => H.moveScroller(H.listStore.get().scroll + delta))

  // Each input as it reaches the thread, then the movement it causes; only the movement counts.
  const inputs: Array<[string, () => void]> = [
    ['a wheel', () => fireEvent.wheel(scroller(), {deltaY: -100})],
    ['a navigation key', () => fireEvent.keyDown(scroller(), {key: 'PageUp'})],
    ['the scrollbar thumb dragged', () => fireEvent.pointerDown(scroller())],
    ['a touch drag', () => fireEvent.touchStart(scroller())],
    ['middle-click autoscroll', () => fireEvent.pointerDown(scroller(), {button: 1})],
    ['find in page', () => {}],
  ]

  test.each(inputs)('%s stops the centring loop', async (_name, input) => {
    openCentring()
    input()
    moveBy(-100)
    await tick(5000)
    expect(centringAsks()).toBe(1)
  })

  test.each(inputs)('%s takes the end from the list', async (_name, input) => {
    open()
    input()
    moveBy(100)
    growHeader()
    await tick(3000)
    expect(H.log).toEqual([])
  })

  // An input that moves nothing: pressing the scrollbar without dragging, a key or wheel the thread
  // does not scroll for (a zoom, a popup over the thread scrolling itself), a key typed into a field.
  test.each<[string, () => void]>([
    ['pressing the scrollbar without dragging', () => fireEvent.pointerDown(scroller())],
    ['a zooming ctrl+wheel', () => fireEvent.wheel(scroller(), {ctrlKey: true, deltaY: 100})],
    ['a navigation key the thread does not scroll for', () => fireEvent.keyDown(scroller(), {key: 'ArrowUp'})],
  ])('%s is not scrolling: centring goes on', async (_name, input) => {
    openCentring()
    input()
    await tick(250)
    expect(centringAsks()).toBe(3)
  })

  test('a scroll event that moved nothing reads nothing of the list', () => {
    open()
    const getState = jest.spyOn(H.listHandle, 'getState')
    scroller().dispatchEvent(new Event('scroll'))
    expect(getState).not.toHaveBeenCalled()
  })

  test('something scrollable inside the thread scrolling is not the thread scrolling', async () => {
    openCentring()
    const inner = document.createElement('div')
    scroller().appendChild(inner)
    inner.dispatchEvent(new Event('scroll'))
    await tick(250)
    expect(centringAsks()).toBe(3)
  })

  test('pressing on a message is not scrolling: centring goes on correcting', async () => {
    open({center: 30})
    fireEvent.pointerDown(document.querySelector('[data-ordinal="30"]')!)
    await tick(50)
    update(() => H.listStore.set({scroll: H.listStore.get().scroll - 40}))
    await tick(50)
    expect(H.log).toEqual([
      ['scrollToOffset', {animated: false, offset: centredOffset(30)}],
      ['scrollToOffset', {animated: false, offset: centredOffset(30)}],
    ])
  })

  test('the list holding rows in place as they measure is its own scroll: centring goes on', async () => {
    openCentring()
    update(() => H.listStore.set({scroll: H.listStore.get().scroll + 300}))
    await tick(250)
    expect(centringAsks()).toBe(3)
  })

  // Its end anchor writes the new end down, the scroller clamps short of it against an extent that has
  // not caught up with the new rows, and the list goes again.
  test('a scroll of the list\'s own that lands short of where it was going is still its own: header growth re-pins', async () => {
    open()
    scrollerAtEnd()
    update(() => H.threadStore.set({messageOrdinals: H.range(1, 63)}))
    update(() => H.listLandsShort(endOffset(), endOffset() - 200))
    const target = endOffset()
    // The header measures larger a frame after the list's own scroll, as it does on opening.
    growHeader()
    update(() => H.listStore.set({scroll: target}))
    H.scrollEnds()
    await tick(100)
    expect(H.log).toEqual([['scrollToEnd', noAnimation]])
  })

  test('the list\'s own scroll coming to rest at the end does not hand the end back while a centre is on its way', async () => {
    open()
    update(() => {
      H.setCenter(ord(500))
      clearThread()
    })
    update(() => loadThread(1, 60))
    scrollerAtEnd()
    H.scrollEnds()
    growHeader()
    await tick(3000)
    expect(H.log).toEqual([])
  })
})

describe('the reader reaching the end', () => {
  const scroller = () => screen.getByTestId('fake-scroller')
  // A scroll of the thread's scroller finishing, whoever started it.
  const scrollEnded = () => {
    H.scrollEnds()
  }
  const readerTo = (offset: number) => update(() => H.moveScroller(offset))

  test.each(['End', 'PageDown', 'ArrowDown', ' '])(
    'after %p scrolls the reader down to it, header growth re-pins the end',
    async key => {
      open()
      readerTo(1000)
      fireEvent.keyDown(scroller(), {key})
      readerTo(endOffset())
      scrollEnded()
      growHeader()
      await tick(100)
      expect(H.log).toEqual([['scrollToEnd', noAnimation]])
    }
  )

  test('after wheeling back down to it, header growth re-pins the end', async () => {
    open()
    scrollerNotAtEnd()
    wheel()
    readerTo(endOffset())
    scrollEnded()
    growHeader()
    await tick(100)
    expect(H.log).toEqual([['scrollToEnd', noAnimation]])
  })

  test('a scroll that comes to rest short of it leaves the end with the reader', async () => {
    open()
    scrollerNotAtEnd()
    wheel()
    scrollEnded()
    growHeader()
    await tick(3000)
    expect(H.log).toEqual([])
  })

  test('a wheel down at the end, which moves nothing, leaves the end with the list', async () => {
    open()
    scrollerAtEnd()
    fireEvent.wheel(screen.getByTestId('chat-message-list'), {deltaY: 100})
    growHeader()
    await tick(100)
    expect(H.log).toEqual([['scrollToEnd', noAnimation]])
  })

  test.each(['End', 'PageDown', 'ArrowDown', ' '])(
    '%p at the end, which moves nothing, leaves the end with the list',
    async key => {
      open()
      scrollerAtEnd()
      fireEvent.keyDown(scroller(), {key})
      growHeader()
      await tick(100)
      expect(H.log).toEqual([['scrollToEnd', noAnimation]])
    }
  )

  test('pressing the scrollbar at the end and letting go without dragging leaves the end with the list', async () => {
    open()
    scrollerAtEnd()
    fireEvent.pointerDown(scroller())
    fireEvent.pointerUp(scroller())
    growHeader()
    await tick(100)
    expect(H.log).toEqual([['scrollToEnd', noAnimation]])
  })

  test('dragging the scrollbar thumb and letting go short of the end leaves the end with the reader', async () => {
    open()
    scrollerAtEnd()
    fireEvent.pointerDown(scroller())
    readerTo(1000)
    fireEvent.pointerUp(scroller())
    scrollEnded()
    growHeader()
    await tick(3000)
    expect(H.log).toEqual([])
  })

  test('keys toward the oldest at the end take it', async () => {
    open()
    scrollerAtEnd()
    fireEvent.keyDown(scroller(), {key: ' ', shiftKey: true})
    readerTo(endOffset() - H.viewportHeight)
    growHeader()
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
    update(() => H.measureHeader(100))
    switchTabAwayAndBack()
    update(() => H.measureHeader(152))
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

// Both lists load a page as the reader comes within two screens of either end of the rows loaded.
// The list measures the distance itself, in its viewport's heights; the mobile list's figure is
// pinned by native-scroll.native.test.tsx.
describe('loading pages', () => {
  const loads = () => H.log.filter(([kind]) => kind === 'loadOlderMessages' || kind === 'loadNewerMessages')

  test('older rows load two screens from the oldest row loaded', () => {
    open()
    expect(props()['onStartReachedThreshold']).toBe(2)
    update(() => (props()['onStartReached'] as () => void)())
    expect(loads()).toEqual([['loadOlderMessages', 60]])
  })

  test('in a window of history, newer rows load two screens from the newest row loaded', () => {
    open({moreToLoadForward: true})
    expect(props()['onEndReachedThreshold']).toBe(2)
    update(() => (props()['onEndReached'] as () => void)())
    expect(loads()).toEqual([['loadNewerMessages', 60]])
  })
})
