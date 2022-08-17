/* eslint-env browser */
import * as ConfigGen from '../../../actions/config-gen'
import * as Chat2Gen from '../../../actions/chat2-gen'
import * as React from 'react'
import * as Constants from '../../../constants/chat2'
import * as Styles from '../../../styles'
import * as Container from '../../../util/container'
import * as Types from '../../../constants/types/chat2'
import JumpToRecent from './jump-to-recent'
import Measure from 'react-measure'
import Message from '../messages'
import SpecialBottomMessage from '../messages/special-bottom-message'
import SpecialTopMessage from '../messages/special-top-message'
import shallowEqual from 'shallowequal'
import {ErrorBoundary} from '../../../common-adapters'
import type {Props} from '.'
import {Waypoint} from 'react-waypoint'
import debounce from 'lodash/debounce'
import chunk from 'lodash/chunk'
import {globalMargins} from '../../../styles/shared'
import {useMemo} from '../../../util/memoize'
import * as Hooks from './hooks'

// Infinite scrolling list.
// We group messages into a series of Waypoints. When the wayoint exits the screen we replace it with a single div instead
// We use react-measure to cache the heights

const scrollOrdinalKey = 'scroll-ordinal-key'

// We load the first thread automatically so in order to mark it read
// we send an action on the first mount once
let markedInitiallyLoaded = false

const useResizeObserver = (isLockedToBottom: () => boolean, scrollToBottom: () => void) => {
  const listContentsRef = React.useRef<HTMLDivElement | null>(null)
  const lastResizeHeightRef = React.useRef(0)
  const onResizeObservedRef = React.useRef((_entries: Array<ResizeObserverEntry>) => {})
  React.useEffect(() => {
    onResizeObservedRef.current = (entries: Array<ResizeObserverEntry>) => {
      const entry = entries[0]
      const {contentRect} = entry
      const {height} = contentRect
      if (height !== lastResizeHeightRef.current) {
        lastResizeHeightRef.current = height
        if (isLockedToBottom()) {
          scrollToBottom()
        }
      }
    }
  }, [onResizeObservedRef, lastResizeHeightRef, isLockedToBottom, scrollToBottom])

  const resizeObserverRef = React.useRef(
    typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(entries => onResizeObservedRef.current(entries))
      : undefined
  )

  React.useEffect(() => {
    let ror = resizeObserverRef.current
    return () => {
      ror?.disconnect()
      resizeObserverRef.current = undefined
      ror = undefined
    }
  }, [])

  const setListContents = React.useCallback((listContents: HTMLDivElement | null) => {
    if (listContentsRef.current && listContents !== listContentsRef.current) {
      resizeObserverRef.current?.unobserve(listContentsRef.current)
    }
    if (listContents) {
      resizeObserverRef.current?.observe(listContents)
    }
    listContentsRef.current = listContents
  }, [])

  return setListContents
}

