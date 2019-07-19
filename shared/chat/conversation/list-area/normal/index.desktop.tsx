/* eslint-env browser */
//
// Infinite scrolling list.
// We group messages into a series of Waypoints. When the wayoint exits the screen we replace it with a single div instead
// We use react-measure to cache the heights

import * as React from 'react'
import * as Types from '../../../../constants/types/chat2'
import Measure from 'react-measure'
import {Waypoint} from 'react-waypoint'
import Message from '../../messages'
import SpecialTopMessage from '../../messages/special-top-message'
import SpecialBottomMessage from '../../messages/special-bottom-message'
import {ErrorBoundary} from '../../../../common-adapters'
import {debounce, throttle, chunk} from 'lodash-es'
import {globalStyles} from '../../../../styles'
import {Props} from './index.types'
import shallowEqual from 'shallowequal'
import {globalMargins} from '../../../../styles/shared'
import logger from '../../../../logger'
import {memoize} from '../../../../util/memoize'
import JumpToRecent from './jump-to-recent'
import ThreadSearch from '../../search/container'

// hot reload isn't supported with debouncing currently so just ignore hot here
if (module.hot) {
  module.hot.decline()
}

const ordinalsInAWaypoint = 10
// pixels away from top/bottom to load/be locked
const listEdgeSlop = 10

const scrollOrdinalKey = 'scroll-ordinal-key'

type State = {
  lockedToBottom: boolean
}

type Snapshot = number | null

const debug = __STORYBOOK__

class Thread extends React.PureComponent<Props, State> {
  state = {lockedToBottom: true}
  _listRef = React.createRef<HTMLDivElement>()
  // so we can turn pointer events on / off
  _pointerWrapperRef = React.createRef<HTMLDivElement>()
  // Not a state so we don't rerender, just mutate the dom
  _isScrolling = false

  // When we're triggering scrolling we don't want our event
  // subscribers to fire so we increment this value.
  //
  // NOTE: Since scroll events don't correspond 1:1 to events that
  // trigger scrolling, this has a high chance of getting 'stuck'
  // above 0, e.g. when resizing a window. Skipping a few user-driven
  // scroll events is harmless, but we want to clear these out when
  // simulating user-driven scroll events, e.g. page up/page down.
  _ignoreScrollRefCount = 0

  // Set to ignore the the next scroll event
  _ignoreScrollOnetime = false

  // last height we saw from resize
  _scrollHeight: number = 0

  _logIgnoreScroll = debug
    ? (name, fn) => {
        const oldIgnore = this._ignoreScrollRefCount
        const oldCenter = this._ignoreScrollOnetime
        fn()
        logger.debug(
          'SCROLL',
          name,
          'ignoreScroll',
          oldIgnore,
          '->',
          this._ignoreScrollRefCount,
          'ignoreCenterScroll',
          oldCenter,
          '->',
          this._ignoreScrollOnetime
        )
      }
    : (_, fn) => fn()

  _logScrollTop = debug
    ? (list, name, fn) => {
        const oldScrollTop = list.scrollTop
        fn()
        logger.debug('SCROLL', name, 'scrollTop', oldScrollTop, '->', list.scrollTop)
      }
    : (_, __, fn) => fn()

  _logAll = debug
    ? (list, name, fn) => {
        const oldIgnore = this._ignoreScrollRefCount
        const oldScrollTop = list.scrollTop
        fn()
        logger.debug(
          'SCROLL',
          name,
          'ignoreScroll',
          oldIgnore,
          '->',
          this._ignoreScrollRefCount,
          'scrollTop',
          oldScrollTop,
          '->',
          list.scrollTop
        )
      }
    : (_, __, fn) => fn()

  _scrollToCentered = () => {
    const list = this._listRef.current
    if (list) {
      this._logAll(list, `_scrollToCentered()`, () => {
        // grab the waypoint we made for the centered ordinal and scroll to it
        const scrollWaypoint = list.querySelectorAll(`[data-key=${scrollOrdinalKey}]`)
        if (scrollWaypoint.length > 0) {
          this._ignoreScrollOnetime = true
          scrollWaypoint[0].scrollIntoView({block: 'center', inline: 'nearest'})
        }
      })
    }
  }

  _isLockedToBottom = () => {
    // if we don't have the latest message, we can't be locked to the bottom
    return this.state.lockedToBottom && this.props.containsLatestMessage
  }

