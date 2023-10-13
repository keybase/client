import * as C from '../../../constants'
import * as Container from '../../../util/container'
import * as Kb from '../../../common-adapters'
import * as Hooks from './hooks'
import * as React from 'react'
import * as T from '../../../constants/types'
import Separator from '../messages/separator'
import SpecialBottomMessage from '../messages/special-bottom-message'
import SpecialTopMessage from '../messages/special-top-message'
import chunk from 'lodash/chunk'
import type {Props} from '.'
import {ErrorBoundary} from '../../../common-adapters'
import {findLast} from '../../../util/arrays'
import {getMessageRender} from '../messages/wrapper'
import {globalMargins} from '../../../styles/shared'

// Infinite scrolling list.
// We group messages into a series of Waypoints. When the waypoint exits the screen we replace it with a single div instead
// We use react-measure to cache the heights
const scrollOrdinalKey = 'scroll-ordinal-key'

// We load the first thread automatically so in order to mark it read
// we send an action on the first mount once
let markedInitiallyLoaded = false

// use intersection observer for waypoints
const useIntersectionObserver = () => {
  const listenersRef = React.useRef(new Map<Element, (isIntersecting: boolean) => void>())
  const onIntersectionObservedRef = React.useRef((entries: Array<IntersectionObserverEntry>) => {
    for (const entry of entries) {
      const cb = listenersRef.current.get(entry.target)
      if (cb) {
        const {isIntersecting} = entry
        cb(isIntersecting)
      }
    }
  })

  const intersectionObserverRef = React.useRef<IntersectionObserver | undefined>()

  // we want to observe a node
  const observe = React.useCallback(
    (e: HTMLDivElement, cb: (isIntersecting: boolean) => void) => {
      // set up for first time
      if (!intersectionObserverRef.current) {
        const root = e.closest('.chat-scroller')
        intersectionObserverRef.current = new IntersectionObserver(
          entries => onIntersectionObservedRef.current(entries),
          {root}
        )
      }
      const ro = intersectionObserverRef.current
      listenersRef.current.set(e, cb)
      ro.observe(e)
      return () => {
        listenersRef.current.delete(e)
        ro.unobserve(e)
      }
    },
    [intersectionObserverRef]
  )

  React.useEffect(() => {
    let ior = intersectionObserverRef.current
    return () => {
      ior?.disconnect()
      intersectionObserverRef.current = undefined
      ior = undefined
    }
  }, [])

  return observe
}

// we use resize observer to watch for size changes. we use one observer and attach nodes
const useResizeObserver = () => {
  const listenersRef = React.useRef(new Map<Element, (p: {height: number; width: number}) => void>())
  const onResizeObservedRef = React.useRef((entries: Array<ResizeObserverEntry>) => {
    for (const entry of entries) {
      const cb = listenersRef.current.get(entry.target)
      if (cb) {
        const rect = {
          // ignore floating point issues
          height: Math.floor(entry.contentRect.height),
          width: Math.floor(entry.contentRect.width),
        }
        cb(rect)
      }
    }
  })

  const resizeObserverRef = React.useRef<ResizeObserver | undefined>(
    new ResizeObserver(entries => onResizeObservedRef.current(entries))
  )

  // we want to observe a node
  const observe = React.useCallback(
    (e: HTMLDivElement, cb: (contentRect: {height: number; width: number}) => void) => {
      const ro = resizeObserverRef.current
      if (ro) {
        listenersRef.current.set(e, cb)
        ro.observe(e)
        return () => {
          listenersRef.current.delete(e)
          ro.unobserve(e)
        }
      } else {
        throw new Error('no ro?')
      }
    },
    [resizeObserverRef]
  )

  React.useEffect(() => {
    let ror = resizeObserverRef.current
    return () => {
      ror?.disconnect()
      resizeObserverRef.current = undefined
      ror = undefined
    }
  }, [])

  return observe
}

