// Desktop adapter for the thread scroll target: turns what the LegendList thread sees into
// scroll-target events and carries out each directive with the list's own imperative API.
import * as React from 'react'
import type * as T from '@/constants/types'
import type {LegendListRef} from '@/common-adapters'
import {ThreadRefsContext} from '../normal/context'
import {useSchedule} from './schedule'
import {
  indexOfOrdinal,
  initialScrollTarget,
  listAnchorsEnd,
  ownsEnd,
  useScrollTarget,
  type ScrollDirective,
  type ScrollEvent,
} from './scroll-target'

const centerTolerancePx = 8
// A scroller within this many pixels of its end counts as at the end.
const endTolerancePx = 2

type ScrollerLike = {clientHeight: number; scrollHeight: number; scrollTop: number}
type WrapperLike = {children: ArrayLike<ScrollerLike>}

// The list's scrolling element: the wrapper's child with content to scroll.
const scrollerIn = (wrapper: unknown) =>
  Array.from((wrapper as WrapperLike | null)?.children ?? []).find(c => c.scrollHeight - c.clientHeight > 1)

type RectLike = {height: number; top: number}
type MeasurableWrapper = {
  getBoundingClientRect: () => RectLike
  querySelector: (s: string) => {getBoundingClientRect: () => RectLike} | null
}

// How far the ordinal's row sits below the middle of the viewport (the wrapper); undefined while the
// row is not rendered.
const offsetFromMiddle = (wrapper: unknown, ordinal: T.Chat.Ordinal) => {
  const w = wrapper as MeasurableWrapper | null
  const el = w?.querySelector(`[data-ordinal="${ordinal}"]`)
  if (!w || !el) return undefined
  const row = el.getBoundingClientRect()
  const view = w.getBoundingClientRect()
  return row.top + row.height / 2 - (view.top + view.height / 2)
}

// A row not rendered is out of view.
const rowAboveMiddle = (wrapper: unknown, ordinal: T.Chat.Ordinal) => (offsetFromMiddle(wrapper, ordinal) ?? -1) < 0

// Keys a focused scroller scrolls by itself.
const scrollKeys = new Set(['ArrowDown', 'ArrowUp', 'End', 'Home', 'PageDown', 'PageUp', ' '])
// Those that scroll toward the end; Space does unless shifted.
const towardEndKeys = new Set(['ArrowDown', 'End', 'PageDown', ' '])
// Elements that take those keys for themselves, where they scroll nothing.
const keyTakingTags = new Set(['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'])