  _scrollToBottom = reason => {
    const list = this._listRef.current
    if (list) {
      this._logAll(list, `_scrollToBottom(${reason})`, () => {
        // ignore callbacks due to this change
        this._ignoreScrollRefCount++
        list.scrollTop = list.scrollHeight - list.clientHeight
      })
    }
  }

  _scrollDown = () => {
    const list = this._listRef.current
    if (list) {
      this._logAll(list, '_scrollDown', () => {
        // User-driven scroll event, so clear ignore count.
        this._ignoreScrollRefCount = 0
        list.scrollTop += list.clientHeight
      })
    }
  }

  _scrollUp = () => {
    const list = this._listRef.current
    if (list) {
      this._logAll(list, '_scrollUp', () => {
        // User-driven scroll event, so clear ignore count.
        this._ignoreScrollRefCount = 0
        list.scrollTop -= list.clientHeight
      })
    }
  }

  _jumpToRecent = () => {
    this._ignoreScrollOnetime = true
    this.setState(p => (p.lockedToBottom ? null : {lockedToBottom: true}))
    this._scrollToBottom('jump to recent')
    this.props.onJumpToRecent()
  }

  componentDidMount() {
    if (this._isLockedToBottom()) {
      setImmediate(() => this._scrollToBottom('componentDidMount'))
    }
  }

  getSnapshotBeforeUpdate(prevProps: Props) {
    // prepending, lets keep track of the old scrollHeight
    if (
      this.props.conversationIDKey === prevProps.conversationIDKey &&
      this.props.messageOrdinals.first() !== prevProps.messageOrdinals.first() &&
      prevProps.messageOrdinals.first()
    ) {
      return this._listRef.current ? this._listRef.current.scrollHeight : null
    }
    return null
  }

  componentDidUpdate(prevProps: Props, _: State, snapshot: Snapshot) {
    if (this.props === prevProps) {
      // don't do any of the below if just state changes
      return
    }

    // conversation changed
    if (this.props.conversationIDKey !== prevProps.conversationIDKey) {
      this._cleanupDebounced()
      this._scrollHeight = 0
      this.setState(p => (p.lockedToBottom ? null : {lockedToBottom: true}))
      this._scrollToBottom('componentDidUpdate-change-convo')
      return
    }

    // someone requested we scroll down
    if (this.props.scrollListDownCounter !== prevProps.scrollListDownCounter) {
      this._scrollDown()
      return
    }

    // someone requested we scroll up
    if (this.props.scrollListUpCounter !== prevProps.scrollListUpCounter) {
      this._scrollUp()
      return
    }

    // someone requested we scroll to bottom and lock (ignore if we don't have latest)
    if (
      this.props.scrollListToBottomCounter !== prevProps.scrollListToBottomCounter &&
      this.props.containsLatestMessage
    ) {
      this.setState(p => (p.lockedToBottom ? null : {lockedToBottom: true}))
      this._scrollToBottom('componentDidUpdate-requested')
      return
    }

    // Adjust scrolling if locked to the bottom
    const list = this._listRef.current
    // if locked to the bottom, and we have the most recent message, then scroll to the bottom
    if (this._isLockedToBottom() && this.props.conversationIDKey === prevProps.conversationIDKey) {
      // maintain scroll to bottom?
      this._scrollToBottom('componentDidUpdate-maintain-scroll')
    }

    // Check if we just added new messages from the future. In this case, we don't want to adjust scroll
    // position at all, so just bail out if we detect this case.
    if (
      this.props.messageOrdinals.size !== prevProps.messageOrdinals.size &&
      this.props.messageOrdinals.first() === prevProps.messageOrdinals.first()
    ) {
      // do nothing do scroll position if this is true
      this._scrollHeight = 0 // setting this causes us to skip next resize
      return
    }

    // Check to see if our centered ordinal has changed, and if so, scroll to it
    if (!!this.props.centeredOrdinal && this.props.centeredOrdinal !== prevProps.centeredOrdinal) {
      const lockedToBottom = false
      this.setState(p => (p.lockedToBottom === lockedToBottom ? null : {lockedToBottom}))
      this._scrollHeight = 0 // setting this causes us to skip next resize
      this._scrollToCentered()
      return
    }

    // Are we prepending older messages?
    if (snapshot && list && !this._isLockedToBottom()) {
      // onResize will be called normally but its pretty slow so you'll see a flash, instead of emulate it happening immediately
      this._scrollHeight = snapshot
      this._onResize({scroll: {height: list.scrollHeight}})
    } else if (
      this.props.containsLatestMessage &&
      this.props.messageOrdinals.size !== prevProps.messageOrdinals.size
    ) {
      // someone else sent something? then ignore next resize
      this._scrollHeight = 0
    }

    if (list && this.props.editingOrdinal && this.props.editingOrdinal !== prevProps.editingOrdinal) {
      const ordinal = this.props.editingOrdinal
      const idx = this.props.messageOrdinals.indexOf(ordinal)
      if (idx !== -1) {
        const waypoints = list.querySelectorAll('[data-key]')
        // find an id that should be our parent
        const toFind = Types.ordinalToNumber(ordinal)
        const found = (Array.from(waypoints) as Array<HTMLElement>).reverse().find(w => {
          const key = w.dataset.key
          return key !== undefined && parseInt(key, 10) < toFind
        })
        if (found) {
          found.scrollIntoView({behavior: 'smooth', block: 'center'})
        }
      }
    }
  }

