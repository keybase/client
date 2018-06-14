// @flow
// use waypoints to group sets of messages (10 each) and replace them with a measured div when offscreen

import * as React from 'react'
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

// set this to true to see size overlays
// const debugSizing = __STORYBOOK__
const ordinalsInAWaypoint = 10

type State = {
  isLockedToBottom: boolean,
  isScrolling: boolean,
}

type Snapshot = ?number

class Thread extends React.PureComponent<Props, State> {
  state = {isLockedToBottom: true, isScrolling: false}
  _listRef = React.createRef()
  _setBottomRef = r => {
    this._bottomRef = r
  } // old style due to react-waypoint

  // _keyMapper = (index: number) => {
  // const itemCountIncludingSpecial = this._getItemCount()
  // if (index === itemCountIncludingSpecial - 1) {
  // return 'specialBottom'
  // } else if (index === 0) {
  // return 'specialTop'
  // } else {
  // const ordinalIndex = index - 1
  // return this.props.messageOrdinals.get(ordinalIndex)
  // }
  // }

  _scrollToBottom = () => {
    const list = this._listRef.current
    if (list) {
      // we need to let things render and measure
      // setTimeout(() => {
      console._log('aaaa scrolling bottom in', list.scrollTop, list.scrollHeight)
      list.scrollTop = list.scrollHeight
      // }, 100)
    }
    // if (this._bottomRef) {
    // console.log('aaaa scrolling bottom in')
    // setImmediate(() => {
    // this._bottomRef.scrollIntoView({behavior: 'instant', block: 'end'})
    // })
    // } else {
    // console.log('aaaa scrolling bottom FAIL')
    // }
  }

  componentDidMount(prevProps: Props) {
    // setInterval(() => {
    // console.log('aaa', this._list && this._list.scrollHeight)
    // }, 100)
    if (this.state.isLockedToBottom) {
      // this._scrollToBottom()
      setImmediate(() => this._scrollToBottom())
    }
  }

  getSnapshotBeforeUpdate(prevProps: Props, prevState: State) {
    // prepending?
    if (
      this.props.conversationIDKey === prevProps.conversationIDKey &&
      this.props.messageOrdinals.first() !== prevProps.messageOrdinals.first() &&
      prevProps.messageOrdinals.first()
    ) {
      console.log(
        'aaa getsnapshot calling',
        this.props.conversationIDKey,
        this.props.messageOrdinals.first(),
        prevProps.messageOrdinals.first(),
        this.props.messageOrdinals.size,
        prevProps.messageOrdinals.size
      )
      return this._listRef.current ? this._listRef.current.scrollHeight : null
    }
    return null
  }

  componentDidUpdate(prevProps: Props, prevState: State, snapshot: Snapshot) {
    console.log('aaaa updated', this._listRef.current && this._listRef.current.scrollHeight)
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
      console._log('aaaa ttempt to keep TOP')
      list.scrollTop = list.scrollHeight - snapshot
    } else {
      // maintain scroll to bottom?
      if (this.state.isLockedToBottom && this.props.conversationIDKey === prevProps.conversationIDKey) {
        console._log('aaa attempt to keep BOTTOM')
        this._scrollToBottom()
      }
    }

