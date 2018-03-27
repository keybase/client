// @flow
/*
 * Use waypoints to hold children
 * get loading scroll position to work
 * measure waypoint children and replace w/ a div when off screen of the same size
 *
 * use waypoint meawsurement to find actual offset of good waypoint, like middle or one that went offcreen?
 *
 */

import * as React from 'react'
import * as ReactDom from 'react-dom'
import Message from '../../messages'
// import Measure from 'react-measure'
import Waypoint from 'react-waypoint'
// import {ErrorBoundary} from '../../../../common-adapters'
// import clipboard from '../../../../desktop/clipboard'
// import debounce from 'lodash/debounce'
import {globalColors, globalStyles} from '../../../../styles'

import type {Props} from '.'

type State = {
  // isLockedToBottom: boolean,
  // listRerender: number,
}

// const lockedToBottomSlop = 20

class Thread extends React.Component<Props, State> {
  _isLockedToBottom: boolean = true
  // _cellCache = new Virtualized.CellMeasurerCache({
  // fixedWidth: true,
  // keyMapper: (rowIndex: number) => this.props.messageOrdinals.get(rowIndex),
  // })

  // _list: any
  // _keepIdxVisible: number = -1
  // _lastRowIdx: number = -1
  // ScrolltoRow sometimes triggers load more. This'll all go away when we ditch react-virtualized. for now this fixes
  // if you edit your last message that'l cause a load more sometimes due to scrolltop being 0 incorrectly
  // _ignoreScrollUpTill: number = 0

  state = {
    // isLockedToBottom: true,
    // listRerender: 0,
    // selectedMessageKey: null,
  }

  _bottomWaypointScrollTop = null

  _saveBottomWaypointScrollTop = () => {
    if (this._bottomWaypoint) {
      const node = ReactDom.findDOMNode(this._bottomWaypoint)
      if (node) {
        this._bottomWaypointScrollTop = node.offsetTop
        console.log('aaa bottomwaypoint top was loadmore: ', this._bottomWaypointScrollTop)
      }
    }
  }

  _restoreBottomWaypointScrollTop = () => {
    const restore = context => {
      // TODO maybe contorl w/ isMounted
      if (this._bottomWaypoint && this._scrollableRef) {
        const node = ReactDom.findDOMNode(this._bottomWaypoint)
        if (node) {
          let now = node.offsetTop
          console.log('aaa bottomwaypoint top is now: ', now, context)
          const diff = now - this._bottomWaypointScrollTop
          console.log('aaa bottomwaypoint dif: ', diff, context)
          const newScrollTop = /* this._scrollableRef.scrollTop + */ diff
          console.log('aaa bott apply diff')
          // try 5 frames to settle down
          const tryApply = triesLeft => {
            if (triesLeft <= 0) {
              return
            }
            console.log('aaa bott tryApply try: ', triesLeft)
            window.requestAnimationFrame(() => {
              this._scrollableRef.scrollTop = newScrollTop
              console.log(
                'aaa bottomwaypoint top is now adjusted setimmediate: ',
                now,
                context,
                this._scrollableRef.scrollTop
              )
              window.requestAnimationFrame(() => {
                if (this._scrollableRef.scrollTop !== newScrollTop) {
                  console.log('aaa bottom next loop', this._scrollableRef.scrollTop, newScrollTop)
                  tryApply(triesLeft - 1)
                }
              })
            })
          }
          tryApply(5)
          // var triesLeft = 5
          // window.requestAnimationFrame(() => {
          // this._scrollableRef.scrollTop = newScrollTop
          // console.log(
          // 'aaa bottomwaypoint top is now adjusted setimmediate: ',
          // now,
          // context,
          // this._scrollableRef.scrollTop
          // )
          // window.requestAnimationFrame(() => {
          // })
          // })
          this._scrollableRef.scrollTop = newScrollTop
          now = node.offsetTop
          console.log('aaa bottomwaypoint top is now adjusted: ', now, context, this._scrollableRef.scrollTop)
        }
      }
    }
    restore('first')
    // setTimeout(restore, 1000)
  }