  componentWillUnmount() {
    this._cleanupDebounced()
  }

  _cleanupDebounced = () => {
    this._onAfterScroll.cancel()
    this._onScrollThrottled.cancel()
    this._checkForLoadMoreThrottled.cancel()
  }

  _onScroll = () => {
    if (this._ignoreScrollOnetime) {
      this._logIgnoreScroll('_onScroll', () => {
        this._ignoreScrollOnetime = false
      })
      return
    }
    this._checkForLoadMoreThrottled()
    if (this._ignoreScrollRefCount > 0) {
      this._logIgnoreScroll('_onScroll', () => {
        this._ignoreScrollRefCount--
      })
      return
    }
    this._onScrollThrottled()
  }

  // While scrolling we disable mouse events to speed things up. We avoid state so we don't re-render while doing this
  _onScrollThrottled = throttle(
    () => {
      const list = this._listRef.current
      if (list && debug) {
        logger.debug('SCROLL', '_onScrollThrottled', 'scrollTop', list.scrollTop)
      }

      if (!this._isScrolling) {
        this._isScrolling = true
        if (this._pointerWrapperRef.current) {
          this._pointerWrapperRef.current.style.pointerEvents = 'none'
        }
      }
      this._onAfterScroll()

      // not locked to bottom while scrolling
      const lockedToBottom = false
      this.setState(p => (p.lockedToBottom === lockedToBottom ? null : {lockedToBottom}))
    },
    100,
    {leading: true, trailing: true}
  )

  _checkForLoadMoreThrottled = throttle(
    () => {
      // are we at the top?
      const list = this._listRef.current
      if (list) {
        if (list.scrollTop < listEdgeSlop) {
          this.props.loadOlderMessages()
        } else if (
          !this.props.containsLatestMessage &&
          !this._isLockedToBottom() &&
          list.scrollTop > list.scrollHeight - list.clientHeight - listEdgeSlop
        ) {
          this.props.loadNewerMessages()
        }
      }
    },
    100,
    // trailing = true cause you can be on top but keep scrolling which can keep the throttle going and ultimately miss out
    // on scrollTop being zero and not trying to load more
    {leading: true, trailing: true}
  )

  // After lets turn them back on
  _onAfterScroll = debounce(() => {
    if (this._isScrolling) {
      this._isScrolling = false
      if (this._pointerWrapperRef.current) {
        this._pointerWrapperRef.current.style.pointerEvents = 'initial'
      }
    }

    const list = this._listRef.current
    // are we locked on the bottom?
    if (list) {
      if (debug) {
        logger.debug('SCROLL', '_onAfterScroll', 'scrollTop', list.scrollTop)
      }
      const lockedToBottom = list.scrollHeight - list.clientHeight - list.scrollTop < listEdgeSlop
      this.setState(p => (p.lockedToBottom === lockedToBottom ? null : {lockedToBottom}))
    }
  }, 200)

  _rowRenderer = (ordinal: Types.Ordinal, previous?: Types.Ordinal, measure?: () => void) => (
    <Message
      key={String(ordinal)}
      ordinal={ordinal}
      previous={previous}
      measure={measure}
      conversationIDKey={this.props.conversationIDKey}
    />
  )

  _onCopyCapture = e => {
    // Copy text only, not HTML/styling.
    e.preventDefault()
    const sel = window.getSelection()
    sel && this.props.copyToClipboard(sel.toString())
  }