    // TODO
    // if (this.props.editingOrdinal && this.props.editingOrdinal !== prevProps.editingOrdinal) {
    // const idx = this.props.messageOrdinals.indexOf(this.props.editingOrdinal)
    // if (idx !== -1) {
    // this._list && this._list.scrollToRow(idx + 1)
    // }
    // }
  }
  // we MUST debounce else this callbacks happens a bunch and we're switch back and forth as you submit
  // _updateBottomLock = debounce((clientHeight: number, scrollHeight: number, scrollTop: number) => {
  // // meaningless otherwise
  // if (clientHeight) {
  // this.setState(prevState => {
  // const isLockedToBottom = scrollTop + clientHeight >= scrollHeight - lockedToBottomSlop
  // return isLockedToBottom !== prevState.isLockedToBottom ? {isLockedToBottom} : null
  // })
  // }
  // }, 100)

  // _maybeLoadMoreMessages = debounce((clientHeight: number, scrollHeight: number, scrollTop: number) => {
  // if (clientHeight && scrollHeight && scrollTop <= 20) {
  // this.props.loadMoreMessages(this.props.messageOrdinals.first())
  // }
  // }, 500)

  // _onScroll = ({clientHeight, scrollHeight, scrollTop}) => {
  // this._updateBottomLock(clientHeight, scrollHeight, scrollTop)
  // this._maybeLoadMoreMessages(clientHeight, scrollHeight, scrollTop)
  // }

  // _ordinalToHeight = {}
  _onResize = (...args) => {
    // console.log('aaa mesure', args)
    if (this.state.isLockedToBottom) {
      this._scrollToBottom()
    }
  }
  // _onResize = ({width}) => {
  // if (this._cellCache.columnWidth({index: 0}) !== width) {
  // this._cellCache.clearAll()
  // }
  // if (debugSizing) {
  // this.setState({width})
  // }
  // }
  //
  _cleanupDebounced = () => {
    this._onAfterScroll.cancel()
    this._onScroll.cancel()
    this._positionChangeTop.cancel()
    this._positionChangeBottom.cancel()
  }
  componentWillUnmount() {
    this._cleanupDebounced()
  }
  _onAfterScroll = debounce(() => {
    console.log('aaa scrollEND')
    this.setState(p => (p.isScrolling ? {isScrolling: false} : undefined))
  }, 200)
  _onScroll = throttle(() => {
    console.log('aaa scrollStart')
    this.setState(p => (p.isScrolling ? undefined : {isScrolling: true}))
    this._onAfterScroll()
  }, 100)

  _getItemCount = () => this.props.messageOrdinals.size + 2

  _rowRenderer = (ordinalIndex, measure) => {
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

  // _handleListClick = () => {
  // if (window.getSelection().isCollapsed) {
  // this.props.onFocusInput()
  // }
  // }

  _positionChangeTop = debounce(({currentPosition}) => {
    if (currentPosition === 'inside') {
      this.props.loadMoreMessages()
    }
  }, 100)

  _positionChangeBottom = debounce(({currentPosition}) => {
    const isLockedToBottom = currentPosition === 'inside'
    console._log('aaa _positionChangeBottom ', isLockedToBottom)
    this.setState(p => (p.isLockedToBottom === isLockedToBottom ? null : {isLockedToBottom}))
  }, 100)

  render() {
    // const rowCount = this._getItemCount()
    // const scrollToIndex = this.state.isLockedToBottom ? rowCount - 1 : undefined
    // maybe memoize this
    let waitingToInjectIntoWaypoint = []
    const waypoints = []

    waypoints.push(
      <TopWaypoint
        key="topWaypoint"
        onPositionChange={this._positionChangeTop}
        conversationIDKey={this.props.conversationIDKey}
      />
    )

    const numOrdinals = this.props.messageOrdinals.size
    for (var idx = 0; idx < numOrdinals; ++idx) {
      const needNextWaypoint = idx % ordinalsInAWaypoint === 0
      const isLastItem = idx === numOrdinals - 1
      if (needNextWaypoint || isLastItem) {
        if (isLastItem) {
          waitingToInjectIntoWaypoint.push(idx)
        }

        if (waitingToInjectIntoWaypoint.length) {
          const key = String(this.props.messageOrdinals.get(waitingToInjectIntoWaypoint[0]))
          waypoints.push(
            <OrdinalWaypoint
              key={key}
              id={key}
              rowRenderer={this._rowRenderer}
              ordinals={waitingToInjectIntoWaypoint}
            />
          )
          waitingToInjectIntoWaypoint = []
        }
      }
      waitingToInjectIntoWaypoint.push(idx)
    }

    waypoints.push(
      <BottomWaypoint
        key="bottomWaypoint"
        forwardedRef={this._setBottomRef}
        onPositionChange={this._positionChangeBottom}
        conversationIDKey={this.props.conversationIDKey}
      />
    )

    // TODO dynamically change this based on scroll

    return (
      <ErrorBoundary>
        <div style={containerStyle} onClick={this._handleListClick} onCopyCapture={this._onCopyCapture}>
          <style>{realCSS}</style>

          <div style={listStyle} ref={this._listRef} onScroll={this._onScroll}>
            <div style={this.state.isScrolling ? innerListStyleScrolling : null}>{waypoints}</div>
          </div>
        </div>
      </ErrorBoundary>
    )
  }

  // <Measure scroll={true} onResize={this._onResize}>
  // {({measureRef}) => (
  // <div style={listStyle} ref={measureRef}>
  // {waypoints}
  // </div>
  // )}
  // </Measure>
}