const useScrolling = (
  p: Pick<
    Props,
    'conversationIDKey' | 'scrollListDownCounter' | 'scrollListToBottomCounter' | 'scrollListUpCounter'
  > & {
    containsLatestMessage: boolean
    messageOrdinals: Array<Types.Ordinal>
    listRef: React.MutableRefObject<HTMLDivElement | null>
    centeredOrdinal: Types.Ordinal | undefined
  }
) => {
  const {conversationIDKey, scrollListDownCounter, scrollListToBottomCounter, scrollListUpCounter} = p
  const {listRef, containsLatestMessage, messageOrdinals, centeredOrdinal} = p
  const dispatch = Container.useDispatch()
  const editingOrdinal = Container.useSelector(state => state.chat2.editingMap.get(conversationIDKey))
  const loadNewerMessages = Container.useThrottledCallback(
    React.useCallback(() => {
      dispatch(Chat2Gen.createLoadNewerMessagesDueToScroll({conversationIDKey}))
    }, [dispatch, conversationIDKey]),
    200
  )
  const loadOlderMessages = Container.useThrottledCallback(
    React.useCallback(() => {
      dispatch(Chat2Gen.createLoadOlderMessagesDueToScroll({conversationIDKey}))
    }, [dispatch, conversationIDKey]),
    200
  )
  const {markInitiallyLoadedThreadAsRead} = Hooks.useActions({conversationIDKey})
  const onJumpToRecent = React.useCallback(() => {
    dispatch(Chat2Gen.createJumpToRecent({conversationIDKey}))
  }, [dispatch, conversationIDKey])
  // pixels away from top/bottom to load/be locked
  const listEdgeSlop = 10
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

  const checkForLoadMoreThrottled = Container.useThrottledCallback(
    React.useCallback(() => {
      // are we at the top?
      const list = listRef.current
      if (list) {
        if (list.scrollTop < listEdgeSlop) {
          loadOlderMessages()
        } else if (
          !containsLatestMessage &&
          !isLockedToBottom() &&
          list.scrollTop > list.scrollHeight - list.clientHeight - listEdgeSlop
        ) {
          loadNewerMessages()
        }
      }
    }, [listRef, containsLatestMessage, loadNewerMessages, loadOlderMessages, isLockedToBottom]),
    100,
    // trailing = true cause you can be on top but keep scrolling which can keep the throttle going and ultimately miss out
    // on scrollTop being zero and not trying to load more
    {leading: true, trailing: true}
  )

  const scrollToBottom = React.useCallback(() => {
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

  const jumpToRecent = React.useCallback(() => {
    lockedToBottomRef.current = true
    scrollToBottom()
    onJumpToRecent()
  }, [lockedToBottomRef, scrollToBottom, onJumpToRecent])

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
        lockedToBottomRef.current = list.scrollHeight - list.clientHeight - list.scrollTop < listEdgeSlop
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
    if (ignoreOnScrollRef.current) {
      ignoreOnScrollRef.current = false
      return
    }
    // quickly set to false to assume we're not locked. if we are the throttled one will set it to true
    lockedToBottomRef.current = false
    checkForLoadMoreThrottled()
    onScrollThrottled()
  }, [checkForLoadMoreThrottled, onScrollThrottled])

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
    checkForLoadMoreThrottled.cancel()
  }, [onAfterScroll, onScrollThrottled, checkForLoadMoreThrottled])

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
  const scrollOnPrependRef = React.useRef<{scrollHeight: number | undefined; scrollTop: number | undefined}>({
    scrollHeight: undefined,
    scrollTop: undefined,
  })

  const prevFirstOrdinal = Container.usePrevious(messageOrdinals[0])
  const prevOrdinalLength = Container.usePrevious(messageOrdinals.length)

  // called before render, to stash value. Subtle behavior of react's useMemo, don't use Container.useMemo
  React.useMemo(() => {
    // didn't scroll up
    if (messageOrdinals.length === prevOrdinalLength || messageOrdinals[0] === prevFirstOrdinal) return
    scrollOnPrependRef.current.scrollHeight = listRef.current?.scrollHeight
    scrollOnPrependRef.current.scrollTop = listRef.current?.scrollTop
    // we want this to fire when the ordinals change
    // eslint-disable-next-line
  }, [messageOrdinals])
  // called after dom update, to apply value
  React.useLayoutEffect(() => {
    // didn't scroll up
    if (messageOrdinals.length === prevOrdinalLength || messageOrdinals[0] === prevFirstOrdinal) return
    if (scrollOnPrependRef.current.scrollHeight !== undefined && listRef.current && !isLockedToBottom()) {
      requestAnimationFrame(() => {
        const {current} = listRef
        if (
          current &&
          isMountedRef.current &&
          scrollOnPrependRef.current.scrollTop !== undefined &&
          scrollOnPrependRef.current.scrollHeight !== undefined
        ) {
          const fromBottom = scrollOnPrependRef.current.scrollHeight - scrollOnPrependRef.current.scrollTop
          current.scrollTop = current.scrollHeight - fromBottom
        }
      })
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

  // scroll requested
  Container.useDepChangeEffect(() => {
    scrollDown()
  }, [scrollListDownCounter, scrollDown])
  Container.useDepChangeEffect(() => {
    scrollUp()
  }, [scrollListUpCounter, scrollUp])

  // someone requested we scroll to bottom and lock (ignore if we don't have latest)
  Container.useDepChangeEffect(() => {
    lockedToBottomRef.current = true
    scrollToBottom()
  }, [scrollListToBottomCounter, scrollToBottom])

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

  return {isLockedToBottom, jumpToRecent, lockedToBottomRef, scrollToBottom, setListRef}
}

const useItems = (p: {
  conversationIDKey: Types.ConversationIDKey
  messageOrdinals: Array<Types.Ordinal>
  centeredOrdinal: Types.Ordinal | undefined
}) => {
  const {conversationIDKey, messageOrdinals, centeredOrdinal} = p
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
  }, [conversationIDKey, messageOrdinals, centeredOrdinal, rowRenderer])

  return items
}