export const useDesktopThreadScroll = (p: {
  centeredOrdinal: T.Chat.Ordinal | undefined
  datasetKey: string
  editingOrdinal: T.Chat.Ordinal | undefined
  listRef: React.RefObject<LegendListRef | null>
  loaded: boolean
  messageOrdinals: ReadonlyArray<T.Chat.Ordinal>
  wrapperRef: React.RefObject<HTMLDivElement | null>
}) => {
  const {centeredOrdinal, datasetKey, editingOrdinal} = p
  const {listRef, loaded, messageOrdinals, wrapperRef} = p

  // Read by the loops below as they run, so they see the thread as it is now rather than when they
  // started.
  const messageOrdinalsRef = React.useRef(messageOrdinals)
  React.useEffect(() => {
    messageOrdinalsRef.current = messageOrdinals
  }, [messageOrdinals])

  const scrollTarget = useScrollTarget()

  // Asks the scroller, not the list's own isAtEnd: that flag comes from the content size and viewport
  // the list has recorded, and both lag a composer collapse, so it reads not-at-end while the scroller
  // is in fact at its end.
  const isScrolledToEnd = React.useCallback(() => {
    const scroller = scrollerIn(wrapperRef.current)
    return !!scroller && scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop <= endTolerancePx
  }, [wrapperRef])

  // The list resolves its initialScrollAtEnd target from the header size it has measured so far, and
  // SpecialTopMessage renders at its bare minHeight before the thread's intro content (retention
  // notice, new-chat card, the "digging" spinner) lands. maintainScrollAtEnd re-pins on a data, item,
  // footer or viewport layout change but has no header trigger, so a header that grows after the
  // target resolved leaves the list short by exactly that growth and nothing corrects it.
  //
  // Closed loop rather than a correction fired straight from the size change, for the same reason
  // pinning unlessAtEnd keeps out of the way: the header often settles while the thread is still
  // empty, and a scrollToEnd issued against that near-empty content becomes the target the list then
  // abandons its own bootstrap for, landing anywhere. Wait for the scroll offset to hold still, so
  // the list has finished its own initial scroll, and only then correct what it left on the table.
  const endAnchor = useSchedule()
  const verifyEndAnchor = React.useCallback(() => {
    endAnchor.stop()
    endAnchor.start(async sleep => {
      let previousScroll: number | undefined
      let corrections = 0
      for (let elapsed = 0; elapsed < 2000; ) {
        if (!(await sleep(50))) return
        elapsed += 50
        // Checked after the sleep, not before: the reader may have taken the end during it.
        if (!ownsEnd(scrollTarget.state)) return
        const state = listRef.current?.getState()
        if (!state) continue
        if (state.isAtEnd) return
        // Only a scroll offset that held still across two checks means the list is done moving.
        if (state.scroll === previousScroll) {
          // Two corrections is the whole budget: one for the header, one for whatever re-measured
          // alongside it. Past that we would be fighting something that owns the offset.
          if (++corrections > 2) return
          void listRef.current?.scrollToEnd({animated: false})
          previousScroll = undefined
        } else {
          previousScroll = state.scroll
        }
      }
    })
  }, [endAnchor, listRef, scrollTarget])

  // Owns the in-flight centering loop. It has to outlive re-renders: the messages that make
  // centering accurate arrive after it starts, so the loop must not be torn down by an effect
  // cleanup when messageOrdinals changes. Only a new target, a stop directive, being hidden or
  // unmounting stops it; a user scrolling in its ~3s window must win.
  const centering = useSchedule()

  // Closed loop, not one shot: rows enter at estimatedItemSize and only settle as they measure, so
  // the first scroll lands off by however wrong the estimates above the target were. Measure the
  // row's real offset from the viewport center and correct until it holds still, then get out of
  // the way: maintainVisibleContentPosition owns the offset from then on. Two controllers fighting
  // over the same scroll offset would oscillate.
  //
  // Correct via LegendList's own scrollToOffset, never scrollIntoView: touching scrollTop directly
  // desyncs LegendList's internal scroll state, and the next time it recomputes item positions it
  // snaps somewhere unrelated.
  const scrollToCentered = React.useCallback(
    (target: T.Chat.Ordinal) => {
      centering.stop()
      centering.start(async sleep => {
        let settled = 0
        let pinnedChecks = 0
        let scrollAtLastRequest: number | undefined
        for (let elapsed = 0; elapsed < 3000; ) {
          const offBy = offsetFromMiddle(wrapperRef.current, target)
          if (offBy === undefined) {
            // Target is outside the rendered window; get it mounted first.
            const idx = indexOfOrdinal(messageOrdinalsRef.current, target)
            if (idx >= 0) {
              void listRef.current?.scrollToIndex({animated: false, index: idx, viewPosition: 0.5})
            }
            settled = 0
            pinnedChecks = 0
            if (!(await sleep(100))) return
            elapsed += 100
            continue
          }
          const scroll = listRef.current?.getState().scroll
          // Deadband, not exact centering: below this the row reads as centered, and chasing the
          // remainder only fights maintainVisibleContentPosition's own sub-pixel adjustments.
          if (Math.abs(offBy) <= centerTolerancePx || scroll === undefined) {
            pinnedChecks = 0
            // Only the iteration right after a correction can diagnose a clamp.
            scrollAtLastRequest = undefined
            if (++settled >= 3) break
          } else if (scroll === scrollAtLastRequest) {
            // A hit near either end of the thread cannot be centered: the offset we ask for gets
            // clamped and the row never reaches the middle. Our last correction moved the scroll
            // position not at all, so we are pinned against an edge — stop rather than spin.
            if (++pinnedChecks >= 3) break
          } else {
            pinnedChecks = 0
            scrollAtLastRequest = scroll
            void listRef.current?.scrollToOffset({animated: false, offset: scroll + offBy})
          }
          if (!(await sleep(50))) return
          elapsed += 50
        }
        // Settled, pinned or out of time; centerSettled only ever leaves the list alone.
        scrollTarget.decide({type: 'centerSettled'})
      })
    },
    [centering, listRef, scrollTarget, wrapperRef]
  )

  const perform = React.useCallback(
    (directive: ScrollDirective) => {
      switch (directive.type) {
        case 'pinEnd':
          if (directive.stopCentering) centering.stop()
          if (directive.how === 'whenSettled') {
            verifyEndAnchor()
            return
          }
          // While the list is at the end maintainScrollAtEnd owns the position, and scrolling there
          // only displaces it: the target resolves before a new row has measured, so it lands short,
          // and while it counts as in flight the list declines its own end anchor and abandons it.
          if (directive.how === 'unlessAtEnd' && isScrolledToEnd()) return
          void listRef.current?.scrollToEnd({animated: false})
          return
        case 'center':
          scrollToCentered(directive.ordinal)
          return
        case 'reveal': {
          const idx = indexOfOrdinal(messageOrdinalsRef.current, directive.ordinal)
          if (idx >= 0) {
            void listRef.current?.scrollToIndex({animated: true, index: idx, viewPosition: 0.5})
          }
          return
        }
        case 'leaveAlone':
          if (directive.stopCentering) centering.stop()
          return
        default: {
          const unexpected: never = directive
          return unexpected
        }
      }
    },
    [centering, isScrolledToEnd, listRef, scrollToCentered, verifyEndAnchor]
  )

  const dispatch = React.useCallback(
    (event: ScrollEvent) => {
      perform(scrollTarget.decide(event))
    },
    [perform, scrollTarget]
  )

  // Compared by value, not by the effect re-running: selecting the chat tab again re-mounts effects
  // hidden under Activity with nothing changed. The end being verified belongs to the old rows.
  const datasetRef = React.useRef<string | undefined>(undefined)
  React.useLayoutEffect(() => {
    if (datasetRef.current === datasetKey) return
    datasetRef.current = datasetKey
    endAnchor.stop()
    dispatch({type: 'datasetChanged'})
  }, [datasetKey, dispatch, endAnchor])

  // Level-triggered on purpose: centring has to start when loaded flips true after the target was
  // already set, and when the target arrives in the thread after the request.
  React.useEffect(() => {
    dispatch({
      centeredOrdinal,
      loaded,
      targetInData: centeredOrdinal !== undefined && indexOfOrdinal(messageOrdinals, centeredOrdinal) >= 0,
      type: 'threadObserved',
    })
  }, [centeredOrdinal, dispatch, loaded, messageOrdinals])

  // Hidden (another tab selected, under Activity) or unmounted: the loops have stopped with the
  // schedules, and a target still settling is centred afresh if the list comes back.
  React.useEffect(() => () => dispatch({type: 'detached'}), [dispatch])

  React.useEffect(() => {
    const targetInData = editingOrdinal !== undefined && indexOfOrdinal(messageOrdinals, editingOrdinal) >= 0
    dispatch({
      ordinal: editingOrdinal,
      rowAboveMiddle: targetInData && rowAboveMiddle(wrapperRef.current, editingOrdinal),
      targetInData,
      type: 'editingChanged',
    })
  }, [dispatch, editingOrdinal, messageOrdinals, wrapperRef])

  const onMetricsChange = React.useCallback(
    (metrics: {headerSize: number}) => {
      dispatch({
        hasMessages: messageOrdinalsRef.current.length > 0,
        size: metrics.headerSize,
        type: 'headerMeasured',
      })
    },
    [dispatch]
  )

  // A scroll coming to rest at the end, the reader's or the list's own, gives the end back to the
  // list, however it got there. scrollend does not bubble, so it is caught on its way down to the
  // scroller.
  const reportIfAtEnd = React.useCallback(() => {
    if (isScrolledToEnd()) dispatch({type: 'readerAtEnd'})
  }, [dispatch, isScrolledToEnd])
  React.useLayoutEffect(() => {
    const wrapper = wrapperRef.current
    if (!wrapper) return undefined
    wrapper.addEventListener('scrollend', reportIfAtEnd, {capture: true})
    return () => wrapper.removeEventListener('scrollend', reportIfAtEnd, {capture: true})
  }, [reportIfAtEnd, wrapperRef])

  // The reader's own scrolling is told apart by the input that causes it, not by scroll events: the
  // list scrolls itself too (its initial position, its end anchor, holding rows in place as they
  // measure), and a scroll event does not say who moved it. A wheel, a navigation key reaching the
  // scroller, and a press on the scroller itself (its scrollbar: a press on a row lands on the row)
  // are always the reader. An input toward the end that finds the scroller already there moves
  // nothing, so no scroll comes to rest to say it ended at the end: it says so itself.
  const onWheel = React.useCallback(
    (e: {deltaY: number}) => {
      dispatch({type: 'userScrolled'})
      if (e.deltaY > 0) reportIfAtEnd()
    },
    [dispatch, reportIfAtEnd]
  )

  const onKeyDown = React.useCallback(
    (e: {key: string; shiftKey: boolean; target: unknown}) => {
      const target = e.target as {isContentEditable?: boolean; tagName?: string}
      if (!scrollKeys.has(e.key) || target.isContentEditable || keyTakingTags.has(target.tagName ?? '')) return
      dispatch({type: 'userScrolled'})
      if (towardEndKeys.has(e.key) && !(e.key === ' ' && e.shiftKey)) reportIfAtEnd()
    },
    [dispatch, reportIfAtEnd]
  )

  const onPointerDown = React.useCallback(
    (e: {target: unknown}) => {
      if (e.target !== scrollerIn(wrapperRef.current)) return
      dispatch({type: 'userScrolled'})
    },
    [dispatch, wrapperRef]
  )

  // Letting go of the scrollbar, as a touch list reports a drag let go. A drag of its thumb comes to
  // rest by itself; a press that moved nothing only ends here.
  const onPointerUp = React.useCallback(
    (e: {target: unknown}) => {
      if (e.target !== scrollerIn(wrapperRef.current)) return
      reportIfAtEnd()
    },
    [reportIfAtEnd, wrapperRef]
  )

  const scrollToBottom = React.useCallback(() => {
    dispatch({centeredOrdinal, type: 'scrollToBottomRequested'})
  }, [centeredOrdinal, dispatch])

  const scrollUp = React.useCallback(() => {
    const state = listRef.current?.getState()
    if (!state) return
    dispatch({type: 'userScrolled'})
    void listRef.current?.scrollToOffset({
      animated: false,
      offset: Math.max(0, state.scroll - state.scrollLength),
    })
  }, [dispatch, listRef])

  const scrollDown = React.useCallback(() => {
    const state = listRef.current?.getState()
    if (!state) return
    dispatch({type: 'userScrolled'})
    reportIfAtEnd()
    void listRef.current?.scrollToOffset({
      animated: false,
      offset: state.scroll + state.scrollLength,
    })
  }, [dispatch, listRef, reportIfAtEnd])

  const {setScrollRef} = React.useContext(ThreadRefsContext)
  React.useEffect(() => {
    setScrollRef({scrollDown, scrollToBottom, scrollUp})
  }, [scrollDown, scrollToBottom, scrollUp, setScrollRef])

  const initialScrollIndex = React.useMemo(
    () => initialScrollTarget(messageOrdinals, centeredOrdinal),
    [messageOrdinals, centeredOrdinal]
  )

  return {
    initialScrollIndex,
    maintainScrollAtEnd: listAnchorsEnd(centeredOrdinal),
    onKeyDown,
    onMetricsChange,
    onPointerDown,
    onPointerUp,
    onWheel,
    scrollToBottom,
  }
}