  // _oldScrollHeight = 0
  componentWillUpdate(prevProps: Props, prevState: State) {
    console.log('aaa bottomwaypoint will update', prevProps, this.props, prevState, this.state)
    this._dump('WILL update')
    // if (this._scrollableRef) {
    // this._oldScrollHeight = this._scrollableRef.scrollHeight
    // console.log(
    // 'willtop:',
    // this._scrollableRef.scrollTop,
    // 'scrollH: ',
    // this._scrollableRef.scrollHeight,
    // 'clientH',
    // this._scrollableRef.clientHeight
    // )
    // } else {
    // this._oldScrollHeight = 0
    // }
    //
    //
    //
    //
  }
  // _adjustScroll = false
  componentDidUpdate(prevProps: Props, prevState: State) {
    console.log('aaa bottomwaypoint did update', prevProps, this.props, prevState, this.state)
    this._dump('DID update')
    // this._adjustScroll = true
    // if (this._scrollableRef) {
    // console.log(
    // 'didtop:',
    // this._scrollableRef.scrollTop,
    // 'scrollH: ',
    // this._scrollableRef.scrollHeight,
    // 'clientH',
    // this._scrollableRef.clientHeight
    // )
    // // console.log('top: oldh: ', this._oldScrollHeight)
    // // this._scrollableRef.scrollTop = this._scrollableRef.scrollHeight - this._oldScrollHeight
    // }
    // this._oldScrollHeight = 0
    // Force a rerender if we passed a row to scroll to. If it's kept around the virutal list gets confused so we only want it to render once basically
    // if (this._keepIdxVisible !== -1) {
    // this.setState(prevState => ({listRerender: prevState.listRerender + 1})) // eslint-disable-line react/no-did-update-set-state
    // this._keepIdxVisible = -1
    // }
    // this._lastRowIdx = -1 // always reset this to be safe
    // if (this.props.editingOrdinal && this.props.editingOrdinal !== prevProps.editingOrdinal) {
    // const idx = this.props.messageOrdinals.indexOf(this.props.editingOrdinal)
    // if (idx !== -1) {
    // this._ignoreScrollUpTill = Date.now() + 1000
    // this._list && this._list.scrollToRow(idx)
    // }
    // }
    if (this._isLockedToBottom && this._scrollableRef) {
      console.log('aaa botto LOCKING')
      this._scrollableRef.scrollTop = this._scrollableRef.scrollHeight
    } else if (this._bottomWaypoint && this._scrollableRef) {
      this._restoreBottomWaypointScrollTop()
    }
  }

  componentWillReceiveProps(nextProps: Props) {
    if (this.props.conversationIDKey !== nextProps.conversationIDKey) {
      // this._cellCache.clearAll()
      // this.setState({isLockedToBottom: true})
      this._isLockedToBottom = true
    }
    // if (this.props.messageOrdinals.size !== nextProps.messageOrdinals.size) {
    // if (this.props.messageOrdinals.size > 1 && this._lastRowIdx !== -1) {
    // const toFind = this.props.messageOrdinals.get(this._lastRowIdx)
    // this._keepIdxVisible = toFind ? nextProps.messageOrdinals.indexOf(toFind) : -1
    // }
    // // Force the grid to throw away its local index based cache. There might be a lighterway to do this but
    // // this seems to fix the overlap problem. The cellCache has correct values inside it but the list itself has
    // // another cache from row -> style which is out of sync
    // this._cellCache.clearAll()
    // this._list && this._list.Grid && this._list.recomputeRowHeights(0)
    // }
  }

  // _updateBottomLock = (clientHeight: number, scrollHeight: number, scrollTop: number) => {
  // meaningless otherwise
  // if (clientHeight) {
  // const isLockedToBottom = scrollTop + clientHeight >= scrollHeight - lockedToBottomSlop
  // if (this.state.isLockedToBottom !== isLockedToBottom) {
  // this.setState({isLockedToBottom})
  // }
  // }
  // }

  // _maybeLoadMoreMessages = debounce((clientHeight: number, scrollHeight: number, scrollTop: number) => {
  // if (clientHeight && scrollHeight && scrollTop <= 20) {
  // const now = Date.now()
  // if (!this._ignoreScrollUpTill || this._ignoreScrollUpTill < now) {
  // this._ignoreScrollUpTill = 0
  // this.props.loadMoreMessages()
  // } else {
  // console.log('skipping due to ignoreScrollUpTill')
  // }
  // }
  // }, 500)

  // _onScroll = ({clientHeight, scrollHeight, scrollTop}) => {
  // this._updateBottomLock(clientHeight, scrollHeight, scrollTop)
  // this._maybeLoadMoreMessages(clientHeight, scrollHeight, scrollTop)
  // }

  // _onResize = ({width}) => {
  // if (this._cellCache.columnWidth({index: 0}) !== width) {
  // this._cellCache.clearAll()
  // }
  // }

