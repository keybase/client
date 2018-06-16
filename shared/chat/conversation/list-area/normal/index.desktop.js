// @flow
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
import {copyToClipboard} from '../../../../util/clipboard'
import {debounce, throttle} from 'lodash-es'
import {globalColors, globalStyles} from '../../../../styles'

import type {Props} from '.'

// hot reload isn't supported with debouncing currently so just ignore hot here
if (module.hot) {
  module.hot.decline()
}

const ordinalsInAWaypoint = 10

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

  _scrollToBottom = () => {
    const list = this._listRef.current
    if (list) {
      list.scrollTop = list.scrollHeight - list.clientHeight
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

    if (this.props.conversationIDKey !== prevProps.conversationIDKey) {
      this._cleanupDebounced()
      this.setState(p => (p.isLockedToBottom ? null : {isLockedToBottom: true}))
      this._scrollToBottom()
      return
    }

    if (this.props.listScrollDownCounter !== prevProps.listScrollDownCounter) {
      this.setState(p => (p.isLockedToBottom ? null : {isLockedToBottom: true}))
      this._scrollToBottom()
      return
    }

    // Adjust scrolling
    const list = this._listRef.current
    // Prepending some messages?
    if (snapshot && list && !this.state.isLockedToBottom) {
      list.scrollTop = list.scrollHeight - snapshot
    } else {
      // maintain scroll to bottom?
      if (this.state.isLockedToBottom && this.props.conversationIDKey === prevProps.conversationIDKey) {
        this._scrollToBottom()
      }
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
    this._onScroll.cancel()
    this._positionChangeTop.cancel()
    this._positionChangeBottom.cancel()
  }

  // While scrolling we disable mouse events to speed things up
  _onScroll = throttle(() => {
    if (!this._isScrolling) {
      this._isScrolling = true
      if (this._pointerWrapperRef.current) {
        this._pointerWrapperRef.current.style.pointerEvents = 'none'
      }
    }
    this._onAfterScroll()
  }, 100)

  // After lets turn them back on
  _onAfterScroll = debounce(() => {
    if (this._isScrolling) {
      this._isScrolling = false
      if (this._pointerWrapperRef.current) {
        this._pointerWrapperRef.current.style.pointerEvents = 'initial'
      }
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

  _onCopyCapture(e) {
    // Copy text only, not HTML/styling.
    e.preventDefault()
    copyToClipboard(window.getSelection().toString())
  }

  _handleListClick = () => {
    if (window.getSelection().isCollapsed) {
      this.props.onFocusInput()
    }
  }

  // When the top waypoint is visible, lets load more messages
  _positionChangeTop = debounce(({currentPosition}) => {
    if (currentPosition === 'inside') {
      this.props.loadMoreMessages()
    }
  }, 100)

  // When the bottom waypoint is visible, lock to bottom
  _positionChangeBottom = debounce(({currentPosition}) => {
    const isLockedToBottom = currentPosition === 'inside'
    this.setState(p => (p.isLockedToBottom === isLockedToBottom ? null : {isLockedToBottom}))
  }, 100)

  _makeWaypoints = () => {
    const waypoints = []
    waypoints.push(
      <TopWaypoint
        key="topWaypoint"
        onPositionChange={this._positionChangeTop}
        conversationIDKey={this.props.conversationIDKey}
      />
    )

    const numOrdinals = this.props.messageOrdinals.size
    let ordinals = []
    let previous = null
    let lastBucket = null
    this.props.messageOrdinals.forEach((ordinal, idx) => {
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
          const key = String(lastBucket)
          // console.log('aaa renpush', key, JSON.stringify(ordinals))
          waypoints.push(
            <OrdinalWaypoint
              key={key}
              id={key}
              rowRenderer={this._rowRenderer}
              ordinals={ordinals}
              previous={previous}
            />
          )
          previous = ordinals[ordinals.length - 1]
          ordinals = []
          lastBucket = bucket
        }
      }
      ordinals.push(ordinal)
    })

    waypoints.push(
      <BottomWaypoint
        key="bottomWaypoint"
        onPositionChange={this._positionChangeBottom}
        conversationIDKey={this.props.conversationIDKey}
      />
    )

    return waypoints
  }

  render() {
    const waypoints = this._makeWaypoints()

    return (
      <ErrorBoundary>
        <div style={containerStyle} onClick={this._handleListClick} onCopyCapture={this._onCopyCapture}>
          <style>{realCSS}</style>
          <div style={listStyle} ref={this._listRef} onScroll={this._onScroll}>
            <div ref={this._pointerWrapperRef}>{waypoints}</div>
          </div>
        </div>
      </ErrorBoundary>
    )
  }
}

// All the waypoints keep a key to re-render if we get a measure callback
type TopBottomWaypointProps = {
  conversationIDKey: Types.ConversationIDKey,
  onPositionChange: () => void,
}
type TopBottomWaypointState = {
  keyCount: number,
}

class TopWaypoint extends React.PureComponent<TopBottomWaypointProps, TopBottomWaypointState> {
  state = {keyCount: 0}
  _measure = () => {
    this.setState(p => ({keyCount: p.keyCount + 1}))
  }

  render() {
    return (
      <Waypoint
        key={`SpecialTopMessage:${this.state.keyCount}`}
        onPositionChange={this.props.onPositionChange}
      >
        <div>
          <SpecialTopMessage conversationIDKey={this.props.conversationIDKey} measure={this._measure} />
        </div>
      </Waypoint>
    )
  }
}

class BottomWaypoint extends React.PureComponent<TopBottomWaypointProps, TopBottomWaypointState> {
  state = {keyCount: 0}
  _measure = () => {
    this.setState(p => ({keyCount: p.keyCount + 1}))
  }

  render() {
    return (
      <Waypoint
        key={`SpecialBottomMessage:${this.state.keyCount}`}
        onPositionChange={this.props.onPositionChange}
      >
        <div>
          <SpecialBottomMessage conversationIDKey={this.props.conversationIDKey} measure={this._measure} />
        </div>
      </Waypoint>
    )
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
  // how we keep track if height needs to be tossed
  numOrdinals: number,
  // in view
  isVisible: boolean,
  // width just to keep track if we should toss height
  width: ?number,
}
class OrdinalWaypoint extends React.Component<OrdinalWaypointProps, OrdinalWaypointState> {
  state = {
    height: null,
    isVisible: true,
    numOrdinals: 0,
    width: null,
  }

  componentWillUnmount() {
    this._onResize.cancel()
    this._measure.cancel()
  }

  _handlePositionChange = ({currentPosition}) => {
    if (currentPosition) {
      const isVisible = currentPosition === 'inside'
      this.setState(p => (p.isVisible !== isVisible ? {isVisible} : undefined))
    }
  }

  _onResize = debounce(({bounds}) => {
    const height = bounds.height
    const width = bounds.width

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
    // this.props.id === 507 && console.log('aaa measure', this.props, this.state)
    this.setState(p => (p.height ? {height: null} : null))
  }, 100)

  shouldComponentUpdate(nextProps, nextState) {
    // ordinals is an array so we need to compare it explicitly
    const shouldUpdate =
      this.state.height !== nextState.height ||
      this.state.isVisible !== nextState.isVisible ||
      // we ignore width changes, its just to bookkeep height
      nextProps.ordinals.length !== this.state.numOrdinals

    if (shouldUpdate) {
      // this.props.id === 507 && console.log('aaa shouldup', this.props, this.state)
    }

    return shouldUpdate
  }

  static getDerivedStateFromProps(props, state) {
    const numOrdinals = props.ordinals.length
    if (numOrdinals !== state.numOrdinals) {
      // props.id === 507 && console.log('aaa deri', props, state)
      // if the ordinals changed remeasure
      return {height: null, numOrdinals}
    }
    return null
  }

  render() {
    // this.props.id === 507 && console.log('aaa render', this.props, this.state)
    // console.log('aaaa render', this.props, this.state)
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
            <div
              data-key={this.props.id}
              ref={measureRef}
              style={this.state.height ? {height: this.state.height, overflow: 'hidden'} : null}
            >
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
  border: 1px solid transparent;
  contain: content;
}
.message .menu-button {
  visibility: hidden;
  height: 17;
  flex-shrink: 0;
  opacity: 0;
}
.message:hover {
  border: 1px solid ${globalColors.black_10};
}
.message:hover .menu-button {
  visibility: visible;
  opacity: 1;
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
  // get our own layer so we can  scroll faster
  willChange: 'transform',
}

// mask mouse events while scrol ling
const innerListStyleScrolling = {
  pointerEvents: 'none',
}

export default Thread