const ThreadWrapper = (p: Props) => {
  const {conversationIDKey, onFocusInput} = p
  const {scrollListDownCounter, scrollListToBottomCounter, scrollListUpCounter} = p
  const messageOrdinalsSet = Container.useSelector(state =>
    Constants.getMessageOrdinals(state, conversationIDKey)
  )
  const messageOrdinals = useMemo(() => [...messageOrdinalsSet], [messageOrdinalsSet])
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
  const {isLockedToBottom, jumpToRecent, scrollToBottom, setListRef} = useScrolling({
    centeredOrdinal,
    containsLatestMessage,
    conversationIDKey,
    listRef,
    messageOrdinals,
    scrollListDownCounter,
    scrollListToBottomCounter,
    scrollListUpCounter,
  })
  const setListContents = useResizeObserver(isLockedToBottom, scrollToBottom)

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
  })

  return (
    <ErrorBoundary>
      <div style={styles.container as any} onClick={handleListClick} onCopyCapture={onCopyCapture}>
        <style>{realCSS}</style>
        <div key={conversationIDKey} style={styles.list as any} ref={setListRef}>
          <div style={styles.listContents} ref={setListContents}>
            {items}
          </div>
        </div>
        {!containsLatestMessage && messageOrdinals.length > 0 && (
          <JumpToRecent onClick={jumpToRecent} style={styles.jumpToRecent} />
        )}
      </div>
    </ErrorBoundary>
  )
}

type OrdinalWaypointProps = {
  id: string
  rowRenderer: (ordinal: Types.Ordinal, previous?: Types.Ordinal, measure?: () => void) => React.ReactNode
  ordinals: Array<Types.Ordinal>
  previous?: Types.Ordinal
}

type OrdinalWaypointState = {
  force: number
}

class OrdinalWaypoint extends React.Component<OrdinalWaypointProps, OrdinalWaypointState> {
  state = {
    force: 0,
  }
  // not state so we can really control the re-rendering
  private height?: number
  private heightForOrdinals: Array<Types.Ordinal> = []
  private isVisible = true
  private width?: number
  private animID?: number

  componentWillUnmount() {
    this.onResize.cancel()
    this.measure.cancel()
    this.cancelAnim()
  }

  private cancelAnim = () => {
    if (this.animID) {
      window.cancelAnimationFrame(this.animID)
      this.animID = 0
    }
  }