  // _rowRenderer = ({index, isScrolling, isVisible, key, parent, style}) => {
  // const ordinal = this.props.messageOrdinals.get(index)
  // const prevOrdinal = index > 0 ? this.props.messageOrdinals.get(index - 1) : null
  // return (
  // <Virtualized.CellMeasurer
  // cache={this._cellCache}
  // columnIndex={0}
  // key={key}
  // parent={parent}
  // rowIndex={index}
  // >
  // {({measure}) => (
  // <div style={style}>
  // <Message
  // ordinal={ordinal}
  // previous={prevOrdinal}
  // measure={measure}
  // conversationIDKey={this.props.conversationIDKey}
  // />
  // </div>
  // )}
  // </Virtualized.CellMeasurer>
  // )
  // }

  // _onCopyCapture(e) {
  // // Copy text only, not HTML/styling.
  // e.preventDefault()
  // clipboard.writeText(window.getSelection().toString())
  // }

  // _handleListClick = () => {
  // if (window.getSelection().isCollapsed) {
  // this.props.onFocusInput()
  // }
  // }

  // _onRowsRendered = ({stopIndex}: {stopIndex: number}) => {
  // this._lastRowIdx = stopIndex
  // }

  // _setListRef = (r: any) => {
  // this._list = r
  // }
  //
  _scrollableRef: any
  _setScrollableRef = r => {
    this._scrollableRef = r

    // if (this.state.isLockedToBottom && this._scrollableRef) {
    if (this._isLockedToBottom && this._scrollableRef) {
      console.log('aaa bott NEW SCROOL REF')
      this._scrollableRef.scrollTop = this._scrollableRef.scrollHeight
    }
  }

  _loadMoreLast = 0
  // _loadMoreLast = {}
  _waypointTopOnEnter = data => {
    console.log('aaa top load more messages')
    const loadMoreLast = Date.now()
    // const loadMoreLast = {
    // now: Date.now(),
    // ordinal: this.props.messageOrdinals.first(),
    // }

    // already requested this same load too quickly?
    // if (
    // this._loadMoreLast.ordinal === loadMoreLast.ordinal &&
    // loadMoreLast.now - this._loadMoreLast.now < 2000
    // ) {
    if (loadMoreLast - this._loadMoreLast < 1000) {
      console.log('aaa bottom load too quick')
      return
    }

    this._loadMoreLast = loadMoreLast
    this._saveBottomWaypointScrollTop()
    /// bbb the call
    this.props.loadMoreMessages()
  }
  _waypointBottomOnEnter = data => {
    console.log('aaa bottom locked')
    // this.setState({isLockedToBottom: true})
    this._isLockedToBottom = true
  }
  _waypointBottomOnLeave = data => {
    console.log('aaa bottom unlocked')
    this._isLockedToBottom = false
    // this.setState({isLockedToBottom: false})
  }
  _waypointMessageOnEnter = (data, key) => {
    console.log('aaa message enter', key, data)
    // if (key === this._topKey) {
    // console.log('aaa message enter TOP KEY', key, data)
    // }
  }
  _waypointMessageOnLeave = (data, key) => {
    console.log('aaa message leave', key, data)
    // if (key === this._topKey) {
    // console.log('aaa message leave TOP KEY', key, data)
    // }
  }

  _makeWaypointMessage = (key, children) => (
    <Waypoint
      key={`waypoint: ${key}`}
      onEnter={data => this._waypointMessageOnEnter(data, key)}
      onLeave={data => this._waypointMessageOnLeave(data, key)}
    >
      <div>{children}</div>
    </Waypoint>
  )

  // _topKey: any = null
  // _lastSyncPos = null
  // _onSyncPositionChange = ({waypointTop}) => {
  // console.log('aaa on sync chnaged', waypointTop)

  // if (this._adjustScroll) {
  // console.log('aaa adjusting scroll pos cur: ', waypointTop, ' last: ', this._lastSyncPos)
  // this._adjustScroll = false
  // if (this._scrollableRef) {
  // this._scrollableRef.scrollTop = waypointTop - this._lastSyncPos
  // }
  // this._lastSyncPos = 0
  // }
  // this._lastSyncPos = waypointTop
  // }

  _bottomWaypoint = null
  _setBottomWaypoint = r => {
    console.log('aaa set bottom', r)
    this._bottomWaypoint = r
  }

