// @flow
/* eslint-env browser */
//
// Infinite scrolling list.
// We group messages into a series of Waypoints. When the wayoint exits the screen we replace it with a single div instead
// We use react-measure to cache the heights

import * as React from 'react'
import * as Types from '../../../../constants/types/chat2'
import Measure from 'react-measure'
import Waypoint from 'react-waypoint'
import Message from '../../messages'
import SpecialTopMessage from '../../messages/special-top-message'
import SpecialBottomMessage from '../../messages/special-bottom-message'
import {ErrorBoundary} from '../../../../common-adapters'
import {debounce, throttle, chunk} from 'lodash-es'
import {globalStyles} from '../../../../styles'
import type {Props} from './index.types'
import shallowEqual from 'shallowequal'
import {globalMargins} from '../../../../styles/shared'

// hot reload isn't supported with debouncing currently so just ignore hot here
if (module.hot) {
  module.hot.decline()
}

const ordinalsInAWaypoint = 10
// pixels away from top/bottom to load/be locked
const listEdgeSlop = 10

type State = {
  isLockedToBottom: boolean,
}

type Snapshot = ?number

class Thread extends React.PureComponent<Props, State> {
  state = {isLockedToBottom: true}
  _listRef = React.createRef()
  // so we can turn pointer events on / off
  _pointerWrapperRef = React.createRef()
  // Not a state so we don't rerender, just mutate the dom
  _isScrolling = false
  // When we're triggering scrolling we don't want our event subscribers to fire so we increment this value
  _ignoreScrollToBottomRefCount = 0
  // last height we saw from resize
  _scrollHeight = 0

  _scrollToBottom = () => {
    const list = this._listRef.current
    if (list) {
      // ignore callbacks due to this change
      this._ignoreScrollToBottomRefCount++
      list.scrollTop = list.scrollHeight - list.clientHeight
    }
  }

  _scrollDown = () => {
    const list = this._listRef.current
    if (list) {
      list.scrollTop += list.clientHeight
    }
  }

  _scrollUp = () => {
    const list = this._listRef.current
    if (list) {
      list.scrollTop -= list.clientHeight
    }
  }

  componentDidMount() {
    if (this.state.isLockedToBottom) {
      setImmediate(() => this._scrollToBottom())
    }
  }