// scrolling related things
const useScrolling = (
  p: Pick<Props, 'requestScrollUpRef' | 'requestScrollToBottomRef' | 'requestScrollDownRef'> & {
    containsLatestMessage: boolean
    messageOrdinals: Array<T.Chat.Ordinal>
    listRef: React.MutableRefObject<HTMLDivElement | null>
    centeredOrdinal: T.Chat.Ordinal | undefined
  }
) => {
  const conversationIDKey = C.useChatContext(s => s.id)
  const {requestScrollUpRef, requestScrollToBottomRef, requestScrollDownRef} = p
  const {listRef, containsLatestMessage, messageOrdinals, centeredOrdinal} = p
  const editingOrdinal = C.useChatContext(s => s.editing)
  const loadNewerMessagesDueToScroll = C.useChatContext(s => s.dispatch.loadNewerMessagesDueToScroll)
  const loadNewerMessages = C.useThrottledCallback(
    React.useCallback(() => {
      loadNewerMessagesDueToScroll()
    }, [loadNewerMessagesDueToScroll]),
    200
  )
  const conversationIDKeyChanged = C.useCIDChanged(conversationIDKey)
  const lastLoadOrdinal = React.useRef<T.Chat.Ordinal>(-1)
  if (conversationIDKeyChanged) {
    lastLoadOrdinal.current = -1
  }
  const oldestOrdinal = messageOrdinals[0] ?? -1
  const loadOlderMessagesDueToScroll = C.useChatContext(s => s.dispatch.loadOlderMessagesDueToScroll)
  const loadOlderMessages = React.useCallback(() => {
    // already loaded and nothing has changed
    if (lastLoadOrdinal.current === oldestOrdinal) {
      return
    }
    lastLoadOrdinal.current = oldestOrdinal
    loadOlderMessagesDueToScroll()
  }, [loadOlderMessagesDueToScroll, oldestOrdinal])
  const {markInitiallyLoadedThreadAsRead} = Hooks.useActions({conversationIDKey})
  // pixels away from top/bottom to load/be locked
  const listEdgeSlopBottom = 10
  const listEdgeSlopTop = 1000
  const isMounted = C.useIsMounted()
  const isScrollingRef = React.useRef(false)
  const ignoreOnScrollRef = React.useRef(false)
  const lockedToBottomRef = React.useRef(true)
  // so we can turn pointer events on / off
  const pointerWrapperRef = React.useRef<HTMLDivElement | null>(null)

  const isLockedToBottom = React.useCallback(() => {
    return lockedToBottomRef.current
  }, [lockedToBottomRef])

  const adjustScrollAndIgnoreOnScroll = React.useCallback(
    (fn: () => void) => {
      ignoreOnScrollRef.current = true
      fn()
    },
    [ignoreOnScrollRef]
  )

  const checkForLoadMoreThrottled = React.useCallback(() => {
    // are we at the top?
    const list = listRef.current
    if (list) {
      if (list.scrollTop < listEdgeSlopTop) {
        loadOlderMessages()
      } else if (
        !containsLatestMessage &&
        !isLockedToBottom() &&
        list.scrollTop > list.scrollHeight - list.clientHeight - listEdgeSlopBottom
      ) {
        loadNewerMessages()
      }
    }
  }, [listRef, containsLatestMessage, loadNewerMessages, loadOlderMessages, isLockedToBottom]) //,

  const scrollToBottom = React.useCallback(() => {
    lockedToBottomRef.current = true
    const actuallyScroll = () => {
      if (!isMounted()) return
      const list = listRef.current
      if (list) {
        adjustScrollAndIgnoreOnScroll(() => {
          list.scrollTop = list.scrollHeight - list.clientHeight
        })
      }
    }
    actuallyScroll()
    setTimeout(() => {
      requestAnimationFrame(actuallyScroll)
    }, 1)
  }, [listRef, adjustScrollAndIgnoreOnScroll, isMounted])

  const scrollToCentered = React.useCallback(() => {
    // grab the waypoint we made for the centered ordinal and scroll to it
    setTimeout(() => {
      const scrollWaypoint = listRef.current?.querySelectorAll(`[data-key=${scrollOrdinalKey}]`)
      scrollWaypoint?.[0]?.scrollIntoView({block: 'center', inline: 'nearest'})
    }, 100)
  }, [listRef])

  const scrollDown = React.useCallback(() => {
    const list = listRef.current
    list &&
      adjustScrollAndIgnoreOnScroll(() => {
        list.scrollTop += list.clientHeight
      })
  }, [listRef, adjustScrollAndIgnoreOnScroll])

  const scrollUp = React.useCallback(() => {
    lockedToBottomRef.current = false
    const list = listRef.current
    list &&
      adjustScrollAndIgnoreOnScroll(() => {
        list.scrollTop -= list.clientHeight
        checkForLoadMoreThrottled()
      })
  }, [listRef, adjustScrollAndIgnoreOnScroll, checkForLoadMoreThrottled])

  // After lets turn them back on
  const onAfterScroll = C.useDebouncedCallback(
    React.useCallback(() => {
      if (isScrollingRef.current) {
        isScrollingRef.current = false
        if (pointerWrapperRef.current) {
          pointerWrapperRef.current.style.pointerEvents = 'initial'
        }
      }

      const list = listRef.current
      // are we locked on the bottom?
      if (list) {
        lockedToBottomRef.current =
          list.scrollHeight - list.clientHeight - list.scrollTop < listEdgeSlopBottom
      }
    }, [listRef]),
    200
  )

  // While scrolling we disable mouse events to speed things up. We avoid state so we don't re-render while doing this
  const onScrollThrottled = C.useThrottledCallback(
    React.useCallback(() => {
      if (!isScrollingRef.current) {
        isScrollingRef.current = true
        if (pointerWrapperRef.current) {
          pointerWrapperRef.current.style.pointerEvents = 'none'
        }
      }
      onAfterScroll()
    }, [onAfterScroll]),
    100,
    {leading: true, trailing: true}
  )

  const onScroll = React.useCallback(() => {
    if (listRef.current) {
      scrollBottomOffsetRef.current = Math.max(0, listRef.current.scrollHeight - listRef.current.scrollTop)
    } else {
      scrollBottomOffsetRef.current = undefined
    }
    if (ignoreOnScrollRef.current) {
      ignoreOnScrollRef.current = false
      return
    }
    // quickly set to false to assume we're not locked. if we are the throttled one will set it to true
    lockedToBottomRef.current = false
    checkForLoadMoreThrottled()
    onScrollThrottled()
  }, [checkForLoadMoreThrottled, onScrollThrottled, listRef])

  const setListRef = React.useCallback(
    (list: HTMLDivElement | null) => {
      if (listRef.current && listRef.current !== list) {
        listRef.current.removeEventListener('scroll', onScroll)
      }
      if (list) {
        list.addEventListener('scroll', onScroll, {passive: true})
      }
      listRef.current = list
    },
    [onScroll, listRef]
  )

  const cleanupDebounced = React.useCallback(() => {
    onAfterScroll.cancel()
    onScrollThrottled.cancel()
  }, [onAfterScroll, onScrollThrottled])

  React.useEffect(() => {
    return () => {
      cleanupDebounced()
    }
  }, [cleanupDebounced])

  React.useEffect(() => {
    if (!markedInitiallyLoaded) {
      markedInitiallyLoaded = true
      markInitiallyLoadedThreadAsRead()
    }
    if (centeredOrdinal) {
      lockedToBottomRef.current = false
      scrollToCentered()
      return
    }
    if (isLockedToBottom()) {
      scrollToBottom()
    }
    // we only want this to happen once per mount
    // eslint-disable-next-line
  }, [])

  // if we scroll up try and keep the position
  const scrollBottomOffsetRef = React.useRef<number | undefined>()
  if (conversationIDKeyChanged) {
    scrollBottomOffsetRef.current = undefined
  }

  const prevFirstOrdinal = Container.usePrevious(messageOrdinals[0])
  const prevOrdinalLength = Container.usePrevious(messageOrdinals.length)

  // called after dom update, to apply value
  React.useLayoutEffect(() => {
    // didn't scroll up
    if (messageOrdinals.length === prevOrdinalLength || messageOrdinals[0] === prevFirstOrdinal) return
    const {current} = listRef
    if (current && !isLockedToBottom() && isMounted() && scrollBottomOffsetRef.current !== undefined) {
      current.scrollTop = current.scrollHeight - scrollBottomOffsetRef.current
    }
    // we want this to fire when the ordinals change
    // eslint-disable-next-line
  }, [messageOrdinals])

  // Check to see if our centered ordinal has changed, and if so, scroll to it
  const [lastCenteredOrdinal, setLastCenteredOrdinal] = React.useState(centeredOrdinal)
  if (lastCenteredOrdinal !== centeredOrdinal) {
    if (centeredOrdinal) {
      lockedToBottomRef.current = false
      scrollToCentered()
    }
    setLastCenteredOrdinal(centeredOrdinal)
  }

  requestScrollToBottomRef.current = () => {
    lockedToBottomRef.current = true
    scrollToBottom()
  }
  requestScrollUpRef.current = () => {
    scrollUp()
  }
  requestScrollDownRef.current = () => {
    scrollDown()
  }

  // go to editing message
  Container.useDepChangeEffect(() => {
    if (!editingOrdinal) return
    const idx = messageOrdinals.indexOf(editingOrdinal)
    if (idx === -1) return
    const waypoints = listRef.current?.querySelectorAll('[data-key]')
    if (!waypoints) return
    // find an id that should be our parent
    const toFind = Math.floor(T.Chat.ordinalToNumber(editingOrdinal) / 10)
    const allWaypoints = Array.from(waypoints) as Array<HTMLElement>
    const found = findLast(allWaypoints, w => {
      const key = w.dataset['key']
      return key !== undefined && parseInt(key, 10) === toFind
    })
    found?.scrollIntoView({block: 'center', inline: 'nearest'})
  }, [editingOrdinal, messageOrdinals])

  // conversation changed
  Container.useDepChangeEffect(() => {
    cleanupDebounced()
    lockedToBottomRef.current = true
    scrollToBottom()
  }, [conversationIDKey, cleanupDebounced, scrollToBottom])

  return {isLockedToBottom, pointerWrapperRef, scrollToBottom, setListRef}
}