  _debugOnce = false
  _dump = context => {
    if (this._bottomWaypoint && this._scrollableRef) {
      // const nodes = this._scrollableRef.childNodes[1].childNodes
      // const sizes = []
      // for (var node of nodes) {
      // sizes.push(node.offsetTop)
      // }
      // console.log('aaa bottom', sizes)
      const node = ReactDom.findDOMNode(this._bottomWaypoint)
      if (node) {
        const now = node.offsetTop
        console.log('aaa bottomwaypoint top DEBUG now: ', now, context)
        console.log(
          'aaa bottomwaypoint top DEBUG scrollable: ',
          context,
          'top:',
          this._scrollableRef.scrollTop,
          'scrollH: ',
          this._scrollableRef.scrollHeight,
          'clientH',
          this._scrollableRef.clientHeight
        )
      }
    }
  }
  _debugDUMP = () => {
    if (this._debugOnce) {
      return
    }
    this._debugOnce = true
    setInterval(this._dump, 1000)
  }

  render() {
    this._debugDUMP()

    // this._topKey = null
    const rowCount = this.props.messageOrdinals.size + (this.props.hasExtraRow ? 1 : 0)

    const rows = []
    rows.push(
      <Waypoint key="waypointTop" topOffset={0} onEnter={this._waypointTopOnEnter}>
        <div style={{backgroundColor: 'red', height: 1, width: '100%'}} />
      </Waypoint>
    )

    let waypointChildren = []
    // let syncWaypoint = null
    let messageKey
    for (var index = 0; index < rowCount; ++index) {
      const ordinal = this.props.messageOrdinals.get(index)
      const prevOrdinal = index > 0 ? this.props.messageOrdinals.get(index - 1) : null
      messageKey = ordinal

      waypointChildren.push(
        <Message
          key={ordinal}
          ordinal={ordinal}
          previous={prevOrdinal}
          measure={null}
          conversationIDKey={this.props.conversationIDKey}
        />
      )

      if (ordinal % 10 === 0) {
        rows.push(this._makeWaypointMessage(messageKey, waypointChildren))
        // TODO maybeget rid of this
        // if (!this._topKey) {
        // this._topKey = messageKey

        // console.log('aaa message create TOP KEY', messageKey)
        // }

        // if (!syncWaypoint) {
        // syncWaypoint = (
        // <Waypoint key="waypointSync" topOffset={0} onPositionChange={this._onSyncPositionChange}>
        // <div style={{width: '100%', height: 10, backgroundColor: 'purple'}} />
        // </Waypoint>
        // )
        // rows.push(syncWaypoint)
        // }
        waypointChildren = []
      }
    }

    // leftovers
    if (waypointChildren.length > 0) {
      rows.push(this._makeWaypointMessage(messageKey, waypointChildren))
    }

    rows.push(
      <Waypoint
        ref={this._setBottomWaypoint}
        key="waypointBottom"
        bottomOffset={0}
        onEnter={this._waypointBottomOnEnter}
        onLeave={this._waypointBottomOnLeave}
      >
        <div style={{backgroundColor: 'yellow', height: 10, width: '100%'}} />
      </Waypoint>
    )

    return (
      <div
        style={containerStyle}
        onClick={this._handleListClick}
        onCopyCapture={this._onCopyCapture}
        ref={this._setScrollableRef}
      >
        <style>{realCSS}</style>
        <div>{rows}</div>
      </div>
    )
    // const scrollToIndex = this.state.isLockedToBottom ? rowCount - 1 : this._keepIdxVisible

    // return (
    // <ErrorBoundary>
    // <div style={containerStyle} onClick={this._handleListClick} onCopyCapture={this._onCopyCapture}>
    // <style>{realCSS}</style>
    // <Virtualized.AutoSizer onResize={this._onResize}>
    // {({height, width}) => (
    // <Virtualized.List
    // conversationIDKey={this.props.conversationIDKey}
    // listRerender={this.state.listRerender}
    // columnWidth={width}
    // deferredMeasurementCache={this._cellCache}
    // height={height}
    // onScroll={this._onScroll}
    // onRowsRendered={this._onRowsRendered}
    // ref={this._setListRef}
    // rowCount={rowCount}
    // rowHeight={this._cellCache.rowHeight}
    // rowRenderer={this._rowRenderer}
    // scrollToAlignment="end"
    // scrollToIndex={scrollToIndex}
    // style={listStyle}
    // width={width}
    // />
    // )}
    // </Virtualized.AutoSizer>
    // </div>
    // </ErrorBoundary>
    // )
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
  overflowX: 'hidden',
  overflowY: 'auto',
  position: 'relative',
}

// const listStyle = {
// outline: 'none',
// overflowX: 'hidden',
// }

export default Thread