  getSnapshotBeforeUpdate(prevProps: Props, prevState: State) {
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

  componentDidUpdate(prevProps: Props, prevState: State, snapshot: Snapshot) {
    if (this.props === prevProps) {
      // don't do any of the below if just state changes
      return
    }

    // conversation changed
    if (this.props.conversationIDKey !== prevProps.conversationIDKey) {
      this._cleanupDebounced()
      this._scrollHeight = 0
      this.setState(p => (p.isLockedToBottom ? null : {isLockedToBottom: true}))
      this._scrollToBottom()
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

    // we send something last
    if (
      this.props.messageOrdinals.last() !== prevProps.messageOrdinals.last() &&
      this.props.lastMessageIsOurs
    ) {
      this.setState(p => (p.isLockedToBottom ? null : {isLockedToBottom: true}))
      this._scrollToBottom()
      return
    }

    // Adjust scrolling
    const list = this._listRef.current
    // Prepending some messages?
    if (snapshot && list && !this.state.isLockedToBottom) {
      // onResize will be called normally but its pretty slow so you'll see a flash, instead of emulate it happening immediately
      this._scrollHeight = snapshot
      this._onResize({scroll: {height: list.scrollHeight}})
    } else if (this.state.isLockedToBottom && this.props.conversationIDKey === prevProps.conversationIDKey) {
      // maintain scroll to bottom?
      this._scrollToBottom()
    } else if (this.props.messageOrdinals.size !== prevProps.messageOrdinals.size) {
      // someone else sent something? then ignore next resize resize
      this._scrollHeight = null
    }

    if (list && this.props.editingOrdinal && this.props.editingOrdinal !== prevProps.editingOrdinal) {
      const ordinal = this.props.editingOrdinal
      const idx = this.props.messageOrdinals.indexOf(ordinal)
      if (idx !== -1) {
        const waypoints = list.querySelectorAll('[data-key]')
        // find an id that should be our parent
        const toFind = Types.ordinalToNumber(ordinal)
        const found = Array.from(waypoints)
          .reverse()
          .find(w => parseInt(w.dataset.key, 10) < toFind)
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

  _onScroll = e => {
    this._checkForLoadMoreThrottled()
    if (this._ignoreScrollToBottomRefCount > 0) {
      this._ignoreScrollToBottomRefCount--
      return
    }
    this._onScrollThrottled()
  }

  // While scrolling we disable mouse events to speed things up. We avoid state so we don't re-render while doing this
  _onScrollThrottled = throttle(
    () => {
      if (!this._isScrolling) {
        this._isScrolling = true
        if (this._pointerWrapperRef.current) {
          this._pointerWrapperRef.current.style.pointerEvents = 'none'
        }
      }
      this._onAfterScroll()

      // not locked to bottom while scrolling
      const isLockedToBottom = false
      this.setState(p => (p.isLockedToBottom === isLockedToBottom ? null : {isLockedToBottom}))
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
          this.props.loadMoreMessages()
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
      const isLockedToBottom = list.scrollHeight - list.clientHeight - list.scrollTop < listEdgeSlop
      this.setState(p => (p.isLockedToBottom === isLockedToBottom ? null : {isLockedToBottom}))
    }
  }, 200)

  _rowRenderer = (ordinal: Types.Ordinal, previous: ?Types.Ordinal, measure: () => void) => (
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
    this.props.copyToClipboard(window.getSelection().toString())
  }

  _handleListClick = (ev: SyntheticMouseEvent<Element>) => {
    const target = ev.target
    // allow focusing other inner inputs such as the reacji picker filter
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
      return
    }

    if (window.getSelection().isCollapsed) {
      this.props.onFocusInput()
    }
  }

  _makeItems = () => {
    const items = []
    items.push(<TopItem key="topItem" conversationIDKey={this.props.conversationIDKey} />)

    const numOrdinals = this.props.messageOrdinals.size
    let ordinals = []
    let previous = null
    let lastBucket = null
    this.props.messageOrdinals.forEach((ordinal, idx) => {
      // We want to keep the mapping of ordinal to bucket fixed always
      const bucket = Math.floor(Types.ordinalToNumber(ordinal) / ordinalsInAWaypoint)
      if (lastBucket === null) {
        lastBucket = bucket
      }
      const needNextWaypoint = bucket !== lastBucket
      const isLastItem = idx === numOrdinals - 1
      if (needNextWaypoint || isLastItem) {
        if (isLastItem) {
          ordinals.push(ordinal)
        }
        if (ordinals.length) {
          // don't allow buckets to be too big
          const chunks = chunk(ordinals, 10)
          chunks.forEach((toAdd, idx) => {
            const key = `${lastBucket || ''}:${idx}`
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
      ordinals.push(ordinal)
    })

    items.push(<BottomItem key="bottomItem" conversationIDKey={this.props.conversationIDKey} />)

    return items
  }

  _onResize = ({scroll}) => {
    if (this._scrollHeight) {
      // if the size changes adjust our scrolltop
      const list = this._listRef.current
      if (list) {
        this._ignoreScrollToBottomRefCount++
        if (this.state.isLockedToBottom) {
          list.scrollTop = list.scrollTop + scroll.height - list.clientHeight
        } else {
          list.scrollTop = list.scrollTop + scroll.height - this._scrollHeight
        }
      }
    }
    this._scrollHeight = scroll.height
  }

  render() {
    const items = this._makeItems()

    return (
      <ErrorBoundary>
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
        </div>
      </ErrorBoundary>
    )
  }
}

// All the waypoints keep a key to re-render if we get a measure callback
type TopBottomItemProps = {
  conversationIDKey: Types.ConversationIDKey,
}
type TopBottomItemState = {
  keyCount: number,
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
  id: string,
  rowRenderer: (ordinal: Types.Ordinal, previous: ?Types.Ordinal, measure: () => void) => React.Node,
  ordinals: Array<Types.Ordinal>,
  previous: ?Types.Ordinal,
}

type OrdinalWaypointState = {
  // cached height
  height: ?number,
  // to bust the height cache
  heightForOrdinals: Array<Types.Ordinal>,
  // in view
  isVisible: boolean,
  // width just to keep track if we should toss height
  width: ?number,
}
class OrdinalWaypoint extends React.Component<OrdinalWaypointProps, OrdinalWaypointState> {
  state = {
    height: null,
    heightForOrdinals: [],
    isVisible: true,
    width: null,
  }
  _animID: number

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
  _handlePositionChange = ({currentPosition}) => {
    if (currentPosition) {
      const isVisible = currentPosition === 'inside'
      this._cancelAnim()
      if (isVisible) {
        this.setState(p => (!p.isVisible ? {isVisible: true} : undefined))
      } else {
        this._animID = window.requestAnimationFrame(() => {
          this._animID = 0
          this.setState(p => (p.isVisible ? {isVisible: false} : undefined))
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
    this.setState(p => (p.height ? {height: null} : null))
  }, 100)

  shouldComponentUpdate(nextProps, nextState) {
    let shouldUpdate = false

    if (this.state.isVisible !== nextState.isVisible) {
      shouldUpdate = true
    }

    if (!shallowEqual(this.props.ordinals, nextProps.ordinals)) {
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
  contain: 'strict',
  flex: 1,
  position: 'relative',
}

const listStyle = {
  ...globalStyles.fillAbsolute,
  outline: 'none',
  overflowX: 'hidden',
  overflowY: 'auto',
  paddingBottom: globalMargins.small,
  // get our own layer so we can scroll faster
  willChange: 'transform',
}

export default Thread
