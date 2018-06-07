// @flow
// An infinite scrolling chat list. Using react-virtualized which doesn't really handle this case out of the box.
import * as Virtualized from 'react-virtualized'
import * as React from 'react'
import Message from '../../messages'
import SpecialTopMessage from '../../messages/special-top-message'
import SpecialBottomMessage from '../../messages/special-bottom-message'
import {ErrorBoundary} from '../../../../common-adapters'
import {copyToClipboard} from '../../../../util/clipboard'
import {debounce} from 'lodash-es'
import {globalColors, globalStyles} from '../../../../styles'

import type {Props} from '.'

const lockedToBottomSlop = 20

type State = {
  isLockedToBottom: boolean, // MUST be in state else virtualized will re-render itself and will jump down w/o us re-rendering
}

class Thread extends React.Component<Props, State> {
  state = {isLockedToBottom: true}

  _cellCache = new Virtualized.CellMeasurerCache({
    fixedWidth: true,
    keyMapper: (index: number) => {
      const itemCountIncludingSpecial = this._getItemCount()
      if (index === itemCountIncludingSpecial - 1) {
        return 'specialBottom'
      } else if (index === 0) {
        return 'specialTop'
      } else {
        const ordinalIndex = index - 1
        return this.props.messageOrdinals.get(ordinalIndex)
      }
    },
  })

  _list: any

  componentDidUpdate(prevProps: Props) {
    if (this.props.conversationIDKey !== prevProps.conversationIDKey) {
      this._cellCache.clearAll()
      this.setState({isLockedToBottom: true})
      return
    }

    if (this.props.listScrollDownCounter !== prevProps.listScrollDownCounter) {
      this.setState({isLockedToBottom: true})
    }

    // Did we prepend?
    if (this.props.messageOrdinals.first() !== prevProps.messageOrdinals.first()) {
      if (this.props.messageOrdinals.size !== prevProps.messageOrdinals.size) {
        // Force the grid to throw away its local index based cache. There might be a lighterway to do this but
        // this seems to fix the overlap problem. The cellCache has correct values inside it but the list itself has
        // another cache from row -> style which is out of sync
        this._cellCache.clearAll()
        this._list && this._list.Grid && this._list.recomputeRowHeights(0)
      }

      if (this._list) {
        // try and maintain scroll position, doens't work great
        if (prevProps.messageOrdinals.size > 1) {
          const toFind = prevProps.messageOrdinals.first()
          if (toFind === this.props.lastLoadMoreOrdinal) {
            const idx = toFind ? this.props.messageOrdinals.indexOf(toFind) : -1
            if (idx !== -1) {
              const scrollToIdx = idx + 1
              this._list.scrollToRow(scrollToIdx)
            }
          }
        }
      }
    }

    if (this.props.editingOrdinal && this.props.editingOrdinal !== prevProps.editingOrdinal) {
      const idx = this.props.messageOrdinals.indexOf(this.props.editingOrdinal)
      if (idx !== -1) {
        this._list && this._list.scrollToRow(idx + 1)
      }
    }
  }
  // we MUST debounce else this callbacks happens a bunch and we're switch back and forth as you submit
  _updateBottomLock = debounce((clientHeight: number, scrollHeight: number, scrollTop: number) => {
    // meaningless otherwise
    if (clientHeight) {
      this.setState(prevState => {
        const isLockedToBottom = scrollTop + clientHeight >= scrollHeight - lockedToBottomSlop
        return isLockedToBottom !== prevState.isLockedToBottom ? {isLockedToBottom} : null
      })
    }
  }, 100)

  _maybeLoadMoreMessages = debounce((clientHeight: number, scrollHeight: number, scrollTop: number) => {
    if (clientHeight && scrollHeight && scrollTop <= 20) {
      this.props.loadMoreMessages(this.props.messageOrdinals.first())
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

  _getItemCount = () => this.props.messageOrdinals.size + 2

  _rowRenderer = ({index, isScrolling, isVisible, key, parent, style}) => {
    return (
      <Virtualized.CellMeasurer
        cache={this._cellCache}
        columnIndex={0}
        key={key}
        parent={parent}
        rowIndex={index}
      >
        {({measure}) => {
          const itemCountIncludingSpecial = this._getItemCount()
          let content = <div />
          if (index === itemCountIncludingSpecial - 1) {
            content = (
              <SpecialBottomMessage conversationIDKey={this.props.conversationIDKey} measure={measure} />
            )
          } else if (index === 0) {
            content = <SpecialTopMessage conversationIDKey={this.props.conversationIDKey} measure={measure} />
          } else {
            const ordinalIndex = index - 1
            const ordinal = this.props.messageOrdinals.get(ordinalIndex)
            if (ordinal) {
              const prevOrdinal = ordinalIndex > 0 ? this.props.messageOrdinals.get(ordinalIndex - 1) : null
              content = (
                <Message
                  ordinal={ordinal}
                  previous={prevOrdinal}
                  measure={measure}
                  conversationIDKey={this.props.conversationIDKey}
                />
              )
            }
          }
          return <div style={style}>{content}</div>
        }}
      </Virtualized.CellMeasurer>
    )
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

  _setListRef = (r: any) => {
    this._list = r
  }

  render() {
    const rowCount = this._getItemCount()
    const scrollToIndex = this.state.isLockedToBottom ? rowCount - 1 : undefined

    return (
      <ErrorBoundary>
        <div style={containerStyle} onClick={this._handleListClick} onCopyCapture={this._onCopyCapture}>
          <style>{realCSS}</style>
          <Virtualized.AutoSizer onResize={this._onResize}>
            {({height, width}) => (
              <Virtualized.List
                conversationIDKey={this.props.conversationIDKey}
                columnWidth={width}
                deferredMeasurementCache={this._cellCache}
                height={height}
                onScroll={this._onScroll}
                ref={this._setListRef}
                rowCount={rowCount}
                rowHeight={this._cellCache.rowHeight}
                rowRenderer={this._rowRenderer}
                scrollToAlignment="start"
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
