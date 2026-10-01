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
import {
  distanceToEnd,
  listMovedItself,
  offsetFromMiddle as rowOffsetFromMiddle,
  pageOffset,
  revealDestination,
  rowWithinView,
  scrollerAtEnd,
  startCenterCheck,
  startEndCheck,
  stepCentering,
  stepEndCheck,
  stepLayoutCheck,
  type LayoutCheck,
  type RectLike,
  type ScrollerLike,
} from './desktop-rules'

type ListenerOptions = {capture: boolean}
type ScrollListener = (e: {target: unknown}) => void
type ListenerTarget = {
  addEventListener: (type: string, listener: ScrollListener, options: ListenerOptions) => void
  removeEventListener: (type: string, listener: ScrollListener, options: ListenerOptions) => void
}
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

// Undefined while the row is not rendered.
const offsetFromMiddle = (scroller: unknown, ordinal: T.Chat.Ordinal) => {
  const m = measureRow(scroller, ordinal)
  return m && rowOffsetFromMiddle(m.row, m.view)
}

// With the scroller at its end when atEnd; a row not rendered is not in view.
const rowFullyVisible = (scroller: unknown, ordinal: T.Chat.Ordinal, atEnd: boolean) => {
  const m = measureRow(scroller, ordinal)
  if (!m) return false
  return rowWithinView(m.row, m.view, atEnd ? distanceToEnd(scroller as ScrollerLike) : 0)
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
    return !!scroller && scrollerAtEnd(scroller)
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
  // the list has finished its own initial scroll, and only then correct what it left on the table
  // (stepEndCheck).
  const endAnchor = useSchedule()
  const verifyEndAnchor = React.useCallback(() => {
    endAnchor.stop()
    endAnchor.start(async sleep => {
      let check = startEndCheck
      for (let elapsed = 0; elapsed < 2000; ) {
        if (!(await sleep(50))) return
        elapsed += 50
        // Checked after the sleep, not before: the reader may have taken the end during it.
        if (!ownsEnd(scrollTarget.state)) return
        const scroll = listRef.current?.getState().scroll
        const scroller = scrollerOf()
        if (scroll === undefined || !scroller) continue
        const next = stepEndCheck(check, {atEnd: isScrolledToEnd(), scroll, scrollHeight: scroller.scrollHeight})
        check = next.check
        if (next.action === 'held' || next.action === 'giveUp') return
        if (next.action === 'correct') void listRef.current?.scrollToEnd({animated: false})
      }
    })
  }, [endAnchor, isScrolledToEnd, listRef, scrollTarget, scrollerOf])

  // Outlives re-renders: the rows that make centring accurate arrive after it starts, so no effect
  // cleanup on messageOrdinals may tear it down.
  const centering = useSchedule()

  // Closed loop, not one shot: rows enter at estimatedItemSize and only settle as they measure, so
  // the first scroll lands off by however wrong the estimates above the target were. Once it settles
  // maintainVisibleContentPosition owns the offset: two controllers on one offset would oscillate.
  //
  // Correct via LegendList's own scrollToOffset, never scrollIntoView: touching scrollTop directly
  // desyncs LegendList's internal scroll state, and the next time it recomputes item positions it
  // snaps somewhere unrelated.
  const scrollToCentered = React.useCallback(
    (target: T.Chat.Ordinal) => {
      centering.stop()
      centering.start(async sleep => {
        let check = startCenterCheck
        for (let elapsed = 0; elapsed < 3000; ) {
          const offBy = offsetFromMiddle(scrollerOf(), target)
          const next = stepCentering(check, offBy, offBy === undefined ? undefined : listRef.current?.getState().scroll)
          check = next.check
          const {step} = next
          if (step.type === 'done') break
          if (step.type === 'mount') {
            const idx = indexOfOrdinal(messageOrdinalsRef.current, target)
            if (idx >= 0) {
              void listRef.current?.scrollToIndex({animated: false, index: idx, viewPosition: 0.5})
            }
            if (!(await sleep(100))) return
            elapsed += 100
            continue
          }
          if (step.type === 'scrollTo') void listRef.current?.scrollToOffset({animated: false, offset: step.offset})
          if (!(await sleep(50))) return
          elapsed += 50
        }
        // centerSettled only ever leaves the list alone.
        scrollTarget.decide({type: 'centerSettled'})
      })
    },
    [centering, listRef, scrollTarget, scrollerOf]
  )

  const perform = React.useCallback(
    (directive: ScrollDirective) => {
      switch (directive.type) {
        case 'pinEnd':
          if (directive.stopCentering) centering.stop()
          // The list's own end anchor re-pins for no header change at all, for no row changing by five
          // pixels or less, and not reliably for larger ones.
          if (directive.verify) {
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
          // going itself.
          const from = scroller.scrollTop
          const to = revealDestination({
            from,
            max: scroller.scrollHeight - scroller.clientHeight,
            offBy: offsetFromMiddle(scroller, directive.ordinal),
            rowBeforeRendered: idx < state.start,
          })
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
      perform(scrollTarget.decide(event))
    },
    [perform, scrollTarget]
  )
  // The detached cleanup reads dispatch through this, so it runs only when the list is hidden or
  // unmounted, however dispatch's dependencies change.
  const dispatchRef = React.useRef(dispatch)
  React.useLayoutEffect(() => {
    dispatchRef.current = dispatch
  }, [dispatch])

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
  React.useEffect(() => () => dispatchRef.current({type: 'detached'}), [])

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

  // Timed only while there are rows, so a slow reload after a clear still has its whole page laid out
  // before the initial layout ends.
  const initialLayout = useSchedule()
  React.useEffect(() => {
    if (!initialLayoutRef.current) return
    initialLayout.start(async sleep => {
      let check: LayoutCheck = {previousChanges: heldRowChangesRef.current, previousScroll: undefined, quiet: 0}
      for (let elapsed = 0; elapsed < 5000; ) {
        if (!(await sleep(50))) return
        if (messageOrdinalsRef.current.length === 0) continue
        elapsed += 50
        const next = stepLayoutCheck(check, {
          changes: heldRowChangesRef.current,
          scroll: listRef.current?.getState().scroll,
        })
        check = next.check
        if (next.settled) break
      }
      initialLayoutRef.current = false
      if (heldRowChangesRef.current === 0) return
      heldRowChangesRef.current = 0
      dispatch({anchorsEnd: anchorsEndRef.current, type: 'rowResized'})
    })
    return () => initialLayout.stop()
  }, [datasetKey, dispatch, initialLayout, listRef])

  // Who moved the scroller is read from where it moved to (listMovedItself), never from the input that
  // moved it: the list writes down where it is putting the scroller before it moves it (its initial
  // position, every scrollTo, its end anchor, holding rows in place as they measure), and anything
  // else that moved it is the reader, however they did it.
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
      const maxScroll = scroller.scrollHeight - scroller.clientHeight
      if (listMovedItself({from, listScroll: listState.scroll, maxScroll, now})) return
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
      void listRef.current?.scrollToOffset({animated: false, offset: pageOffset(direction, state)})
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