  // We ran into an issue where this was being called tremendously fast with inside/below. To stop that behavior
  // we defer settings things invisible for a little bit, which seems enough to fix it
  private handlePositionChange = (p: Waypoint.CallbackArgs) => {
    // lets ignore when this happens, this seems like a large source of jiggliness
    if (this.isVisible && !p.event) {
      return
    }
    const {currentPosition} = p
    if (currentPosition) {
      const isInside = currentPosition === 'inside'
      this.cancelAnim()
      if (isInside) {
        if (!this.isVisible) {
          this.isVisible = true
          this.customForceUpdate()
        }
      } else {
        this.animID = window.requestAnimationFrame(() => {
          this.animID = 0
          if (this.isVisible) {
            this.isVisible = false
            this.customForceUpdate()
          }
        })
      }
    }
  }

  private customForceUpdate = () => {
    // We really want to control when this re-renders. We measure but just need this for bookkeeping and don't want to pay for the second render etc
    // eslint-disable-next-line react/no-access-state-in-setstate
    this.setState({force: this.state.force + 1})
  }

  private onResize = debounce(({bounds}) => {
    const height = Math.ceil(bounds.height)
    const width = Math.ceil(bounds.width)

    if (height && width) {
      let changed = false
      // don't have a width at all or its unchanged
      if (!this.width || this.width === width) {
        if (this.height !== height) {
          this.heightForOrdinals = this.props.ordinals
          this.height = height
          // don't redraw in this case
        }
      } else {
        // toss height if width changes
        this.height = undefined
        changed = true
      }

      if (this.width !== width) {
        if (this.width !== undefined) {
          changed = true
        }
        this.width = width
      }

      if (changed) {
        this.customForceUpdate()
      }
    }
  }, 100)

  private measure = debounce(() => {
    if (this.height !== undefined) {
      this.height = undefined
      // eslint-disable-next-line react/no-access-state-in-setstate
      this.setState({force: this.state.force + 1})
    }
  }, 100)

  shouldComponentUpdate(nextProps: OrdinalWaypointProps, nextState: OrdinalWaypointState) {
    return !shallowEqual(this.state, nextState) || !shallowEqual(this.props.ordinals, nextProps.ordinals)
  }

  // Cache rendered children if the ordinals are the same, else we'll thrash a lot as we scroll up and down
  private lastVisibleChildrenOrdinals: Array<Types.Ordinal> = []
  private lastVisibleChildren: React.ReactNode = null
  render() {
    if (!shallowEqual(this.props.ordinals, this.heightForOrdinals)) {
      this.height = undefined
    }

    // Apply data-key to the dom node so we can search for editing messages
    const renderMessages = !this.height || this.isVisible
    let content: React.ReactNode
    if (renderMessages) {
      if (this.props.ordinals === this.lastVisibleChildrenOrdinals && this.lastVisibleChildren) {
        // cache children to skip re-rendering
        content = this.lastVisibleChildren
      } else {
        const messages = this.props.ordinals.map((o, idx) => {
          const previous = idx ? this.props.ordinals[idx - 1] : this.props.previous
          return this.props.rowRenderer(o, previous, this.measure)
        })
        content = (
          <Measure bounds={true} onResize={this.onResize}>
            {({measureRef}) => (
              <div data-key={this.props.id} ref={measureRef}>
                {messages}
              </div>
            )}
          </Measure>
        )
        this.lastVisibleChildrenOrdinals = this.props.ordinals
        this.lastVisibleChildren = content
      }
    } else {
      content = <div data-key={this.props.id} style={{height: this.height}} />
    }
    return (
      <Waypoint key={this.props.id} onPositionChange={this.handlePositionChange}>
        {content}
      </Waypoint>
    )
  }
}

// We need to use both visibility and opacity css properties for the
// action button hide/show on hover.
// We use opacity because it shows/hides the button immediately on
// hover, while visibility has slight lag.
// We use visibility so that the action button content isn't copied
// during copy/paste actions since user-select isn't working in
// Chrome.
const realCSS = `
.message {
  contain: content;
}
`

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
      jumpToRecent: {
        bottom: 0,
        position: 'absolute',
      },
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