const useItems = (p: {
  messageOrdinals: Array<T.Chat.Ordinal>
  centeredOrdinal: T.Chat.Ordinal | undefined
  editingOrdinal: T.Chat.Ordinal | undefined
  resizeObserve: ReturnType<typeof useResizeObserver>
  intersectionObserve: ReturnType<typeof useIntersectionObserver>
  messageTypeMap: Map<T.Chat.Ordinal, T.Chat.RenderMessageType> | undefined
}) => {
  const {messageOrdinals, centeredOrdinal, editingOrdinal} = p
  const {resizeObserve, intersectionObserve, messageTypeMap} = p
  const ordinalsInAWaypoint = 10
  const rowRenderer = React.useCallback(
    (ordinal: T.Chat.Ordinal, previous?: T.Chat.Ordinal) => {
      const type = messageTypeMap?.get(ordinal) ?? 'text'
      const Clazz = getMessageRender(type)
      if (!Clazz) return null
      return (
        <div
          key={String(ordinal)}
          className={Kb.Styles.classNames(
            'hover-container',
            'WrapperMessage',
            'WrapperMessage-hoverBox',
            'WrapperMessage-decorated',
            'WrapperMessage-hoverColor',
            {highlighted: centeredOrdinal === ordinal || editingOrdinal === ordinal}
          )}
        >
          {previous ? <Separator trailingItem={ordinal} leadingItem={previous} /> : null}
          <Clazz ordinal={ordinal} />
        </div>
      )
    },
    [messageTypeMap, centeredOrdinal, editingOrdinal]
  )

  const items = React.useMemo(() => {
    const items: Array<React.ReactNode> = [<SpecialTopMessage key="specialTop" />]

    const numOrdinals = messageOrdinals.length
    let ordinals: Array<T.Chat.Ordinal> = []
    let previous: undefined | T.Chat.Ordinal
    let lastBucket: number | undefined
    let baseIndex = 0 // this is used to de-dupe the waypoint around the centered ordinal
    messageOrdinals.forEach((ordinal, idx) => {
      // Centered ordinal is where we want the view to be centered on when jumping around in the thread.
      const isCenteredOrdinal = ordinal === centeredOrdinal

      // We want to keep the mapping of ordinal to bucket fixed always
      const bucket = Math.floor(T.Chat.ordinalToNumber(ordinal) / ordinalsInAWaypoint)
      if (lastBucket === undefined) {
        lastBucket = bucket
      }
      const needNextWaypoint = bucket !== lastBucket
      const isLastItem = idx === numOrdinals - 1
      if (needNextWaypoint || isLastItem || isCenteredOrdinal) {
        if (isLastItem && !isCenteredOrdinal) {
          // we don't want to add the centered ordinal here, since it will go into its own waypoint
          ordinals.push(ordinal)
        }
        if (ordinals.length) {
          // don't allow buckets to be too big
          const chunks = chunk(ordinals, 10)
          chunks.forEach((toAdd, cidx) => {
            const key = `${lastBucket || ''}:${cidx + baseIndex}`
            items.push(
              <OrdinalWaypoint
                key={key}
                id={key}
                rowRenderer={rowRenderer}
                ordinals={toAdd}
                previous={previous}
                resizeObserve={resizeObserve}
                intersectionObserve={intersectionObserve}
              />
            )
            previous = toAdd.at(-1)
          })
          // we pass previous so the OrdinalWaypoint can render the top item correctly
          ordinals = []
          lastBucket = bucket
        }
      }
      // If this is the centered ordinal, it goes into its own waypoint so we can easily scroll to it
      if (isCenteredOrdinal) {
        items.push(
          <OrdinalWaypoint
            key={scrollOrdinalKey}
            id={scrollOrdinalKey}
            rowRenderer={rowRenderer}
            ordinals={[ordinal]}
            previous={previous}
            resizeObserve={resizeObserve}
            intersectionObserve={intersectionObserve}
          />
        )
        previous = ordinal
        lastBucket = 0
        baseIndex++ // push this up if we drop the centered ordinal waypoint
      } else {
        ordinals.push(ordinal)
      }
    })
    items.push(<SpecialBottomMessage key="specialBottom" />)
    return items
  }, [messageOrdinals, centeredOrdinal, rowRenderer, resizeObserve, intersectionObserve])

  return items
}

