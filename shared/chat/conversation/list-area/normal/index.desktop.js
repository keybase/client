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
  isScrolling: boolean,
  width: number, // when the width changes lets just redraw it all as our measurements are bad now
}

type Snapshot = ?number

class Thread extends React.PureComponent<Props, State> {
  state = {isLockedToBottom: true, isScrolling: false, width: 0}
  _listRef = React.createRef()

  _scrollToBottom = () => {
    const list = this._listRef.current
    if (list) {
      list.scrollTop = list.scrollHeight
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
      if (this.state.width !== prevState.width) {
        this._scrollToBottom()
      }
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

  _onResize = debounce(({bounds}) => {
    if (this.state.isLockedToBottom) {
      this._scrollToBottom()
    }

    this.setState(p => (p.width === bounds.width ? null : {width: bounds.width}))
  }, 100)

  _cleanupDebounced = () => {
    this._onAfterScroll.cancel()
    this._onScroll.cancel()
    this._onResize.cancel()
    this._positionChangeTop.cancel()
    this._positionChangeBottom.cancel()
  }

  // While scrolling we disable mouse events to speed things up
  _onScroll = throttle(() => {
    this.setState(p => (p.isScrolling ? undefined : {isScrolling: true}))
    this._onAfterScroll()
  }, 100)

  // After lets turn them back on
  _onAfterScroll = debounce(() => {
    this.setState(p => (p.isScrolling ? {isScrolling: false} : undefined))
  }, 200)

  _rowRenderer = (ordinalIndex: number, measure: () => void) => {
    const ordinal = this.props.messageOrdinals.get(ordinalIndex)
    if (ordinal) {
      const prevOrdinal = ordinalIndex > 0 ? this.props.messageOrdinals.get(ordinalIndex - 1) : null
      return (
        <Message
          key={String(ordinal)}
          ordinal={ordinal}
          previous={prevOrdinal}
          measure={measure}
          conversationIDKey={this.props.conversationIDKey}
        />
      )
    }
    return <div key={String(ordinalIndex)} />
  }

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
    let indicies = []
    for (var idx = 0; idx < numOrdinals; ++idx) {
      const needNextWaypoint = idx % ordinalsInAWaypoint === 0
      const isLastItem = idx === numOrdinals - 1
      if (needNextWaypoint || isLastItem) {
        if (isLastItem) {
          indicies.push(idx)
        }

        if (indicies.length) {
          const ordinal = this.props.messageOrdinals.get(indicies[0] || 0)
          if (!ordinal) {
            throw new Error('Should be impossible')
          }
          const key = String(Types.ordinalToNumber(ordinal))
          waypoints.push(
            <OrdinalWaypoint key={key} id={key} rowRenderer={this._rowRenderer} indicies={indicies} />
          )
          indicies = []
        }
      }
      indicies.push(idx)
    }

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
        <Measure bounds={true} onResize={this._onResize}>
          {({measureRef}) => (
            <div
              ref={measureRef}
              style={containerStyle}
              onClick={this._handleListClick}
              onCopyCapture={this._onCopyCapture}
            >
              <style>{realCSS}</style>
              <div
                key={String(this.state.width)}
                style={listStyle}
                ref={this._listRef}
                onScroll={this._onScroll}
              >
                <div style={this.state.isScrolling ? innerListStyleScrolling : null}>{waypoints}</div>
              </div>
            </div>
          )}
        </Measure>
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
  rowRenderer: (ordinalIndex: number, measure: () => void) => React.Node,
  indicies: Array<number>,
}

type OrdinalWaypointState = {
  // cached height
  height: ?number,
  // how we keep track if height needs to be tossed
  heightForIndicies: ?string,
  // in view
  isVisible: boolean,
}
class OrdinalWaypoint extends React.Component<OrdinalWaypointProps, OrdinalWaypointState> {
  state = {
    height: null,
    heightForIndicies: null,
    isVisible: true,
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
    if (height) {
      this.setState(p => (p.height !== height ? {height} : undefined))
    }
  }, 100)

  _measure = debounce(() => {
    this.setState(p => (p.height ? {height: null} : null))
  }, 100)

  static _getIndiciesHeightKey = indicies => indicies.join('')

  shouldComponentUpdate(nextProps, nextState) {
    // indicies is an array so we need to compare it explicitly
    return (
      this.state.height !== nextState.height ||
      this.state.isVisible !== nextState.isVisible ||
      OrdinalWaypoint._getIndiciesHeightKey(nextProps.indicies) !== this.state.heightForIndicies
    )
  }

  static getDerivedStateFromProps(props, state) {
    const heightForIndicies = OrdinalWaypoint._getIndiciesHeightKey(props.indicies)
    if (heightForIndicies !== state.heightForIndicies) {
      // if the Indicies changed remeasure
      return {height: null, heightForIndicies}
    }
    return null
  }

  render() {
    // Apply data-key to the dom node so we can search for editing messages
    const renderMessages = !this.state.height || this.state.isVisible
    let content
    if (renderMessages) {
      const messages = this.props.indicies.map(i => this.props.rowRenderer(i, this._measure))
      if (this.state.height) {
        // cached height version, overflow hidden so its more clear if we're mismeasuring
        content = (
          <div data-key={this.props.id} style={{height: this.state.height, overflow: 'hidden'}}>
            {messages}
          </div>
        )
      } else {
        // measure it
        content = (
          <Measure bounds={true} onResize={renderMessages ? this._onResize : null}>
            {({measureRef}) => (
              <div data-key={this.props.id} ref={measureRef}>
                {messages}
              </div>
            )}
          </Measure>
        )
      }
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
  flex: 1,
  position: 'relative',
  // containment hints so we can scroll faster
  contain: 'strict',
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
