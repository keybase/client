// Native adapter for the thread scroll target: turns what the inverted FlatList thread sees into
// scroll-target events and carries out each directive with the list's own imperative API: coarse
// scrollToItem reasserts, then a closed-loop corrector against the viewable range.
import * as React from 'react'
import type * as T from '@/constants/types'
import noop from 'lodash/noop'
import {ThreadRefsContext} from '../normal/context'
import {useComposerAnchor} from '../composer-viewport-context'
import {restingScrollOffset} from '../composer-geometry'
import {makeOwnScrolls} from './own-scrolls'
import {KeyboardEvents} from 'react-native-keyboard-controller'
import {
  indexOfOrdinalNewestFirst,
  listAnchorsEnd,
  ownsEnd,
  type ScrollDirective,
  type ScrollEvent,
} from './scroll-target'
import {useScrollTarget} from './use-scroll-target'
import {nativeOlderPageDistance, withinPageLoad} from './paging'
import {
  atRestingEnd,
  correctorStep,
  isAppend,
  itemScrollHeading,
  readerMovedList,
  rowUncovered,
  type RowFrame,
  type ScrollReport,
} from './native-rules'
import {makeSchedule, useSchedule, type Scheduled} from './schedule'

export type NativeListRef = {
  scrollToOffset: (opts: {animated: boolean; offset: number}) => void
  scrollToItem: (opts: {animated: boolean; item: unknown; viewOffset?: number; viewPosition?: number}) => void
}

// The maintainVisibleContentPosition prop must ALWAYS be set (never toggled to undefined):
// RN Fabric only re-snapshots the MVP anchor while the prop is set, so an unset->set
// transition adjusts contentOffset against a stale anchor frame from before the prop was
// unset — a spurious jump + autoscroll animation of the whole list (seen after dismissing
// the keyboard following a send). Instead we swap between two configs:
// - closed (keyboard hidden): autoscrollToTopThreshold=1 so new messages at the bottom
//   auto-reveal when the user is pinned there.
// - noAutoscroll (keyboard open, or centered on a search hit, or the reader holding the end, or
//   empty list): MVP still anchors content, but autoscroll-to-top is off because:
//   1. with the keyboard open contentOffset.y = -(K-insets.bottom) <= 1, so the threshold
//      would fire on insert and scroll to y=0, hiding new messages behind the keyboard.
//   2. while centered on a search hit, autoscroll yanks the centered row.
//   3. a reader who holds the end has scrolled away from it, and stays where they are.
//   With the keyboard open, MVP's insert adjustment briefly holds old content in place;
//   the deferred re-pin on append below re-pins the newest message.
const maintainVisibleContentPositionClosed = {
  autoscrollToTopThreshold: 1,
  minIndexForVisible: 0,
}
const maintainVisibleContentPositionNoAutoscroll = {
  minIndexForVisible: 0,
}

// An older page waits out a second after the rows last changed, so a page landing is not taken for
// the reader nearing the new oldest row, and a second after it last asked, so a page on its way is
// not asked for again.
const pageLoadGate = 1000
// How long a centring scroll counts as on its way when the list reports no scroll for it: one that
// moved nothing, or a scroll to a row that failed.
const centreLandingMs = 300
// How long after a centring scroll lands the list has to report it came to rest.
const centreRestWaitMs = 50
// What a scroll to a row is for: a centre, or a reveal.
type ItemScroll = 'center' | 'reveal'