const ThreadWrapper = React.memo(function ThreadWrapper(p: Props) {
  const conversationIDKey = C.useChatContext(s => s.id)
  const {onFocusInput} = p
  const {requestScrollDownRef, requestScrollToBottomRef, requestScrollUpRef} = p
  const editingOrdinal = C.useChatContext(s => s.editing)
  const centeredOrdinal = C.useChatContext(s => s.messageCenterOrdinal)?.ordinal
  const containsLatestMessage = C.useChatContext(s => s.isCaughtUp())
  const messageTypeMap = C.useChatContext(s => s.messageTypeMap)
  const messageOrdinals = C.useChatContext(s => s.messageOrdinals) ?? []
  const copyToClipboard = C.useConfigState(s => s.dispatch.dynamic.copyToClipboard)
  const listRef = React.useRef<HTMLDivElement | null>(null)
  const {isLockedToBottom, scrollToBottom, setListRef, pointerWrapperRef} = useScrolling({
    centeredOrdinal,
    containsLatestMessage,
    listRef,
    messageOrdinals,
    requestScrollDownRef,
    requestScrollToBottomRef,
    requestScrollUpRef,
  })

  const jumpToRecent = Hooks.useJumpToRecent(scrollToBottom, messageOrdinals.length)
  const resizeObserve = useResizeObserver()
  const intersectionObserve = useIntersectionObserver()
  const unsubRef = React.useRef<(() => void) | undefined>()
  React.useEffect(() => {
    return () => {
      unsubRef.current?.()
    }
  }, [])

  const lastResizeHeightRef = React.useRef(0)
  const onListSizeChanged = React.useCallback(
    (contentRect: {height: number}) => {
      const {height} = contentRect
      if (height !== lastResizeHeightRef.current) {
        lastResizeHeightRef.current = height
        if (isLockedToBottom()) {
          scrollToBottom()
        }
      }
    },
    [isLockedToBottom, scrollToBottom]
  )
  const setListContents = React.useCallback(
    (listContents: HTMLDivElement | null) => {
      pointerWrapperRef.current = listContents
      unsubRef.current?.()
      if (listContents) {
        unsubRef.current = resizeObserve(listContents, onListSizeChanged)
      } else {
        unsubRef.current = undefined
      }
    },
    [pointerWrapperRef, resizeObserve, onListSizeChanged]
  )

  const onCopyCapture = React.useCallback(
    (e: React.BaseSyntheticEvent) => {
      // Copy text only, not HTML/styling.
      e.preventDefault()
      const sel = window.getSelection()
      sel && copyToClipboard(sel.toString())
    },
    [copyToClipboard]
  )

  const handleListClick = React.useCallback(
    (ev: React.MouseEvent) => {
      const target = ev.target
      // allow focusing other inner inputs such as the reacji picker filter
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
        return
      }

      const sel = window.getSelection()
      if (sel?.isCollapsed) {
        onFocusInput()
      }
    },
    [onFocusInput]
  )

  const items = useItems({
    centeredOrdinal,
    editingOrdinal,
    intersectionObserve,
    messageOrdinals,
    messageTypeMap,
    resizeObserve,
  })

  return (
    <ErrorBoundary>
      <div style={styles.container as any} onClick={handleListClick} onCopyCapture={onCopyCapture}>
        <div className="chat-scroller" key={conversationIDKey} style={styles.list as any} ref={setListRef}>
          <div style={styles.listContents} ref={setListContents}>
            {items}
          </div>
        </div>
        {jumpToRecent}
      </div>
    </ErrorBoundary>
  )
})

