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
  type ScrollDirective,
  type ScrollEvent,
} from './scroll-target'
import {useHeldLatest, useScrollTarget} from './use-scroll-target'

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

// Whether the ordinal's row is wholly inside the viewport, with the scroller at its end when atEnd;
// a row not rendered is not.
const rowFullyVisible = (scroller: unknown, ordinal: T.Chat.Ordinal, atEnd: boolean) => {
  const m = measureRow(scroller, ordinal)
  if (!m) return false
  const s = scroller as ScrollerLike
  const top = m.row.top - (atEnd ? s.scrollHeight - s.clientHeight - s.scrollTop : 0)
  return (
    top >= m.view.top - rowEdgeTolerancePx &&
    top + m.row.height <= m.view.top + m.view.height + rowEdgeTolerancePx
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

  const {listOwnsEnd, scrollTarget} = useScrollTarget()
  const [own] = React.useState(makeOwnScrolls)
  const heldLatest = useHeldLatest(containsLatestMessage, datasetKey, messageOrdinals)
  const anchorsEnd = listAnchorsEnd({centeredOrdinal, heldLatest, listOwnsEnd})
  // Read by the list's callbacks, which report after the commit that set it.
  const anchorsEndRef = React.useRef(anchorsEnd)
  React.useLayoutEffect(() => {
    anchorsEndRef.current = anchorsEnd
  }, [anchorsEnd])

  // Every "is the list at its end?" asks the scroller, never the list's own isAtEnd. The list re-reads
  // that flag only when it scrolls or lays out, so it lags both ways: a row or the header growing at
  // the end with nothing scrolling leaves it reading at-end while the scroller is short, and a
  // composer collapse leaves it reading not-at-end while the scroller is at its end.
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
  // The same holds for the other size changes that anchor misses: the viewport changing height while
  // a scroll it declines to interrupt is in flight, and a row changing by a few pixels, which it
  // leaves alone.
  //
  // Closed loop rather than a correction fired straight from the size change, for the same reason a
  // pin leaves a list already at its end alone: the header often settles while the thread is still
  // empty, and a scrollToEnd issued against that near-empty content becomes the target the list then
  // abandons its own bootstrap for, landing anywhere. Wait for the scroll offset to hold still, so
  // the list has finished its own initial scroll, and only then correct what it left on the table.
  //
  // Done only once the end has held: at the end on two checks in a row with the content no taller on
  // the second. The list reports a size change before the scroller's extent catches up with it, and a
  // row can measure again a frame after its first measurement, so one look at the end proves nothing.
  const endAnchor = useSchedule()
  const verifyEndAnchor = React.useCallback(() => {
    endAnchor.stop()
    endAnchor.start(async sleep => {
      let previousScroll: number | undefined
      let heldAtHeight: number | undefined
      let corrections = 0
      for (let elapsed = 0; elapsed < 2000; ) {
        if (!(await sleep(50))) return
        elapsed += 50
        // Checked after the sleep, not before: the reader may have taken the end during it.
        if (!ownsEnd(scrollTarget.state)) return
        const scroll = listRef.current?.getState().scroll
        const scroller = scrollerOf()
        if (scroll === undefined || !scroller) continue
        if (isScrolledToEnd()) {
          if (heldAtHeight === scroller.scrollHeight) return
          heldAtHeight = scroller.scrollHeight
          previousScroll = undefined
          continue
        }
        heldAtHeight = undefined
        // Only a scroll offset that held still across two checks means the list is done moving.
        if (scroll === previousScroll) {
          // Two corrections is the whole budget: one for the header, one for whatever re-measured
          // alongside it. Past that we would be fighting something that owns the offset.
          if (++corrections > 2) return
          void listRef.current?.scrollToEnd({animated: false})
          previousScroll = undefined
        } else {
          previousScroll = scroll
        }
      }
    })
  }, [endAnchor, isScrolledToEnd, listRef, scrollTarget, scrollerOf])

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
          // The header, the viewport or a row changes size while the list may still be settling its
          // own position, and its own end anchor may already have re-pinned it. That anchor re-pins
          // for no header change at all, for no row changing by five pixels or less, and not
          // reliably for larger ones.
          if (event.type === 'headerMeasured' || event.type === 'viewportResized' || event.type === 'rowResized') {
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
          if (own.issued(from, to, true)) {
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
  // Whether the current dataset is still in its initial layout (see onItemSizeChanged).
  const initialLayoutRef = React.useRef(true)
  // How many row size changes the initial layout has held back for its end to verify.
  const heldRowChangesRef = React.useRef(0)
  React.useLayoutEffect(() => {
    if (datasetRef.current === datasetKey) return
    datasetRef.current = datasetKey
    endAnchor.stop()
    initialLayoutRef.current = true
    heldRowChangesRef.current = 0
    dispatch({type: 'datasetChanged'})
  }, [datasetKey, dispatch, endAnchor])

  // Level-triggered on purpose: centring has to start when loaded flips true after the target was
  // already set, and when the target arrives in the thread after the request.
  React.useEffect(() => {
    dispatch({
      atNewest: () => containsLatestMessage && isScrolledToEnd(),
      centeredOrdinal,
      loaded,
      targetInData: centeredOrdinal !== undefined && indexOfOrdinal(messageOrdinals, centeredOrdinal) >= 0,
      type: 'threadObserved',
    })
  }, [centeredOrdinal, containsLatestMessage, dispatch, isScrolledToEnd, loaded, messageOrdinals])

  // Hidden (another tab selected, under Activity) or unmounted: the loops have stopped with the
  // schedules, and a target still settling is centred afresh if the list comes back.
  React.useEffect(() => () => dispatch({type: 'detached'}), [dispatch])

  React.useEffect(() => {
    const targetInData = editingOrdinal !== undefined && indexOfOrdinal(messageOrdinals, editingOrdinal) >= 0
    dispatch({
      ordinal: editingOrdinal,
      rowFullyVisible: () =>
        editingOrdinal !== undefined && rowFullyVisible(scrollerOf(), editingOrdinal, anchorsEndRef.current),
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

  // The list's viewport as it last reported it; its first report is where it starts, not a change.
  const viewportRef = React.useRef<number | undefined>(undefined)
  // Reported once the list has recorded the new viewport, so a scroll issued from here aims at it.
  const onLayout = React.useCallback(
    (e: {nativeEvent: {layout: {height: number}}}) => {
      const {height} = e.nativeEvent.layout
      const previous = viewportRef.current
      viewportRef.current = height
      if (previous === undefined || previous === height) return
      dispatch({
        anchorsEnd: anchorsEndRef.current,
        rowFullyVisible: ordinal => rowFullyVisible(scrollerOf(), ordinal, anchorsEndRef.current),
        type: 'viewportResized',
      })
    },
    [dispatch, scrollerOf]
  )

  // Every change to a row's size is reported, however large, and a row's first measurement off the
  // size the list laid it out at among them. The list's own end anchor re-pins for some of them, but
  // not reliably: a reaction growing the newest row by 40px was left short, and a new message at the
  // bottom landing a few pixels off its estimate is left short too. The end loop does nothing when
  // the list is already at its end.
  //
  // Which report is a row's first cannot be told: the list reports a size only when it differs from
  // the size it laid the row out at, so a row that measures at its estimate first reports on its
  // second measurement. So during a dataset's initial layout, when every row measures and restarting
  // the loop for each would keep it from ever correcting, none restarts it: the layout ending does,
  // once, for all of them.
  const onItemSizeChanged = React.useCallback(() => {
    if (initialLayoutRef.current) {
      heldRowChangesRef.current++
      return
    }
    dispatch({anchorsEnd: anchorsEndRef.current, type: 'rowResized'})
  }, [dispatch])

  // The initial layout ends once the list has rows and has settled: its scroll offset held still and
  // no row changed size across two checks. Timed only while there are rows, so a slow reload after a
  // clear still has its whole page laid out before it ends.
  const initialLayout = useSchedule()
  React.useEffect(() => {
    if (!initialLayoutRef.current) return
    initialLayout.start(async sleep => {
      let previousScroll: number | undefined
      let previousChanges = heldRowChangesRef.current
      let quiet = 0
      for (let elapsed = 0; elapsed < 5000; ) {
        if (!(await sleep(50))) return
        if (messageOrdinalsRef.current.length === 0) continue
        elapsed += 50
        const scroll = listRef.current?.getState().scroll
        const changes = heldRowChangesRef.current
        if (scroll === undefined || changes !== previousChanges || scroll !== previousScroll) {
          previousChanges = changes
          previousScroll = scroll
          quiet = 0
        } else if (++quiet >= 2) {
          break
        }
      }
      initialLayoutRef.current = false
      if (heldRowChangesRef.current === 0) return
      heldRowChangesRef.current = 0
      dispatch({anchorsEnd: anchorsEndRef.current, type: 'rowResized'})
    })
    return () => initialLayout.stop()
  }, [datasetKey, dispatch, initialLayout, listRef])

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
      if (!scroller || e.target !== scroller) return
      const now = scroller.scrollTop
      const from = lastOffsetRef.current
      if (now === from) return
      lastOffsetRef.current = now
      if (own.carries(from, now)) return
      const listState = listRef.current?.getState()
      if (!listState) return
      const toward = Math.min(listState.scroll, scroller.scrollHeight - scroller.clientHeight)
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
    maintainScrollAtEnd: anchorsEnd,
    onItemSizeChanged,
    onLayout,
    onMetricsChange,
    scrollToBottom,
  }
}
