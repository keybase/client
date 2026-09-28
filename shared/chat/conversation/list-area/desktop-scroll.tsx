// Desktop adapter for the thread scroll target: turns what the LegendList thread sees into
// scroll-target events and carries out each directive with the list's own imperative API.
import * as React from 'react'
import type * as T from '@/constants/types'
import type {LegendListRef} from '@/common-adapters'
import {ThreadRefsContext} from '../normal/context'
import {
  decideScroll,
  indexOfOrdinal,
  initialScrollTarget,
  initialScrollTargetState,
  listAnchorsEnd,
  ownsEnd,
  type ScrollDirective,
  type ScrollEvent,
} from './scroll-target'

const centerTolerancePx = 8
// A scroller within this many pixels of its end counts as at the end.
const endTolerancePx = 2

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

  // Read by the loops below as they run, so they see the thread as it is now rather than when they
  // started.
  const messageOrdinalsRef = React.useRef(messageOrdinals)
  React.useEffect(() => {
    messageOrdinalsRef.current = messageOrdinals
  }, [messageOrdinals])

  const targetRef = React.useRef(initialScrollTargetState(datasetKey))

  // Asks the scroller, not the list's own isAtEnd: that flag comes from the content size and viewport
  // the list has recorded, and both lag a composer collapse, so it reads not-at-end while the scroller
  // is in fact at its end.
  const isScrolledToEnd = React.useCallback(() => {
    type ElLike = {children: ArrayLike<ElLike>; clientHeight: number; scrollHeight: number; scrollTop: number}
    const wrapper = wrapperRef.current as unknown as ElLike | null
    if (!wrapper) return false
    for (const child of Array.from(wrapper.children)) {
      if (child.scrollHeight - child.clientHeight > 1) {
        return child.scrollHeight - child.clientHeight - child.scrollTop <= endTolerancePx
      }
    }
    return false
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
  const endAnchorLoopRef = React.useRef<{cancelled: boolean} | undefined>(undefined)
  const stopEndAnchor = React.useCallback(() => {
    if (endAnchorLoopRef.current) endAnchorLoopRef.current.cancelled = true
  }, [])
  React.useEffect(() => stopEndAnchor, [stopEndAnchor])
  const verifyEndAnchor = React.useCallback(() => {
    stopEndAnchor()
    const loop = {cancelled: false}
    endAnchorLoopRef.current = loop
    const run = async () => {
      let previousScroll: number | undefined
      let corrections = 0
      for (let elapsed = 0; elapsed < 2000 && !loop.cancelled && ownsEnd(targetRef.current); ) {
        await new Promise<void>(resolve => setTimeout(resolve, 50))
        elapsed += 50
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
    }
    void run()
  }, [listRef, stopEndAnchor])

  // Owns the in-flight centering loop. It has to outlive re-renders: the messages that make
  // centering accurate arrive after it starts, so the loop must not be torn down by an effect
  // cleanup when messageOrdinals changes. Only a new target, a stop directive or unmount stops it.
  const centerLoopRef = React.useRef<{cancelled: boolean} | undefined>(undefined)
  // The loop re-centers for up to ~3s; a user scrolling in that window must win.
  const abortCentering = React.useCallback(() => {
    if (centerLoopRef.current) centerLoopRef.current.cancelled = true
  }, [])
  React.useEffect(() => abortCentering, [abortCentering])

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
      abortCentering()
      const loop = {cancelled: false}
      centerLoopRef.current = loop
      const run = async () => {
        let settled = 0
        let pinnedChecks = 0
        let scrollAtLastRequest: number | undefined
        for (let elapsed = 0; elapsed < 3000 && !loop.cancelled; ) {
          const wrapper = wrapperRef.current as unknown as {
            getBoundingClientRect: () => {height: number; top: number}
            querySelector: (s: string) => {getBoundingClientRect: () => {height: number; top: number}} | null
          } | null
          const el = wrapper ? wrapper.querySelector(`[data-ordinal="${target}"]`) : null
          if (!wrapper || !el) {
            // Target is outside the rendered window; get it mounted first.
            const idx = indexOfOrdinal(messageOrdinalsRef.current, target)
            if (idx >= 0) {
              void listRef.current?.scrollToIndex({animated: false, index: idx, viewPosition: 0.5})
            }
            settled = 0
            pinnedChecks = 0
            await new Promise<void>(resolve => setTimeout(resolve, 100))
            elapsed += 100
            continue
          }
          const elRect = el.getBoundingClientRect()
          const wrapRect = wrapper.getBoundingClientRect()
          const offBy = elRect.top + elRect.height / 2 - (wrapRect.top + wrapRect.height / 2)
          const scroll = listRef.current?.getState().scroll
          // Deadband, not exact centering: below this the row reads as centered, and chasing the
          // remainder only fights maintainVisibleContentPosition's own sub-pixel adjustments.
          if (Math.abs(offBy) <= centerTolerancePx || scroll === undefined) {
            pinnedChecks = 0
            // Only the iteration right after a correction can diagnose a clamp.
            scrollAtLastRequest = undefined
            if (++settled >= 3) return
          } else if (scroll === scrollAtLastRequest) {
            // A hit near either end of the thread cannot be centered: the offset we ask for gets
            // clamped and the row never reaches the middle. Our last correction moved the scroll
            // position not at all, so we are pinned against an edge — stop rather than spin.
            if (++pinnedChecks >= 3) return
          } else {
            pinnedChecks = 0
            scrollAtLastRequest = scroll
            void listRef.current?.scrollToOffset({animated: false, offset: scroll + offBy})
          }
          await new Promise<void>(resolve => setTimeout(resolve, 50))
          elapsed += 50
        }
      }
      void run()
    },
    [abortCentering, listRef, wrapperRef]
  )

  const perform = React.useCallback(
    (directive: ScrollDirective) => {
      switch (directive.type) {
        case 'pinEnd':
          if (directive.stopCentering) abortCentering()
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
          if (directive.stopCentering) abortCentering()
          return
      }
    },
    [abortCentering, isScrolledToEnd, listRef, scrollToCentered, verifyEndAnchor]
  )

  const dispatch = React.useCallback(
    (event: ScrollEvent) => {
      const {directive, state} = decideScroll(targetRef.current, event)
      targetRef.current = state
      perform(directive)
    },
    [perform]
  )

  React.useLayoutEffect(() => {
    dispatch({datasetKey, type: 'datasetChanged'})
  }, [datasetKey, dispatch])

  // Level-triggered on purpose: centring has to start when loaded flips true after the target was
  // already set, and when the target arrives in the thread after the request.
  React.useEffect(() => {
    dispatch({
      centeredOrdinal,
      containsLatestMessage,
      loaded,
      targetInData:
        centeredOrdinal !== undefined && indexOfOrdinal(messageOrdinalsRef.current, centeredOrdinal) >= 0,
      type: 'threadObserved',
    })
  }, [centeredOrdinal, containsLatestMessage, dispatch, loaded, messageOrdinals])

  React.useEffect(() => {
    dispatch({
      ordinal: editingOrdinal,
      targetInData:
        editingOrdinal !== undefined && indexOfOrdinal(messageOrdinalsRef.current, editingOrdinal) >= 0,
      type: 'editingChanged',
    })
  }, [dispatch, editingOrdinal])

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

  const onWheel = React.useCallback(() => {
    dispatch({how: 'wheel', type: 'userScrolled'})
  }, [dispatch])

  const scrollToBottom = React.useCallback(() => {
    dispatch({type: 'scrollToBottomRequested'})
  }, [dispatch])

  const scrollToRecent = React.useCallback(() => {
    dispatch({type: 'jumpToRecent'})
  }, [dispatch])

  const scrollUp = React.useCallback(() => {
    const state = listRef.current?.getState()
    if (!state) return
    dispatch({how: 'pageUp', type: 'userScrolled'})
    void listRef.current?.scrollToOffset({
      animated: false,
      offset: Math.max(0, state.scroll - state.scrollLength),
    })
  }, [dispatch, listRef])

  const scrollDown = React.useCallback(() => {
    const state = listRef.current?.getState()
    if (!state) return
    dispatch({how: 'pageDown', type: 'userScrolled'})
    void listRef.current?.scrollToOffset({
      animated: false,
      offset: state.scroll + state.scrollLength,
    })
  }, [dispatch, listRef])

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
    onMetricsChange,
    onWheel,
    scrollToRecent,
  }
}