class TopWaypoint extends React.PureComponent<> {
  state = {keyCount: 0}
  _measure = () => {
    // console.log('aaa measure top')
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

// Note can't use React.forwardRef due to issues w/ react-waypoint not working with it
class BottomWaypoint extends React.PureComponent<> {
  state = {keyCount: 0}
  _measure = () => {
    console.log('aaa measure bottom')
    this.setState(p => ({keyCount: p.keyCount + 1}))
  }

  render() {
    return (
      <Waypoint
        key={`SpecialBottomMessage:${this.state.keyCount}`}
        onPositionChange={this.props.onPositionChange}
      >
        <div ref={this.props.forwardedRef}>
          <SpecialBottomMessage conversationIDKey={this.props.conversationIDKey} measure={this._measure} />
        </div>
      </Waypoint>
    )
  }
}

// TODO not sure keyCount / remeasure is needed in this impl. need to test it

class OrdinalWaypoint extends React.Component<> {
  state = {
    height: null,
    isVisible: true,
    // keyCount: 0,
    heightForOrdinals: null, // the cached height value was for what ordinals
  }
  _handlePositionChange = ({currentPosition}) => {
    if (currentPosition) {
      const isVisible = currentPosition === 'inside'

      // console.log('aaa vis', this.props.id, isVisible)
      this.setState(p => (p.isVisible !== isVisible ? {isVisible} : undefined))
    }
  }

  componentWillUnmount() {
    this._onResize.cancel()
    this._measure.cancel()
  }

  _onResize = debounce(({bounds}) => {
    const height = bounds.height
    // console.log('aaa heig', this.props.id, height)
    if (height) {
      this.setState(p => (p.height !== height ? {height} : undefined))
    }
  }, 100)

  _measure = debounce(() => {
    console.log('aaa measure waypoint', this.props.id)
    // this.setState(p => ({keyCount: p.keyCount + 1}))
    this.setState(p => (p.height ? {height: null} : null))
  }, 100)

  static _getOrdinalHeightKey = ordinals => ordinals.join('')

  shouldComponentUpdate(nextProps, nextState) {
    return (
      this.state.height !== nextState.height ||
      this.state.isVisible !== nextState.isVisible ||
      // this.state.keyCount !== nextState.keyCount ||
      OrdinalWaypoint._getOrdinalHeightKey(nextProps.ordinals) !== this.state.heightForOrdinals
    )
  }

  static getDerivedStateFromProps(props, state) {
    const heightForOrdinals = OrdinalWaypoint._getOrdinalHeightKey(props.ordinals)
    if (heightForOrdinals !== state.heightForOrdinals) {
      return {height: null, heightForOrdinals}
    }
    return null
  }

  render() {
    const renderMessages = !this.state.height || this.state.isVisible
    let content
    const messages = this.props.ordinals.map(i => this.props.rowRenderer(i, this._measure))
    if (renderMessages) {
      if (this.state.height) {
        // turn off hidden after debugging measure
        content = <div style={{height: this.state.height, overflow: 'hidden'}}>{messages}</div>
      } else {
        content = (
          <Measure bounds={true} onResize={renderMessages ? this._onResize : null}>
            {({measureRef}) => <div ref={measureRef}>{messages}</div>}
          </Measure>
        )
      }
    } else {
      content = <div style={{height: this.state.height}} />
    }
    return (
      <Waypoint key={`${this.props.id}:${''}`} onPositionChange={this._handlePositionChange}>
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
  contain: 'strict',
  flex: 1,
  position: 'relative',
}

const listStyle = {
  outline: 'none',
  overflowX: 'hidden',
  overflowY: 'auto',
  willChange: 'transform',
}

const innerListStyleScrolling = {
  pointerEvents: 'none',
}

export default Thread
