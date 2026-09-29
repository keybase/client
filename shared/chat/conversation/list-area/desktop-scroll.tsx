// Desktop adapter for the thread scroll target: turns what the LegendList thread sees into
// scroll-target events and carries out each directive with the list's own imperative API.
import * as React from 'react'
import type * as T from '@/constants/types'
import type {LegendListRef} from '@/common-adapters'
import {ThreadRefsContext} from '../normal/context'
import {makeOwnScrolls} from './own-scrolls'
import {useSchedule} from './schedule'
import {
  indexOfOrdinal,
  initialScrollTarget,
  listAnchorsEnd,
  ownsEnd,
  useHeldLatest,
  useScrollTarget,
  type ScrollDirective,
  type ScrollEvent,
} from './scroll-target'

const centerTolerancePx = 8
// A scroller within this many pixels of its end counts as at the end.
const endTolerancePx = 2
// A scroller within this many pixels of where the list put it is where the list put it.
const ownTolerancePx = 1
// A row overhanging the viewport by no more than this is wholly in view.
const rowEdgeTolerancePx = 1

type ScrollerLike = {clientHeight: number; scrollHeight: number; scrollTop: number}

type ListenerOptions = {capture: boolean}
type ScrollListener = (e: {target: unknown}) => void
type ListenerTarget = {
  addEventListener: (type: string, listener: ScrollListener, options: ListenerOptions) => void
  removeEventListener: (type: string, listener: ScrollListener, options: ListenerOptions) => void
}
type RectLike = {height: number; top: number}
type MeasurableScroller = {
  getBoundingClientRect: () => RectLike
  querySelector: (s: string) => {getBoundingClientRect: () => RectLike} | null
}

// The ordinal's row and the viewport (the scroller, not the wrapper around it, whose padding reaches
// below the view) as laid out now; undefined while the row is not rendered.
const measureRow = (scroller: unknown, ordinal: T.Chat.Ordinal) => {
  const s = scroller as MeasurableScroller | null | undefined
  const el = s?.querySelector(`[data-ordinal="${ordinal}"]`)
  if (!s || !el) return undefined
  return {row: el.getBoundingClientRect(), view: s.getBoundingClientRect()}
}

// How far the ordinal's row sits below the middle of the viewport; undefined while the row is not
// rendered.
const offsetFromMiddle = (scroller: unknown, ordinal: T.Chat.Ordinal) => {
  const m = measureRow(scroller, ordinal)
  return m && m.row.top + m.row.height / 2 - (m.view.top + m.view.height / 2)
}

// Whether the ordinal's row is wholly inside the viewport; a row not rendered is not.
const rowFullyVisible = (scroller: unknown, ordinal: T.Chat.Ordinal) => {
  const m = measureRow(scroller, ordinal)
  return (
    !!m &&
    m.row.top >= m.view.top - rowEdgeTolerancePx &&
    m.row.top + m.row.height <= m.view.top + m.view.height + rowEdgeTolerancePx
  )
}