type OrdinalWaypointProps = {
  id: string
  rowRenderer: (ordinal: T.Chat.Ordinal, previous?: T.Chat.Ordinal) => React.ReactNode
  ordinals: Array<T.Chat.Ordinal>
  previous?: T.Chat.Ordinal
  resizeObserve: ReturnType<typeof useResizeObserver>
  intersectionObserve: ReturnType<typeof useIntersectionObserver>
}

const colorWaypoints = __DEV__ && (false as boolean)
const colors = new Array<string>()
if (colorWaypoints) {
  for (let i = 0; i < 10; ++i) {
    console.log('COLOR WAYPOINTS ON!!!!!!!!!!!!!!!!')
    colors.push(`rgb(${Math.random() * 255},${Math.random() * 255},${Math.random() * 255})`)
  }
}

const OrdinalWaypointInner = (p: OrdinalWaypointProps) => {
  const {ordinals, id, rowRenderer, previous, resizeObserve, intersectionObserve} = p
  const heightRef = React.useRef<number | undefined>()
  const widthRef = React.useRef<number | undefined>()
  const heightForOrdinalsRef = React.useRef<Array<T.Chat.Ordinal> | undefined>()
  const [isVisible, setVisible] = React.useState(true)
  const [, setForce] = React.useState(0)
  const customForceUpdate = React.useCallback(() => {
    setForce(f => f + 1)
  }, [])
  const onResize = React.useCallback(
    (p: {width: number; height: number}) => {
      const {width, height} = p
      if (height && width) {
        let changed = false
        // don't have a width at all or its unchanged
        if (!widthRef.current || widthRef.current === width) {
          if (heightRef.current !== height) {
            heightForOrdinalsRef.current = ordinals
            heightRef.current = height
            // don't redraw in this case
          }
        } else {
          // toss height if width changes
          heightRef.current = undefined
          changed = true
        }

        if (widthRef.current !== width) {
          if (widthRef.current !== undefined) {
            changed = true
          }
          widthRef.current = width
        }

        if (changed) {
          customForceUpdate()
        }
      }
    },
    [customForceUpdate, ordinals]
  )

  // we want to go invisible if we're outside after we've been measured, aka don't scroll up and measure and hide yourself
  // only hide after you've been scrolled past
  const ignoreFirstIntersectionRef = React.useRef(true)
  const onIntersection = React.useCallback((isIntersecting: boolean) => {
    if (ignoreFirstIntersectionRef.current) {
      ignoreFirstIntersectionRef.current = false
      return
    }
    setVisible(isIntersecting)
  }, [])

  // Cache rendered children if the ordinals are the same, else we'll thrash a lot as we scroll up and down
  const lastVisibleChildrenOrdinalsRef = React.useRef(new Array<T.Chat.Ordinal>())
  const lastVisibleChildrenRef = React.useRef<React.ReactElement | null>(null)

  if (ordinals !== heightForOrdinalsRef.current) {
    heightRef.current = undefined
  }

  const rounsubRef = React.useRef<(() => void) | undefined>()
  const iounsubRef = React.useRef<(() => void) | undefined>()
  React.useEffect(() => {
    return () => {
      rounsubRef.current?.()
      iounsubRef.current?.()
      rounsubRef.current = undefined
      iounsubRef.current = undefined
    }
  }, [])

  const waypointRef = React.useCallback(
    (w: HTMLDivElement | null) => {
      rounsubRef.current?.()
      iounsubRef.current?.()
      if (w) {
        rounsubRef.current = resizeObserve(w, onResize)
        iounsubRef.current = intersectionObserve(w, onIntersection)
      } else {
        rounsubRef.current = undefined
        iounsubRef.current = undefined
      }
    },
    [onResize, resizeObserve, onIntersection, intersectionObserve]
  )

  // Apply data-key to the dom node so we can search for editing messages
  const renderMessages = !heightRef.current || isVisible
  let content: React.ReactElement
  if (renderMessages) {
    if (ordinals === lastVisibleChildrenOrdinalsRef.current && lastVisibleChildrenRef.current) {
      // cache children to skip re-rendering
      content = lastVisibleChildrenRef.current
    } else {
      const messages = ordinals.map((o, idx) => {
        const p = idx ? ordinals[idx - 1] : previous
        return rowRenderer(o, p)
      })
      content = (
        <div key={id} data-key={id} ref={waypointRef}>
          {messages}
        </div>
      )
      lastVisibleChildrenOrdinalsRef.current = ordinals
      lastVisibleChildrenRef.current = content
    }
  } else {
    content = <div key={id} data-key={id} style={{height: heightRef.current}} ref={waypointRef} />
  }

  if (colorWaypoints) {
    let cidx = parseInt(id)
    if (isNaN(cidx)) cidx = 0
    cidx = cidx % colors.length
    return <div style={{backgroundColor: colors[cidx]}}>{content}</div>
  } else {
    return content
  }
}

const OrdinalWaypoint = React.memo<OrdinalWaypointProps>(
  OrdinalWaypointInner,

  (prevProps, nextProps) =>
    prevProps.rowRenderer === nextProps.rowRenderer &&
    prevProps.id === nextProps.id &&
    C.shallowEqual(prevProps.ordinals, nextProps.ordinals)
)

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      container: Kb.Styles.platformStyles({
        isElectron: {
          ...Kb.Styles.globalStyles.flexBoxColumn,
          // containment hints so we can scroll faster
          contain: 'strict',
          flex: 1,
          position: 'relative',
        },
      }),
      list: Kb.Styles.platformStyles({
        isElectron: {
          ...Kb.Styles.globalStyles.fillAbsolute,
          outline: 'none',
          overflowX: 'hidden',
          overflowY: 'auto',
          paddingBottom: globalMargins.small,
          // get our own layer so we can scroll faster
          willChange: 'transform',
        },
      }),
      listContents: {width: '100%'},
    }) as const
)

export default ThreadWrapper
