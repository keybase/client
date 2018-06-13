// @flow

// use waypoints to group sets of messages (100 each) and replace them with a measured div when offscreen

import * as React from 'react'
import Measure from 'react-measure'
import Waypoint from 'react-waypoint'
import Message from '../../messages'
import SpecialTopMessage from '../../messages/special-top-message'
import SpecialBottomMessage from '../../messages/special-bottom-message'
import {ErrorBoundary} from '../../../../common-adapters'
import {copyToClipboard} from '../../../../util/clipboard'
import {debounce} from 'lodash-es'
import {globalColors, globalStyles} from '../../../../styles'

import type {Props} from '.'

// set this to true to see size overlays
const debugSizing = __STORYBOOK__

const ordinalsInAWaypoint = 10
const lockedToBottomSlop = 20

type State = {
  isLockedToBottom: boolean,
}

class Thread extends React.PureComponent<Props, State> {
  state = {isLockedToBottom: true, width: 0}

  _keyMapper = (index: number) => {
    const itemCountIncludingSpecial = this._getItemCount()
    if (index === itemCountIncludingSpecial - 1) {
      return 'specialBottom'
    } else if (index === 0) {
      return 'specialTop'
    } else {
      const ordinalIndex = index - 1
      return this.props.messageOrdinals.get(ordinalIndex)
    }
  }

  componentDidUpdate(prevProps: Props) {
    if (this.props.conversationIDKey !== prevProps.conversationIDKey) {
      this.setState({isLockedToBottom: true})
      return
    }

    if (this.props.listScrollDownCounter !== prevProps.listScrollDownCounter) {
      this.setState({isLockedToBottom: true})
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
  // _onResize = (key, height) => {
  // this._ordinalToHeight[key] = height
  // }
  // _onResize = ({width}) => {
  // if (this._cellCache.columnWidth({index: 0}) !== width) {
  // this._cellCache.clearAll()
  // }
  // if (debugSizing) {
  // this.setState({width})
  // }
  // }

  _getItemCount = () => this.props.messageOrdinals.size + 2

  _rowRenderer = ordinalIndex => {
    const ordinal = this.props.messageOrdinals.get(ordinalIndex)
    if (ordinal) {
      const measure = null
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
    return <div />
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

  _setListRef = (r: any) => {
    this._list = r
  }

  render() {
    // const rowCount = this._getItemCount()
    // const scrollToIndex = this.state.isLockedToBottom ? rowCount - 1 : undefined
    // maybe memoize this
    let waitingToInjectIntoWaypoint = []
    const waypoints = []
    const measure = null

    waypoints.push([
      <Waypoint key="SpecialTopMessage">
        <div>
          <SpecialTopMessage conversationIDKey={this.props.conversationIDKey} measure={measure} />
        </div>
      </Waypoint>,
    ])

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
              messages={waitingToInjectIntoWaypoint.map(i => this._rowRenderer(i))}
            />
          )
          waitingToInjectIntoWaypoint = []
        }
      }
      waitingToInjectIntoWaypoint.push(idx)
    }

    waypoints.push([
      <Waypoint key="SpecialBottomMessage">
        <div>
          <SpecialBottomMessage conversationIDKey={this.props.conversationIDKey} measure={measure} />
        </div>
      </Waypoint>,
    ])

    return (
      <ErrorBoundary>
        <div style={containerStyle} onClick={this._handleListClick} onCopyCapture={this._onCopyCapture}>
          <style>{realCSS}</style>
          <div style={listStyle}>{waypoints}</div>
        </div>
      </ErrorBoundary>
    )
  }
}

class OrdinalWaypoint extends React.PureComponent<> {
  state = {
    height: null,
    isVisible: true,
  }
  _handlePositionChange = ({currentPosition}) => {
    if (currentPosition) {
      const isVisible = currentPosition === 'inside'
      this.setState(prevState => (prevState.isVisible !== isVisible ? {isVisible} : undefined))
    }
  }
  _onResize = ({bounds}) => {
    const height = bounds.height
    if (height) {
      this.setState(prevState => (prevState.height !== height ? {height} : undefined))
    }
  }

  render() {
    const renderMessages = !this.state.height || this.state.isVisible
    return (
      <Waypoint onPositionChange={this._handlePositionChange}>
        <Measure bounds={true} onResize={this._onResize}>
          {({measureRef}) => (
            <div
              ref={measureRef}
              style={!renderMessages && this.state.height ? {height: this.state.height} : null}
            >
              {renderMessages ? this.props.messages : null}
            </div>
          )}
        </Measure>
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
}

export default Thread
