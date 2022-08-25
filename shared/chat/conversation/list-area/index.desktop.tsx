/* eslint-env browser */
import * as ConfigGen from '../../../actions/config-gen'
import * as Chat2Gen from '../../../actions/chat2-gen'
import * as React from 'react'
import * as Constants from '../../../constants/chat2'
import * as Styles from '../../../styles'
import * as Container from '../../../util/container'
import * as Types from '../../../constants/types/chat2'
import Message from '../messages'
import SpecialBottomMessage from '../messages/special-bottom-message'
import SpecialTopMessage from '../messages/special-top-message'
import shallowEqual from 'shallowequal'
import {ErrorBoundary} from '../../../common-adapters'
import type {Props} from '.'
import {Waypoint} from 'react-waypoint'
import chunk from 'lodash/chunk'
import {globalMargins} from '../../../styles/shared'
import {useMemo} from '../../../util/memoize'
import * as Hooks from './hooks'

// Infinite scrolling list.
// We group messages into a series of Waypoints. When the waypoint exits the screen we replace it with a single div instead
// We use react-measure to cache the heights
const scrollOrdinalKey = 'scroll-ordinal-key'

// We load the first thread automatically so in order to mark it read
// we send an action on the first mount once
let markedInitiallyLoaded = false

// we use resize observer to watch for size changes. we use one observer and attach nodes
const useResizeObserver = () => {
  const listenersRef = React.useRef(new Map<Element, (p: {height: number; width: number}) => void>())
  const onResizeObservedRef = React.useRef((_entries: Array<ResizeObserverEntry>) => {})
  React.useEffect(() => {
    onResizeObservedRef.current = (entries: Array<ResizeObserverEntry>) => {
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
    }
  }, [onResizeObservedRef])
  const resizeObserverRef = React.useRef(
    typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(entries => onResizeObservedRef.current(entries))
      : undefined
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
  p: Pick<
    Props,
    'conversationIDKey' | 'requestScrollUpRef' | 'requestScrollToBottomRef' | 'requestScrollDownRef'
  > & {
    containsLatestMessage: boolean
    messageOrdinals: Array<Types.Ordinal>
    listRef: React.MutableRefObject<HTMLDivElement | null>
    centeredOrdinal: Types.Ordinal | undefined
  }
) => {
  const {conversationIDKey, requestScrollUpRef, requestScrollToBottomRef, requestScrollDownRef} = p
  const {listRef, containsLatestMessage, messageOrdinals, centeredOrdinal} = p
  const dispatch = Container.useDispatch()
  const editingOrdinal = Container.useSelector(state => state.chat2.editingMap.get(conversationIDKey))
  const loadNewerMessages = Container.useThrottledCallback(
    React.useCallback(() => {
      dispatch(Chat2Gen.createLoadNewerMessagesDueToScroll({conversationIDKey}))
    }, [dispatch, conversationIDKey]),
    200
  )

  const lastLoadOrdinal = React.useRef<Types.Ordinal>(-1)
  const oldestOrdinal = messageOrdinals[0] ?? -1
  const loadOlderMessages = //Container.useThrottledCallback(
    React.useCallback(() => {
      // already loaded and nothing has changed
      if (lastLoadOrdinal.current === oldestOrdinal) {
        return
      }
      lastLoadOrdinal.current = oldestOrdinal
      dispatch(Chat2Gen.createLoadOlderMessagesDueToScroll({conversationIDKey}))
    }, [dispatch, conversationIDKey, oldestOrdinal]) //,
  //   200
  // )
  const {markInitiallyLoadedThreadAsRead} = Hooks.useActions({conversationIDKey})
  // pixels away from top/bottom to load/be locked
  const listEdgeSlopBottom = 10
  const listEdgeSlopTop = 1000
  const isMountedRef = Hooks.useIsMounted()
  const isScrollingRef = React.useRef(false)
  const ignoreOnScrollRef = React.useRef(false)
  const lockedToBottomRef = React.useRef(true)
  // so we can turn pointer events on / off
  const pointerWrapperRef = React.useRef<HTMLDivElement | null>(null)

  const isLockedToBottom = React.useCallback(
    () =>
      // if we don't have the latest message, we can't be locked to the bottom
      lockedToBottomRef.current && containsLatestMessage,
    [lockedToBottomRef, containsLatestMessage]
  )

  const adjustScrollAndIgnoreOnScroll = React.useCallback(
    (fn: () => void) => {
      ignoreOnScrollRef.current = true
      fn()
    },
    [ignoreOnScrollRef]
  )

  const checkForLoadMoreThrottled = //Container.useThrottledCallback(
    React.useCallback(() => {
      console.log('aaa checkForLoadMoreThrottled', Math.random())
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
  //   1000
  // )

  const scrollToBottom = React.useCallback(() => {
    lockedToBottomRef.current = true
    const actuallyScroll = () => {
      if (!isMountedRef.current) return
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
  }, [listRef, adjustScrollAndIgnoreOnScroll, isMountedRef])

  const scrollToCentered = React.useCallback(() => {
    // grab the waypoint we made for the centered ordinal and scroll to it
    const scrollWaypoint = listRef.current?.querySelectorAll(`[data-key=${scrollOrdinalKey}]`)
    scrollWaypoint?.[0].scrollIntoView({block: 'center', inline: 'nearest'})
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
  const onAfterScroll = Container.useDebouncedCallback(
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
  const onScrollThrottled = Container.useThrottledCallback(
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
    // checkForLoadMoreThrottled.cancel()
  }, [onAfterScroll, onScrollThrottled /*, checkForLoadMoreThrottled*/])

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

  React.useEffect(() => {
    scrollBottomOffsetRef.current = undefined
  }, [conversationIDKey])

  const prevFirstOrdinal = Container.usePrevious(messageOrdinals[0])
  const prevOrdinalLength = Container.usePrevious(messageOrdinals.length)

  // called after dom update, to apply value
  React.useLayoutEffect(() => {
    // didn't scroll up
    if (messageOrdinals.length === prevOrdinalLength || messageOrdinals[0] === prevFirstOrdinal) return
    const {current} = listRef
    if (
      current &&
      !isLockedToBottom() &&
      isMountedRef.current &&
      scrollBottomOffsetRef.current !== undefined
    ) {
      current.scrollTop = current.scrollHeight - scrollBottomOffsetRef.current
    }
    // we want this to fire when the ordinals change
    // eslint-disable-next-line
  }, [messageOrdinals])

  // Check to see if our centered ordinal has changed, and if so, scroll to it
  React.useEffect(() => {
    if (centeredOrdinal) {
      lockedToBottomRef.current = false
      scrollToCentered()
    }
  }, [centeredOrdinal, scrollToCentered])

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
    const toFind = Math.floor(Types.ordinalToNumber(editingOrdinal) / 10)
    const found = (Array.from(waypoints) as Array<HTMLElement>).reverse().find(w => {
      const key = w.dataset.key
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
  conversationIDKey: Types.ConversationIDKey
  messageOrdinals: Array<Types.Ordinal>
  centeredOrdinal: Types.Ordinal | undefined
  resizeObserve: ReturnType<typeof useResizeObserver>
}) => {
  const {conversationIDKey, messageOrdinals, centeredOrdinal, resizeObserve} = p
  const ordinalsInAWaypoint = 10
  const rowRenderer = React.useCallback(
    (ordinal: Types.Ordinal, previous?: Types.Ordinal) => (
      <Message
        key={String(ordinal)}
        ordinal={ordinal}
        previous={previous}
        conversationIDKey={conversationIDKey}
      />
    ),
    [conversationIDKey]
  )

  const items = useMemo(() => {
    const items: Array<React.ReactNode> = [
      <SpecialTopMessage key="specialTop" conversationIDKey={conversationIDKey} />,
    ]

    const numOrdinals = messageOrdinals.length
    let ordinals: Array<Types.Ordinal> = []
    let previous: undefined | Types.Ordinal
    let lastBucket: number | undefined
    let baseIndex = 0 // this is used to de-dupe the waypoint around the centered ordinal
    messageOrdinals.forEach((ordinal, idx) => {
      // Centered ordinal is where we want the view to be centered on when jumping around in the thread.
      const isCenteredOrdinal = ordinal === centeredOrdinal

      // We want to keep the mapping of ordinal to bucket fixed always
      const bucket = Math.floor(Types.ordinalToNumber(ordinal) / ordinalsInAWaypoint)
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
              />
            )
            previous = toAdd[toAdd.length - 1]
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
          />
        )
        previous = ordinal
        lastBucket = 0
        baseIndex++ // push this up if we drop the centered ordinal waypoint
      } else {
        ordinals.push(ordinal)
      }
    })
    items.push(<SpecialBottomMessage key="specialBottom" conversationIDKey={conversationIDKey} />)
    return items
  }, [conversationIDKey, messageOrdinals, centeredOrdinal, rowRenderer, resizeObserve])

  return items
}

const ThreadWrapperInner = (p: Props) => {
  const {conversationIDKey, onFocusInput} = p
  const {requestScrollDownRef, requestScrollToBottomRef, requestScrollUpRef} = p
  const messageOrdinals = Container.useSelector(state =>
    Constants.getMessageOrdinals(state, conversationIDKey)
  )
  const centeredOrdinal = Container.useSelector(
    state => Constants.getMessageCenterOrdinal(state, conversationIDKey)?.ordinal
  )
  const containsLatestMessage = Container.useSelector(
    state => state.chat2.containsLatestMessageMap.get(conversationIDKey) || false
  )
  const dispatch = Container.useDispatch()
  const copyToClipboard = React.useCallback(
    (text: string) => {
      dispatch(ConfigGen.createCopyToClipboard({text}))
    },
    [dispatch]
  )
  const listRef = React.useRef<HTMLDivElement | null>(null)
  const {isLockedToBottom, scrollToBottom, setListRef, pointerWrapperRef} = useScrolling({
    centeredOrdinal,
    containsLatestMessage,
    conversationIDKey,
    listRef,
    messageOrdinals,
    requestScrollDownRef,
    requestScrollToBottomRef,
    requestScrollUpRef,
  })

  const jumpToRecent = Hooks.useJumpToRecent(conversationIDKey, scrollToBottom, messageOrdinals.length)
  const resizeObserve = useResizeObserver()
  const unsubRef = React.useRef<(() => void) | undefined>()
  React.useEffect(() => {
    unsubRef.current?.()
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
    conversationIDKey,
    messageOrdinals,
    resizeObserve,
  })

  return (
    <ErrorBoundary>
      <div style={styles.container as any} onClick={handleListClick} onCopyCapture={onCopyCapture}>
        <div key={conversationIDKey} style={styles.list as any} ref={setListRef}>
          <div style={styles.listContents} ref={setListContents}>
            {items}
          </div>
        </div>
        {jumpToRecent}
      </div>
    </ErrorBoundary>
  )
}

const ThreadWrapper = React.memo(ThreadWrapperInner)

type OrdinalWaypointProps = {
  id: string
  rowRenderer: (ordinal: Types.Ordinal, previous?: Types.Ordinal) => React.ReactNode
  ordinals: Array<Types.Ordinal>
  previous?: Types.Ordinal
  resizeObserve: ReturnType<typeof useResizeObserver>
}

const colorWaypoints = __DEV__ && false
const colors = new Array<string>()
if (colorWaypoints) {
  for (let i = 0; i < 10; ++i) {
    console.log('COLOR WAYPOINTS ON!!!!!!!!!!!!!!!!')
    colors.push(`rgb(${Math.random() * 255},${Math.random() * 255},${Math.random() * 255})`)
  }
}

const OrdinalWaypointInner = (p: OrdinalWaypointProps) => {
  const {ordinals, id, rowRenderer, previous, resizeObserve} = p
  const heightRef = React.useRef<number | undefined>()
  const widthRef = React.useRef<number | undefined>()
  const heightForOrdinalsRef = React.useRef<Array<Types.Ordinal> | undefined>()
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
  const handlePositionChange = Container.useThrottledCallback(
    React.useCallback(
      (p: Waypoint.CallbackArgs) => {
        // lets ignore when this happens, this seems like a large source of jiggliness
        if (isVisible && !p.event) {
          return
        }
        const {currentPosition} = p
        if (!currentPosition) {
          return
        }
        const isInside = currentPosition === 'inside'
        if (isInside !== isVisible) {
          setVisible(isInside)
        }
      },
      [isVisible]
    ),
    200
  )

  // Cache rendered children if the ordinals are the same, else we'll thrash a lot as we scroll up and down
  const lastVisibleChildrenOrdinalsRef = React.useRef(new Array<Types.Ordinal>())
  const lastVisibleChildrenRef = React.useRef<React.ReactNode>(null)

  React.useEffect(() => {
    return () => {
      // onResize.cancel()
      handlePositionChange.cancel()
    }
  }, [handlePositionChange /*, onResize*/])

  if (ordinals !== heightForOrdinalsRef.current) {
    heightRef.current = undefined
  }

  const unsubRef = React.useRef<(() => void) | undefined>()
  React.useEffect(() => {
    unsubRef.current?.()
  }, [])

  const waypointRef = React.useCallback(
    (w: HTMLDivElement | null) => {
      unsubRef.current?.()
      if (w) {
        unsubRef.current = resizeObserve(w, onResize)
      } else {
        unsubRef.current = undefined
      }
    },
    [onResize, resizeObserve]
  )

  // Apply data-key to the dom node so we can search for editing messages
  const renderMessages = !heightRef.current || isVisible
  let content: React.ReactNode
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
        <div data-key={id} ref={heightRef.current ? undefined : waypointRef}>
          {messages}
        </div>
      )
      lastVisibleChildrenOrdinalsRef.current = ordinals
      lastVisibleChildrenRef.current = content
    }
  } else {
    content = <div data-key={id} style={{height: heightRef.current}} />
  }

  if (colorWaypoints) {
    let cidx = parseInt(id)
    if (isNaN(cidx)) cidx = 0
    cidx = cidx % colors.length
    return (
      <div style={{backgroundColor: colors[cidx]}}>
        <Waypoint onPositionChange={handlePositionChange}>{content}</Waypoint>
      </div>
    )
  } else {
    return <Waypoint onPositionChange={handlePositionChange}>{content}</Waypoint>
  }
}

const OrdinalWaypoint = React.memo<OrdinalWaypointProps>(
  OrdinalWaypointInner,

  (prevProps, nextProps) =>
    prevProps.rowRenderer === nextProps.rowRenderer &&
    prevProps.id === nextProps.id &&
    shallowEqual(prevProps.ordinals, nextProps.ordinals)
)

const styles = Styles.styleSheetCreate(
  () =>
    ({
      container: Styles.platformStyles({
        isElectron: {
          ...Styles.globalStyles.flexBoxColumn,
          // containment hints so we can scroll faster
          contain: 'strict',
          flex: 1,
          position: 'relative',
        },
      }),
      list: Styles.platformStyles({
        isElectron: {
          ...Styles.globalStyles.fillAbsolute,
          outline: 'none',
          overflowX: 'hidden',
          overflowY: 'auto',
          paddingBottom: globalMargins.small,
          // get our own layer so we can scroll faster
          willChange: 'transform',
        },
      }),
      listContents: {width: '100%'},
    } as const)
)

export default ThreadWrapper