  _handleListClick = (ev: React.MouseEvent) => {
    const target = ev.target
    // allow focusing other inner inputs such as the reacji picker filter
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
      return
    }

    const sel = window.getSelection()
    if (sel && sel.isCollapsed) {
      this.props.onFocusInput()
    }
  }

  _makeItems = () => {
    return this._makeItemsMemoized(this.props.conversationIDKey, this.props.messageOrdinals)
  }
  _makeItemsMemoized = memoize((conversationIDKey, messageOrdinals) => {
    const items: Array<React.ReactNode> = []
    items.push(<TopItem key="topItem" conversationIDKey={conversationIDKey} />)

    const numOrdinals = messageOrdinals.size
    let ordinals: Array<Types.Ordinal> = []
    let previous: undefined | Types.Ordinal
    let lastBucket: number | undefined
    let baseIndex = 0 // this is used to de-dupe the waypoint around the centered ordinal
    messageOrdinals.forEach((ordinal, idx) => {
      // Centered ordinal is where we want the view to be centered on when jumping around in the thread.
      const isCenteredOrdinal = ordinal === this.props.centeredOrdinal

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
          chunks.forEach((toAdd, idx) => {
            const key = `${lastBucket || ''}:${idx + baseIndex}`
            items.push(
              <OrdinalWaypoint
                key={key}
                id={key}
                rowRenderer={this._rowRenderer}
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
            rowRenderer={this._rowRenderer}
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

    items.push(<BottomItem key="bottomItem" conversationIDKey={conversationIDKey} />)

    return items
  })

  _onResize = ({scroll}) => {
    if (this._scrollHeight) {
      // if the size changes adjust our scrolltop
      if (this._isLockedToBottom()) {
        this._scrollToBottom('_onResize')
      } else {
        const list = this._listRef.current
        if (list) {
          this._logAll(list, '_onResize', () => {
            this._ignoreScrollRefCount++
            list.scrollTop += scroll.height - this._scrollHeight
          })
        }
      }
    }
    this._scrollHeight = scroll.height
  }

  render() {
    const items = this._makeItems()

    const debugInfo = debug ? (
      <div>Debug info: {this._isLockedToBottom() ? 'Locked to bottom' : 'Not locked to bottom'}</div>
    ) : null

    return (
      <ErrorBoundary>
        {debugInfo}
        <div style={containerStyle} onClick={this._handleListClick} onCopyCapture={this._onCopyCapture}>
          <style>{realCSS}</style>
          <div
            key={this.props.conversationIDKey}
            style={listStyle}
            ref={this._listRef}
            onScroll={this._onScroll}
          >
            <Measure scroll={true} onResize={this._onResize}>
              {({measureRef}) => (
                <div ref={measureRef}>
                  <div ref={this._pointerWrapperRef}>{items}</div>
                </div>
              )}
            </Measure>
          </div>
          {this.props.showThreadSearch && (
            <ThreadSearch style={threadSearchStyle} conversationIDKey={this.props.conversationIDKey} />
          )}
          {!this.props.containsLatestMessage && this.props.messageOrdinals.size > 0 && (
            <JumpToRecent onClick={this._jumpToRecent} style={jumpToRecentStyle} />
          )}
        </div>
      </ErrorBoundary>
    )
  }
}

type TopBottomItemProps = {
  conversationIDKey: Types.ConversationIDKey
}

type TopBottomItemState = {
  keyCount: number
}

class TopItem extends React.PureComponent<TopBottomItemProps, TopBottomItemState> {
  state = {keyCount: 0}
  _measure = () => {
    this.setState(p => ({keyCount: p.keyCount + 1}))
  }

  render() {
    return <SpecialTopMessage conversationIDKey={this.props.conversationIDKey} measure={this._measure} />
  }
}

class BottomItem extends React.PureComponent<TopBottomItemProps, TopBottomItemState> {
  state = {keyCount: 0}
  _measure = () => {
    this.setState(p => ({keyCount: p.keyCount + 1}))
  }

  render() {
    return <SpecialBottomMessage conversationIDKey={this.props.conversationIDKey} measure={this._measure} />
  }
}

type OrdinalWaypointProps = {
  id: string
  rowRenderer: (ordinal: Types.Ordinal, previous?: Types.Ordinal, measure?: () => void) => React.ReactNode
  ordinals: Array<Types.Ordinal>
  previous?: Types.Ordinal
}

type OrdinalWaypointState = {
  height?: number
  heightForOrdinals: Array<Types.Ordinal>
  isVisible: boolean
  width?: number
}

class OrdinalWaypoint extends React.Component<OrdinalWaypointProps, OrdinalWaypointState> {
  state = {
    height: undefined,
    heightForOrdinals: [],
    isVisible: true,
    width: undefined,
  }
  _animID?: number

  componentWillUnmount() {
    this._onResize.cancel()
    this._measure.cancel()
    this._cancelAnim()
  }

  _cancelAnim = () => {
    if (this._animID) {
      window.cancelAnimationFrame(this._animID)
      this._animID = 0
    }
  }

  // We ran into an issue where this was being called tremendously fast with inside/below. To stop that behavior
  // we defer settings things invisible for a little bit, which seems enough to fix it
  _handlePositionChange = p => {
    // lets ignore when this happens, this seems like a large source of jiggliness
    if (this.state.isVisible && !p.event) {
      return
    }
    const {currentPosition} = p
    if (currentPosition) {
      const isVisible = currentPosition === 'inside'
      this._cancelAnim()
      if (isVisible) {
        this.setState(p => (!p.isVisible ? {isVisible: true} : null))
      } else {
        this._animID = window.requestAnimationFrame(() => {
          this._animID = 0
          this.setState(p => (p.isVisible ? {isVisible: false} : null))
        })
      }
    }
  }

  _onResize = debounce(({bounds}) => {
    const height = Math.ceil(bounds.height)
    const width = Math.ceil(bounds.width)

    if (height && width) {
      this.setState(p => {
        let nextHeightState = {}
        let nextWidthState = {}

        // don't have a width at all or its unchanged
        if (!p.width || p.width === width) {
          if (p.height !== height) {
            nextHeightState = {height}
          }
        } else {
          // toss height if width changes
          nextHeightState = {height: null}
        }

        if (p.width !== width) {
          nextWidthState = {width}
        }

        return {
          ...nextHeightState,
          ...nextWidthState,
        }
      })
    }
  }, 100)

  _measure = debounce(() => {
    this.setState(p => (p.height ? {height: undefined} : null))
  }, 100)

  shouldComponentUpdate(nextProps, nextState) {
    let shouldUpdate = false

    if (this.state.isVisible !== nextState.isVisible) {
      shouldUpdate = true
    }

    if (!shallowEqual(this.props.ordinals, nextProps.ordinals)) {
      shouldUpdate = true
    }

    if (this.state.height !== nextState.height) {
      shouldUpdate = true
    }

    return shouldUpdate
  }

  static getDerivedStateFromProps(props, state) {
    if (!shallowEqual(props.ordinals, state.heightForOrdinals)) {
      // if the ordinals changed remeasure
      return {height: null, heightForOrdinals: props.ordinals}
    }
    return null
  }

  render() {
    // Apply data-key to the dom node so we can search for editing messages
    const renderMessages = !this.state.height || this.state.isVisible
    let content
    if (renderMessages) {
      const messages = this.props.ordinals.map((o, idx) => {
        const previous = idx ? this.props.ordinals[idx - 1] : this.props.previous
        return this.props.rowRenderer(o, previous, this._measure)
      })
      content = (
        <Measure bounds={true} onResize={this._onResize}>
          {({measureRef}) => (
            <div data-key={this.props.id} ref={measureRef}>
              {messages}
            </div>
          )}
        </Measure>
      )
    } else {
      content = <div data-key={this.props.id} style={{height: this.state.height}} />
    }
    return (
      <Waypoint key={this.props.id} onPositionChange={this._handlePositionChange}>
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
const containerStyle = {
  ...globalStyles.flexBoxColumn,
  // containment hints so we can scroll faster
  contain: 'strict' as const,
  flex: 1,
  position: 'relative' as const,
}

const listStyle = {
  ...globalStyles.fillAbsolute,
  outline: 'none',
  overflowX: 'hidden' as const,
  overflowY: 'auto' as const,
  paddingBottom: globalMargins.small,
  // get our own layer so we can scroll faster
  willChange: 'transform' as const,
}

const jumpToRecentStyle = {
  bottom: 0,
  position: 'absolute' as const,
}

const threadSearchStyle = {
  position: 'absolute' as const,
  top: 0,
}

export default Thread