export const useNativeThreadScroll = (p: {
  // Newest first, as the inverted list holds them.
  messageOrdinals: ReadonlyArray<T.Chat.Ordinal>
  centeredOrdinal: T.Chat.Ordinal | undefined
  containsLatestMessage: boolean
  conversationIDKey: T.Chat.ConversationIDKey
  // Changes with the conversation and with every clear of its thread (a centred reload, jump to
  // recent): each is a new list as far as scrolling is concerned.
  datasetKey: string
  editingOrdinal: T.Chat.Ordinal | undefined
  isKeyboardVisible: boolean
  listRef: React.RefObject<NativeListRef | null>
  loadOlder: () => void
  loaded: boolean
}) => {
  const {centeredOrdinal, containsLatestMessage, conversationIDKey, datasetKey, editingOrdinal} = p
  const {isKeyboardVisible, loadOlder} = p
  const {listRef, loaded, messageOrdinals} = p
  const numOrdinals = messageOrdinals.length

  const {bottomInset, keyboardHeight} = useComposerAnchor()
  // The offset the list rests at with its newest message in view, below which it does not scroll:
  // negative while the keyboard is up. Read through a ref so every scroll uses the inset and keyboard
  // as they are when it runs, and nothing that scrolls changes identity with the inset.
  const anchorRef = React.useRef({bottomInset, keyboardHeight})
  React.useLayoutEffect(() => {
    anchorRef.current = {bottomInset, keyboardHeight}
  }, [bottomInset, keyboardHeight])
  const [restingOffset] = React.useState(
    () => () => restingScrollOffset(anchorRef.current.bottomInset, anchorRef.current.keyboardHeight.value)
  )
  // Resting at the end: over the keyboard as it is now.
  const [atEnd] = React.useState(() => (offset: number) => atRestingEnd(offset, restingOffset()))

  // Read by timers and list callbacks as they fire, so they see the target and rows as they are now.
  const centeredRef = React.useRef(centeredOrdinal)
  React.useEffect(() => {
    centeredRef.current = centeredOrdinal
  }, [centeredOrdinal])
  const ordsRef = React.useRef(messageOrdinals)
  React.useEffect(() => {
    ordsRef.current = messageOrdinals
  }, [messageOrdinals])

  const {listOwnsEnd, scrollTarget} = useScrollTarget()
  const [own] = React.useState(makeOwnScrolls)

  // What the list has reported of itself, undefined until it does. The list is keyed by conversation,
  // so a switch brings a new list that starts unmeasured, and the old one's figures say nothing of it.
  const metricsRef = React.useRef<{content?: number; offset?: number; viewport?: number}>({})
  const vFirstRef = React.useRef<number | null | undefined>(undefined)
  const vLastRef = React.useRef<number | null | undefined>(undefined)
  // Where each row sits in the content, as the list last laid it out.
  const rowFramesRef = React.useRef(new Map<T.Chat.Ordinal, RowFrame>())
  // The oldest row the list has laid out in this dataset. The list sizes its content only as far as the
  // rows it has laid out, so rows loaded past this one are not in the content size yet.
  const oldestLaidOutRef = React.useRef<T.Chat.Ordinal | undefined>(undefined)

  // Every scroll the list makes itself goes through these, saying where it is going, so the movement
  // toward there and the rest that follows are its own.
  const [scrollToOffset] = React.useState(() => (offset: number) => {
    own.issued(metricsRef.current.offset, offset, false)
    listRef.current?.scrollToOffset({animated: false, offset})
  })
  // A centre's coarse scroll puts the row in the middle of the whole scroll view, where its corrector
  // settles it. A reveal, animated, puts it in the middle of the part of the view nothing covers: the
  // keyboard (and the composer riding it) covers the bottom by as much as the resting offset sits
  // below 0, so the row is lifted by half of that.
  const [scrollToItem] = React.useState(() => (item: T.Chat.Ordinal, kind: ItemScroll) => {
    const animated = kind === 'reveal'
    const {offset, viewport} = metricsRef.current
    const lift = kind === 'reveal' ? -restingOffset() / 2 : 0
    const heading = itemScrollHeading({
      first: vFirstRef.current,
      frame: rowFramesRef.current.get(item),
      index: indexOfOrdinalNewestFirst(ordsRef.current, item),
      last: vLastRef.current,
      lift,
      offset,
      viewport,
    })
    if (heading !== undefined) own.issued(offset, heading, animated)
    listRef.current?.scrollToItem({animated, item, viewOffset: lift, viewPosition: 0.5})
  })

  // The delayed scrolls of a centre (coarse reasserts, the corrector's schedule, scroll-to-index
  // retries), which stopping centring cancels.
  const [centring] = React.useState(makeSchedule)
  // A reveal's scroll-to-index retries, which last as long as the scroll target holds the edit.
  const [reveals] = React.useState(makeSchedule)
  // The delayed pins to the end (the first load's retry, the append re-pin), which stopping centring
  // leaves alone: each asks the scroll target again when it fires, so a reader who took the end in
  // between is left where they are. Both are stopped by the detached cleanup below, not by
  // useSchedule's, which would run first and hide whether the first load's retry was still pending.
  const [pins] = React.useState(makeSchedule)

  // Closed-loop centring corrector: scrollToItem lands at the wrong offset here (inverted list, custom
  // keyboard scroll view, tall variable-height image rows), so it steps from the viewable index range
  // instead (correctorStep).
  const correctRef = React.useRef<{active: boolean; iters: number; target?: T.Chat.Ordinal}>({
    active: false,
    iters: 0,
  })

  // When the centring scroll last issued stops counting as on its way, after which the corrector steps
  // again: once the list reports it came to rest (iOS reports a rest even for an instant scroll), a
  // moment after it reports the scroll (a list that reports no rest for it), or once it has had time
  // to land (one that moved nothing, or failed). Centring issues its scrolls one at a time: a scroll
  // still queued when a newer one is issued moves the list away from the newer one's destination,
  // which reads as the reader taking over, and a rest arriving after the newer one was issued ends
  // that one's flight early.
  const centreScrollUntilRef = React.useRef(0)
  const [centreScrollPending] = React.useState(() => () => Date.now() < centreScrollUntilRef.current)
  const [issueCentreScroll] = React.useState(() => (scroll: () => void) => {
    centreScrollUntilRef.current = Date.now() + centreLandingMs
    scroll()
  })

  // The list as its last scroll event reported it, which the next one is compared with.
  const lastScrollRef = React.useRef<ScrollReport | undefined>(undefined)
  // Compared by value, so a freeze/thaw re-mount, which keeps the list, keeps its figures.
  const measuredConvRef = React.useRef(conversationIDKey)
  React.useLayoutEffect(() => {
    if (measuredConvRef.current === conversationIDKey) return
    measuredConvRef.current = conversationIDKey
    metricsRef.current = {}
    lastScrollRef.current = undefined
    vFirstRef.current = undefined
    vLastRef.current = undefined
    rowFramesRef.current = new Map()
    oldestLaidOutRef.current = undefined
  }, [conversationIDKey])
  // The rows asked for by scrollToItem, each asked for by a centre or a reveal, with how many of its
  // failures have been retried: a row outside the rendered window makes the scroll fail, and the
  // retry asks for that same row again once more rows have rendered. A request lasts as long as what
  // asked for it: a centre's until it settles or centring stops, a reveal's until its row is in view
  // or its edit is no longer held.
  const itemScrollsRef = React.useRef(new Map<T.Chat.Ordinal, {kind: ItemScroll; retries: number}>())
  const [requestItem] = React.useState(() => (item: T.Chat.Ordinal, kind: ItemScroll) => {
    itemScrollsRef.current.set(item, {kind, retries: 0})
  })
  const [holdsEdit] = React.useState(() => (item: T.Chat.Ordinal) => {
    const {holdingEdit, lastEditing} = scrollTarget.state
    return holdingEdit && lastEditing === item
  })
  const [stopCentering] = React.useState(() => () => {
    correctRef.current.active = false
    centreScrollUntilRef.current = 0
    itemScrollsRef.current.forEach((request, item) => {
      if (request.kind === 'center' || !holdsEdit(item)) itemScrollsRef.current.delete(item)
    })
    centring.stop()
  })
  const [settleCenter] = React.useState(() => () => {
    const {active, target} = correctRef.current
    if (!active) return
    correctRef.current.active = false
    if (target !== undefined) itemScrollsRef.current.delete(target)
    // Only ever leaves the list alone.
    scrollTarget.decide({type: 'centerSettled'})
  })
  const [correctCenter] = React.useState(() => {
    const correct = (first: number | null | undefined, last: number | null | undefined) => {
      const st = correctRef.current
      if (!st.active || centreScrollPending()) return
      const co = centeredRef.current
      const ords = ordsRef.current
      const num = ords.length
      if (co === undefined || !num || first == null || last == null) return
      const targetIndex = indexOfOrdinalNewestFirst(ords, co)
      if (targetIndex < 0) return
      const {content, offset, viewport} = metricsRef.current
      const step = correctorStep({
        content,
        first,
        iters: st.iters,
        last,
        offset,
        resting: restingOffset(),
        rows: num,
        targetIndex,
        viewport,
      })
      if (step.type === 'settle') {
        settleCenter()
        return
      }
      if (step.type === 'wait') return
      st.iters += 1
      issueCentreScroll(() => scrollToOffset(step.offset))
      centring.after(centreLandingMs, () => correct(vFirstRef.current, vLastRef.current))
    }
    return correct
  })
  const [correctCenterAfter] = React.useState(
    () => (delay: number) => centring.after(delay, () => correctCenter(vFirstRef.current, vLastRef.current))
  )

  // Coarse: scrollToItem lands at the wrong offset for tall variable-height rows, but it gets the
  // target rendered for the corrector to refine.
  const moveToward = React.useCallback(
    (target: T.Chat.Ordinal) => {
      const reassert = (delay: number) =>
        centring.after(delay, () => {
          if (centeredRef.current !== target || centreScrollPending()) {
            return
          }
          issueCentreScroll(() => scrollToItem(target, 'center'))
          correctCenterAfter(centreLandingMs)
        })
      ;[50, 250].forEach(reassert)
    },
    [centreScrollPending, centring, correctCenterAfter, issueCentreScroll, scrollToItem]
  )

  // The corrector's 50/250/500/900ms schedule, started once per target. With its 13 steps it is the
  // whole budget: the target settles where the last step leaves it.
  const ladderRef = React.useRef<Array<Scheduled>>([])
  const initialRetryRef = React.useRef<Scheduled | undefined>(undefined)
  const dispatchRef = React.useRef<(event: ScrollEvent) => void>(noop)

  const perform = React.useCallback(
    (directive: ScrollDirective) => {
      switch (directive.type) {
        case 'pinEnd':
          if (directive.stopCentering) stopCentering()
          // The end is a fixed resting offset, so every pin is the one scroll there: from the end it moves
          // nothing, and there is no bootstrap of the list's own to wait out.
          scrollToOffset(restingOffset())
          if (directive.retry) {
            initialRetryRef.current = pins.after(100, () => {
              dispatchRef.current({hasMessages: ordsRef.current.length > 0, retry: true, type: 'initialLoad'})
            })
          }
          return
        case 'center':
          requestItem(directive.ordinal, 'center')
          moveToward(directive.ordinal)
          correctRef.current = {active: true, iters: 0, target: directive.ordinal}
          centreScrollUntilRef.current = 0
          ladderRef.current.forEach(t => t.cancel())
          ladderRef.current = [50, 250, 500, 900].map((d, i, ladder) =>
            centring.after(d, () => {
              correctCenter(vFirstRef.current, vLastRef.current)
              if (i === ladder.length - 1) settleCenter()
            })
          )
          return
        case 'reveal':
          requestItem(directive.ordinal, 'reveal')
          scrollToItem(directive.ordinal, 'reveal')
          return
        case 'leaveAlone':
          if (directive.stopCentering) stopCentering()
          return
        default: {
          const unexpected: never = directive
          return unexpected
        }
      }
    },
    [
      centring,
      correctCenter,
      moveToward,
      pins,
      requestItem,
      restingOffset,
      scrollToItem,
      scrollToOffset,
      settleCenter,
      stopCentering,
    ]
  )

  const dispatch = React.useCallback(
    (event: ScrollEvent) => {
      perform(scrollTarget.decide(event))
    },
    [perform, scrollTarget]
  )
  // Read by the detached cleanup, so it runs only when the list is hidden or unmounted however
  // dispatch's dependencies change, and by the first load's retry, which perform schedules.
  React.useLayoutEffect(() => {
    dispatchRef.current = dispatch
  }, [dispatch])

  // Compared by value, not by the effect re-running: a freeze/thaw of this screen re-mounts effects
  // with nothing changed. Declared ahead of every effect that dispatches, so they see the new
  // dataset's state.
  const datasetRef = React.useRef<string | undefined>(undefined)
  React.useLayoutEffect(() => {
    if (datasetRef.current === datasetKey) return
    datasetRef.current = datasetKey
    oldestLaidOutRef.current = undefined
    dispatch({type: 'datasetChanged'})
  }, [datasetKey, dispatch])

  // Level-triggered: navigating to a hit reloads the thread around it, so the rows are briefly empty
  // when the ordinal changes. A layout effect ahead of the first load's, which relies on a centre
  // request having taken the end already.
  React.useLayoutEffect(() => {
    dispatch({
      atNewest: () => {
        const {offset} = metricsRef.current
        return containsLatestMessage && offset !== undefined && atEnd(offset)
      },
      centeredOrdinal,
      loaded,
      targetInData: centeredOrdinal !== undefined && indexOfOrdinalNewestFirst(messageOrdinals, centeredOrdinal) >= 0,
      type: 'threadObserved',
    })
  }, [atEnd, centeredOrdinal, containsLatestMessage, dispatch, loaded, messageOrdinals])

  // Measured against the part of the list nothing covers, not the list's own viewability, which
  // measures against the whole scroll view, covered or not.
  const [rowFullyVisible] = React.useState(() => (ordinal: T.Chat.Ordinal) => {
    const frame = rowFramesRef.current.get(ordinal)
    const {offset, viewport} = metricsRef.current
    if (!frame || offset === undefined || viewport === undefined) return false
    return rowUncovered(frame, {offset, resting: restingOffset(), viewport})
  })
  // A reveal is done once its row is wholly in view, and over once its edit is no longer held.
  const [dropFinishedReveals] = React.useState(() => () => {
    itemScrollsRef.current.forEach((request, item) => {
      if (request.kind === 'reveal' && (!holdsEdit(item) || rowFullyVisible(item))) {
        itemScrollsRef.current.delete(item)
      }
    })
  })

  React.useEffect(() => {
    dispatch({
      ordinal: editingOrdinal,
      rowFullyVisible: () => editingOrdinal !== undefined && rowFullyVisible(editingOrdinal),
      targetInData: editingOrdinal !== undefined && indexOfOrdinalNewestFirst(messageOrdinals, editingOrdinal) >= 0,
      type: 'editingChanged',
    })
    dropFinishedReveals()
  }, [dispatch, dropFinishedReveals, editingOrdinal, messageOrdinals, rowFullyVisible])

  // The keyboard rising or falling, or the safe area changing, changes how much of the list is in view.
  // The keyboard's is judged once it has finished moving, and the list with it: the keyboard scroll
  // view carries the rows up as the keyboard rises, so a row near the top is pushed off only by the
  // end of the rise, and whether the keyboard counts as visible flips as it starts. The safe area's is
  // compared by value, so a freeze/thaw re-mount changes nothing.
  React.useEffect(() => {
    const coverChanged = () => dispatch({anchorsEnd: false, rowFullyVisible, type: 'viewportResized'})
    const subscriptions = [
      KeyboardEvents.addListener('keyboardDidShow', coverChanged),
      KeyboardEvents.addListener('keyboardDidHide', coverChanged),
    ]
    return () => subscriptions.forEach(s => s.remove())
  }, [dispatch, rowFullyVisible])
  const coveredInsetRef = React.useRef(bottomInset)
  React.useEffect(() => {
    if (coveredInsetRef.current === bottomInset) return
    coveredInsetRef.current = bottomInset
    dispatch({anchorsEnd: false, rowFullyVisible, type: 'viewportResized'})
  }, [bottomInset, dispatch, rowFullyVisible])

  // With the keyboard open, maintainVisibleContentPosition adjusts contentOffset by a new message's
  // height, undoing the scroll to the bottom from onSubmit. The re-pin is deferred past that
  // adjustment, which runs on the UI thread after React's commit.
  const newestOrdinal = messageOrdinals[0]
  const prevNewestRef = React.useRef(newestOrdinal)
  // The dataset prevNewestRef's baseline belongs to, compared by value so a freeze/thaw re-mount
  // does not reset it.
  const newestBaselineDatasetRef = React.useRef(datasetKey)
  const isKeyboardVisibleRef = React.useRef(isKeyboardVisible)
  React.useLayoutEffect(() => {
    isKeyboardVisibleRef.current = isKeyboardVisible
  })
  React.useLayoutEffect(() => {
    const sameDataset = newestBaselineDatasetRef.current === datasetKey
    newestBaselineDatasetRef.current = datasetKey
    const previousNewest = prevNewestRef.current
    prevNewestRef.current = newestOrdinal
    if (!isAppend({newest: newestOrdinal, previousNewest, sameDataset})) return undefined
    // Decided when the re-pin would fire, with the keyboard as it is then: if it closed in between,
    // the list's own anchor already shows the newest message.
    const repin = pins.after(0, () => {
      dispatch({anchorHidesNewest: isKeyboardVisibleRef.current, type: 'appended'})
    })
    return repin.cancel
  }, [datasetKey, dispatch, newestOrdinal, pins])

  // The conversation last loaded, not a boolean: a freeze/thaw of this screen re-mounts effects with
  // no conversation change, and must not re-run the first load's scroll (returning from the info
  // panel would lose the reader's place).
  const loadedConvRef = React.useRef<string | undefined>(undefined)
  React.useLayoutEffect(() => {
    const justLoaded = loaded && loadedConvRef.current !== conversationIDKey
    if (loaded) {
      loadedConvRef.current = conversationIDKey
    }
    if (!justLoaded) return
    dispatch({hasMessages: numOrdinals > 0, retry: false, type: 'initialLoad'})
  }, [conversationIDKey, dispatch, loaded, numOrdinals])

  // Hidden (a screen pushed over this one) or unmounted: nothing scheduled may scroll a list no
  // longer shown. Work cut short is left to be done again if the list comes back: a target still
  // settling is centred afresh, and a first load whose retry had not fired is treated as not yet
  // scrolled. StrictMode's mount-time effect re-run is the same case.
  React.useEffect(
    () => () => {
      if (initialRetryRef.current?.pending()) loadedConvRef.current = undefined
      pins.stop()
      reveals.stop()
      dispatchRef.current({type: 'detached'})
    },
    [pins, reveals]
  )

  // Waits for more rows to render and asks for the failed row again, six times per request, while the
  // request lasts.
  const [onScrollToIndexFailed] = React.useState(() => (info: {index: number}) => {
    const item = ordsRef.current[info.index]
    const request = item === undefined ? undefined : itemScrollsRef.current.get(item)
    if (item === undefined || !request || request.retries > 5) return
    request.retries += 1
    const reveal = request.kind === 'reveal'
    ;(reveal ? reveals : centring).after(200, () => {
      if (itemScrollsRef.current.get(item) !== request || (reveal && !holdsEdit(item))) return
      if (reveal) {
        scrollToItem(item, request.kind)
        return
      }
      if (centreScrollPending()) return
      issueCentreScroll(() => scrollToItem(item, request.kind))
      correctCenterAfter(centreLandingMs)
    })
  })

  // Checked as the list scrolls, as its content or viewport changes size, and once the gate after new
  // rows has passed, so a short page, or a page landing with the reader still, loads the next without
  // a scroll. Until the list first reports a scroll it sits at the resting offset.
  const loadOlderRef = React.useRef(loadOlder)
  React.useEffect(() => {
    loadOlderRef.current = loadOlder
  }, [loadOlder])
  const nextLoadRef = React.useRef(0)
  const [loadPages] = React.useState(() => () => {
    const {content, viewport} = metricsRef.current
    const oldestLaidOut = oldestLaidOutRef.current
    if (content === undefined || viewport === undefined || oldestLaidOut === undefined) return
    const distance = nativeOlderPageDistance({
      content,
      offset: metricsRef.current.offset ?? restingOffset(),
      oldestLaidOut,
      ordinals: ordsRef.current,
      viewport,
    })
    if (!withinPageLoad(distance, viewport)) return
    const now = Date.now()
    if (now <= nextLoadRef.current) return
    nextLoadRef.current = now + pageLoadGate
    loadOlderRef.current()
  })
  // Only new rows schedule a check of their own: a load that brought none leaves nothing more to ask
  // for until the list moves or changes size.
  const pageChecks = useSchedule()
  React.useEffect(() => {
    nextLoadRef.current = Date.now() + pageLoadGate
    return pageChecks.after(pageLoadGate + 1, loadPages).cancel
  }, [loadPages, numOrdinals, pageChecks])

  // Who moved the list is read from how it moved (readerMovedList), never from the input that moved
  // it: a drag, the status bar, VoiceOver alike.
  const onScroll = React.useCallback(
    (e: {
      nativeEvent: {contentOffset: {y: number}; contentSize: {height: number}; layoutMeasurement: {height: number}}
    }) => {
      const content = e.nativeEvent.contentSize.height
      const offset = e.nativeEvent.contentOffset.y
      metricsRef.current = {content, offset, viewport: e.nativeEvent.layoutMeasurement.height}
      const last = lastScrollRef.current
      const now = {content, offset, resting: restingOffset()}
      lastScrollRef.current = now
      const readerMoved = readerMovedList(last, now, {
        carried: () => !!last && own.carries(last.offset, offset),
        ownsEnd: ownsEnd(scrollTarget.state),
      })
      if (readerMoved) dispatch(own.readerMoved())
      if (centreScrollPending()) {
        centreScrollUntilRef.current = Math.min(centreScrollUntilRef.current, Date.now() + centreRestWaitMs)
        correctCenterAfter(centreRestWaitMs)
      }
      dropFinishedReveals()
      loadPages()
    },
    [
      centreScrollPending,
      correctCenterAfter,
      dispatch,
      dropFinishedReveals,
      loadPages,
      own,
      restingOffset,
      scrollTarget,
    ]
  )
  const [onContentSizeChange] = React.useState(() => (_w: number, h: number) => {
    metricsRef.current = {...metricsRef.current, content: h}
    loadPages()
  })
  const [onLayout] = React.useState(() => (e: {nativeEvent: {layout: {height: number}}}) => {
    metricsRef.current = {...metricsRef.current, viewport: e.nativeEvent.layout.height}
    loadPages()
  })
  // A drag is the reader's for certain, and is seen before it moves anything.
  const onScrollBeginDrag = React.useCallback(() => {
    dispatch(own.readerMoved())
  }, [dispatch, own])

  // The list coming to rest: the reader letting go, a fling or a status-bar tap's scroll stopping, or
  // (on iOS) a scroll of the list's own ending, which hands nothing back.
  const rested = React.useCallback(
    (e: {nativeEvent: {contentOffset: {y: number}}}) => {
      const handedBack = own.rested(atEnd(e.nativeEvent.contentOffset.y))
      if (handedBack) dispatch(handedBack)
      if (centreScrollPending()) {
        centreScrollUntilRef.current = 0
        correctCenter(vFirstRef.current, vLastRef.current)
      }
    },
    [atEnd, centreScrollPending, correctCenter, dispatch, own]
  )
  // Letting go is where the list comes to rest only when the finger lifts still; moving, it flings on,
  // and it comes to rest where the fling ends. On Android a fling's end is reported even after a still
  // lift, and finds the reader's rest already taken.
  const onScrollEndDrag = React.useCallback(
    (e: {nativeEvent: {contentOffset: {y: number}; velocity?: {y: number}}}) => {
      if (e.nativeEvent.velocity?.y) return
      rested(e)
    },
    [rested]
  )

  // Data indices of the first and last viewable rows; the corrector steps from them.
  const [onViewableRange] = React.useState(
    () => (first: number | null | undefined, last: number | null | undefined) => {
      vFirstRef.current = first
      vLastRef.current = last
      correctCenter(first, last)
    }
  )
  const [onCellLayout] = React.useState(() => (item: T.Chat.Ordinal, layout: {height: number; y: number}) => {
    rowFramesRef.current.set(item, {height: layout.height, y: layout.y})
    const oldest = oldestLaidOutRef.current
    if (oldest === undefined || item < oldest) oldestLaidOutRef.current = item
  })

  const requestBottom = React.useCallback(() => {
    dispatch({centeredOrdinal: centeredRef.current, type: 'scrollToBottomRequested'})
  }, [dispatch])

  const {setScrollRef} = React.useContext(ThreadRefsContext)
  React.useEffect(() => {
    setScrollRef({scrollDown: noop, scrollToBottom: requestBottom, scrollUp: noop})
  }, [requestBottom, setScrollRef])

  // The native list loads no newer pages, so its rows' newest end only ever grows by new messages,
  // and a window of history leaves its end anchor on.
  const mvpAutoscroll =
    listAnchorsEnd({centeredOrdinal, heldLatest: true, listOwnsEnd}) && numOrdinals > 0 && !isKeyboardVisible

  return {
    maintainVisibleContentPosition: mvpAutoscroll
      ? maintainVisibleContentPositionClosed
      : maintainVisibleContentPositionNoAutoscroll,
    onCellLayout,
    onContentSizeChange,
    onLayout,
    onScroll,
    onMomentumScrollEnd: rested,
    onScrollBeginDrag,
    onScrollEndDrag,
    onScrollToIndexFailed,
    onScrollToTop: rested,
    onViewableRange,
    scrollToBottom: requestBottom,
  }
}
