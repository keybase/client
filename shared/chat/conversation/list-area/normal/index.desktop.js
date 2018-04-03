// @flow
// An infinite scrolling chat list. Using react-virtualized which doesn't really handle this case out of the box.
import * as Virtualized from 'react-virtualized'
import * as React from 'react'
import Message from '../../messages'
import SpecialTopMessage from '../../messages/special-top-message'
import SpecialBottomMessage from '../../messages/special-bottom-message'
import {ErrorBoundary} from '../../../../common-adapters'
import clipboard from '../../../../desktop/clipboard'
import debounce from 'lodash/debounce'
import {globalColors, globalStyles} from '../../../../styles'

import type {Props} from '.'

type State = {
  isLockedToBottom: boolean,
  listRerender: number,
}

const lockedToBottomSlop = 20

class Thread extends React.Component<Props, State> {
  _cellCache = new Virtualized.CellMeasurerCache({
    fixedWidth: true,
    keyMapper: (rowIndex: number) => this.props.messageOrdinals.get(rowIndex),
  })

  _list: any
  _keepIdxVisible: number = -1
  _lastRowIdx: number = -1
  // ScrolltoRow sometimes triggers load more. This'll all go away when we ditch react-virtualized. for now this fixes
  // if you edit your last message that'l cause a load more sometimes due to scrolltop being 0 incorrectly
  _ignoreScrollUpTill: number = 0

  state = {
    isLockedToBottom: true,
    listRerender: 0,
    selectedMessageKey: null,
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
    // Force a rerender if we passed a row to scroll to. If it's kept around the virutal list gets confused so we only want it to render once basically
    if (this._keepIdxVisible !== -1) {
      this.setState(prevState => ({listRerender: prevState.listRerender + 1})) // eslint-disable-line react/no-did-update-set-state
      this._keepIdxVisible = -1
    }
    this._lastRowIdx = -1 // always reset this to be safe

    if (this.props.editingOrdinal && this.props.editingOrdinal !== prevProps.editingOrdinal) {
      const idx = this.props.messageOrdinals.indexOf(this.props.editingOrdinal)
      if (idx !== -1) {
        this._ignoreScrollUpTill = Date.now() + 1000
        this._list && this._list.scrollToRow(idx)
      }
    }
  }

  componentWillReceiveProps(nextProps: Props) {
    if (this.props.conversationIDKey !== nextProps.conversationIDKey) {
      this._cellCache.clearAll()
      this.setState({isLockedToBottom: true})
    }

    if (this.props.messageOrdinals.size !== nextProps.messageOrdinals.size) {
      if (this.props.messageOrdinals.size > 1 && this._lastRowIdx !== -1) {
        const toFind = this.props.messageOrdinals.get(this._lastRowIdx)
        this._keepIdxVisible = toFind ? nextProps.messageOrdinals.indexOf(toFind) : -1
      }
      // Force the grid to throw away its local index based cache. There might be a lighterway to do this but
      // this seems to fix the overlap problem. The cellCache has correct values inside it but the list itself has
      // another cache from row -> style which is out of sync
      this._cellCache.clearAll()
      this._list && this._list.Grid && this._list.recomputeRowHeights(0)
    }
  }

  _updateBottomLock = (clientHeight: number, scrollHeight: number, scrollTop: number) => {
    // meaningless otherwise
    if (clientHeight) {
      const isLockedToBottom = scrollTop + clientHeight >= scrollHeight - lockedToBottomSlop
      if (this.state.isLockedToBottom !== isLockedToBottom) {
        this.setState({isLockedToBottom})
      }
    }
  }

  _maybeLoadMoreMessages = debounce((clientHeight: number, scrollHeight: number, scrollTop: number) => {
    if (clientHeight && scrollHeight && scrollTop <= 20) {
      const now = Date.now()
      if (!this._ignoreScrollUpTill || this._ignoreScrollUpTill < now) {
        this._ignoreScrollUpTill = 0
        this.props.loadMoreMessages()
      } else {
        console.log('skipping due to ignoreScrollUpTill')
      }
    }
  }, 500)

  _onScroll = ({clientHeight, scrollHeight, scrollTop}) => {
    this._updateBottomLock(clientHeight, scrollHeight, scrollTop)
    this._maybeLoadMoreMessages(clientHeight, scrollHeight, scrollTop)
  }

  _onResize = ({width}) => {
    if (this._cellCache.columnWidth({index: 0}) !== width) {
      this._cellCache.clearAll()
    }
  }

  _rowRenderer = ({index, isScrolling, isVisible, key, parent, style}) => {
    const isSpecialTopMessage = index === 0
    const isSpecialBottomMessage = isSpecialTopMessage ? index === this.props.messageOrdinals.size : false
    const isOrdinalMessage = !isSpecialBottomMessage && !isSpecialTopMessage
    const ordinalIndex = index - 1
    const ordinal = isOrdinalMessage ? this.props.messageOrdinals.get(ordinalIndex) : null
    const prevOrdinal =
      isOrdinalMessage && ordinalIndex > 0 ? this.props.messageOrdinals.get(ordinalIndex - 1) : null
    return (
      <Virtualized.CellMeasurer
        cache={this._cellCache}
        columnIndex={0}
        key={key}
        parent={parent}
        rowIndex={index}
      >
        {({measure}) => {
          let contents

          if (isSpecialTopMessage) {
            contents = (
              <SpecialTopMessage conversationIDKey={this.props.conversationIDKey} measure={measure} />
            )
          } else if (isSpecialBottomMessage) {
            contents = (
              <SpecialBottomMessage conversationIDKey={this.props.conversationIDKey} measure={measure} />
            )
          } else if (typeof ordinal === 'number') {
            contents = (
              <Message
                ordinal={ordinal}
                previous={prevOrdinal}
                measure={measure}
                conversationIDKey={this.props.conversationIDKey}
              />
            )
          }

          return <div style={style}>{contents}</div>
        }}
      </Virtualized.CellMeasurer>
    )
  }

  _onCopyCapture(e) {
    // Copy text only, not HTML/styling.
    e.preventDefault()
    clipboard.writeText(window.getSelection().toString())
  }

  _handleListClick = () => {
    if (window.getSelection().isCollapsed) {
      this.props.onFocusInput()
    }
  }

  _onRowsRendered = ({stopIndex}: {stopIndex: number}) => {
    this._lastRowIdx = stopIndex
  }

  _setListRef = (r: any) => {
    this._list = r
  }

  render() {
    const rowCount = this.props.messageOrdinals.size + 2 // extra rows on top and bottom
    const scrollToIndex = this.state.isLockedToBottom ? rowCount - 1 : this._keepIdxVisible

    return (
      <ErrorBoundary>
        <div style={containerStyle} onClick={this._handleListClick} onCopyCapture={this._onCopyCapture}>
          <style>{realCSS}</style>
          <Virtualized.AutoSizer onResize={this._onResize}>
            {({height, width}) => (
              <Virtualized.List
                conversationIDKey={this.props.conversationIDKey}
                listRerender={this.state.listRerender}
                columnWidth={width}
                deferredMeasurementCache={this._cellCache}
                height={height}
                onScroll={this._onScroll}
                onRowsRendered={this._onRowsRendered}
                ref={this._setListRef}
                rowCount={rowCount}
                rowHeight={this._cellCache.rowHeight}
                rowRenderer={this._rowRenderer}
                scrollToAlignment="end"
                scrollToIndex={scrollToIndex}
                style={listStyle}
                width={width}
              />
            )}
          </Virtualized.AutoSizer>
        </div>
      </ErrorBoundary>
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