export const useDesktopThreadScroll = (p: {
  centeredOrdinal: T.Chat.Ordinal | undefined
  containsLatestMessage: boolean
  datasetKey: string
  editingOrdinal: T.Chat.Ordinal | undefined
  listRef: React.RefObject<LegendListRef | null>
  loaded: boolean
  messageOrdinals: ReadonlyArray<T.Chat.Ordinal>
  wrapperRef: React.RefObject<HTMLDivElement | null>
}) => {
  const {centeredOrdinal, containsLatestMessage, datasetKey, editingOrdinal} = p
  const {listRef, loaded, messageOrdinals, wrapperRef} = p

  // The list's scrolling element, whether or not its content overflows it.
  const scrollerOf = React.useCallback(
    () => listRef.current?.getScrollableNode() as ScrollerLike | null | undefined,
    [listRef]
  )

  // Read by the loops below as they run, so they see the thread as it is now rather than when they
  // started.
  const messageOrdinalsRef = React.useRef(messageOrdinals)
  React.useEffect(() => {
    messageOrdinalsRef.current = messageOrdinals
  }, [messageOrdinals])

  const scrollTarget = useScrollTarget()
  const [own] = React.useState(makeOwnScrolls)
  const heldLatest = useHeldLatest(containsLatestMessage)

  // Asks the scroller, not the list's own isAtEnd: that flag comes from the content size and viewport
  // the list has recorded, and both lag a composer collapse, so it reads not-at-end while the scroller
  // is in fact at its end.
  const isScrolledToEnd = React.useCallback(() => {
    const scroller = scrollerOf()
    return !!scroller && scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop <= endTolerancePx
  }, [scrollerOf])

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
          const offBy = offsetFromMiddle(scrollerOf(), target)
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
    [centering, listRef, scrollTarget, scrollerOf]
  )

  // Carries out the directive decided for event: how the list reaches the end depends on what happened.
  const perform = React.useCallback(
    (directive: ScrollDirective, event: ScrollEvent) => {
      switch (directive.type) {
        case 'pinEnd':
          if (directive.stopCentering) centering.stop()
          // The header changes size while the list is still settling its own position.
          if (event.type === 'headerMeasured') {
            verifyEndAnchor()
            return
          }
          // While the list is at the end maintainScrollAtEnd owns the position, and scrolling there
          // only displaces it: the target resolves before a new row has measured, so it lands short,
          // and while it counts as in flight the list declines its own end anchor and abandons it.
          if (isScrolledToEnd()) return
          void listRef.current?.scrollToEnd({animated: false})
          return
        case 'center':
          scrollToCentered(directive.ordinal)
          return
        case 'reveal': {
          const idx = indexOfOrdinal(messageOrdinalsRef.current, directive.ordinal)
          const scroller = scrollerOf()
          const state = listRef.current?.getState()
          if (idx < 0 || !scroller || !state) return
          // The list records an animated scroll's target only as it arrives, so this one says where it is
          // going itself: the row's middle to the viewport's when the row is rendered to measure, and
          // otherwise the end of the thread on the row's side of the view.
          const from = scroller.scrollTop
          const max = scroller.scrollHeight - scroller.clientHeight
          const offBy = offsetFromMiddle(scroller, directive.ordinal)
          const to = offBy === undefined ? (idx < state.start ? 0 : max) : Math.min(max, Math.max(0, from + offBy))
          if (own.issued(from, to)) {
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
    [centering, isScrolledToEnd, listRef, own, scrollToCentered, scrollerOf, verifyEndAnchor]
  )

  const dispatch = React.useCallback(
    (event: ScrollEvent) => {
      perform(scrollTarget.decide(event), event)
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
      rowFullyVisible: () => editingOrdinal !== undefined && rowFullyVisible(scrollerOf(), editingOrdinal),
      targetInData,
      type: 'editingChanged',
    })
  }, [dispatch, editingOrdinal, messageOrdinals, scrollerOf])

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

  // Who moved the scroller is read from where it moved to, never from the input that moved it: the
  // list writes down where it is putting the scroller before it moves it (its initial position, every
  // scrollTo, its end anchor, holding rows in place as they measure), and anything else that moved it
  // is the reader, however they did it. A scroll of the list's own can land short of the offset it
  // wrote down (the scroller clamps to an extent that has not caught up with new rows), so landing
  // anywhere between where the scroller was and that offset is still the list's own.
  const lastOffsetRef = React.useRef(0)
  const onScrollerScroll = React.useCallback(
    (e: {target: unknown}) => {
      // Scroll events reach the wrapper from anything scrollable inside it; only the list's own counts.
      const scroller = scrollerOf()
      const listState = listRef.current?.getState()
      if (!scroller || e.target !== scroller || !listState) return
      const now = scroller.scrollTop
      const toward = Math.min(listState.scroll, scroller.scrollHeight - scroller.clientHeight)
      const from = lastOffsetRef.current
      lastOffsetRef.current = now
      if (own.carries(from, now)) return
      if (now >= Math.min(from, toward) - ownTolerancePx && now <= Math.max(from, toward) + ownTolerancePx) return
      dispatch(own.readerMoved())
    },
    [dispatch, listRef, own, scrollerOf]
  )

  const onScrollerRest = React.useCallback(
    (e: {target: unknown}) => {
      if (e.target !== scrollerOf()) return
      const handedBack = own.rested(isScrolledToEnd())
      if (handedBack) dispatch(handedBack)
    },
    [dispatch, isScrolledToEnd, own, scrollerOf]
  )

  // Both caught on their way down to the scroller: scrollend does not bubble, and a scroll has to be
  // read before the list's own listener on the scroller writes its new offset down.
  React.useLayoutEffect(() => {
    const wrapper = wrapperRef.current as unknown as ListenerTarget | null
    if (!wrapper) return undefined
    // The scroller may have moved while the listeners were off (the list hidden under Activity).
    lastOffsetRef.current = scrollerOf()?.scrollTop ?? 0
    wrapper.addEventListener('scroll', onScrollerScroll, {capture: true})
    wrapper.addEventListener('scrollend', onScrollerRest, {capture: true})
    return () => {
      wrapper.removeEventListener('scroll', onScrollerScroll, {capture: true})
      wrapper.removeEventListener('scrollend', onScrollerRest, {capture: true})
    }
  }, [onScrollerRest, onScrollerScroll, scrollerOf, wrapperRef])

  const scrollToBottom = React.useCallback(() => {
    dispatch({centeredOrdinal, type: 'scrollToBottomRequested'})
  }, [centeredOrdinal, dispatch])

  // The composer's page keys scroll on the reader's behalf. A page that would move nothing (up at the
  // top, down at the end, either way in a thread too short to scroll) is no scroll at all.
  const page = React.useCallback(
    (direction: 'up' | 'down') => {
      const state = listRef.current?.getState()
      const scroller = scrollerOf()
      if (!state || !scroller) return
      if (direction === 'up' ? scroller.scrollTop <= 0 : isScrolledToEnd()) return
      dispatch(own.readerMoved())
      void listRef.current?.scrollToOffset({
        animated: false,
        offset: direction === 'up' ? Math.max(0, state.scroll - state.scrollLength) : state.scroll + state.scrollLength,
      })
    },
    [dispatch, isScrolledToEnd, listRef, own, scrollerOf]
  )
  const scrollUp = React.useCallback(() => page('up'), [page])
  const scrollDown = React.useCallback(() => page('down'), [page])

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
    maintainScrollAtEnd: listAnchorsEnd(centeredOrdinal, heldLatest),
    onMetricsChange,
    scrollToBottom,
  }
}
