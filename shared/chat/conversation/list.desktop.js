// @flow
// An infinite scrolling chat list. Using react-virtualized which doesn't really handle this case out of the box.
// We control which set of messages we render in our state object.
// We load that in in our constructor, after you stop scrolling or if we get an update and we're not currently scrolling.

import EditPopup from './edit-popup.desktop'
import LoadingMore from './messages/loading-more'
import React, {Component} from 'react'
import ReactDOM from 'react-dom'
import _ from 'lodash'
import messageFactory from './messages'
import shallowEqual from 'shallowequal'
import {AutoSizer, CellMeasurer, List as VirtualizedList, defaultCellMeasurerCellSizeCache as DefaultCellMeasurerCellSizeCache} from 'react-virtualized'
import {Icon} from '../../common-adapters'
import {TextPopupMenu, AttachmentPopupMenu} from './messages/popup'
import {clipboard} from 'electron'
import {globalColors, globalStyles} from '../../styles'

import type {List} from 'immutable'
import type {Message, MessageID, TextMessage, AttachmentMessage} from '../../constants/chat'
import type {Props} from './list'

type State = {
  isLockedToBottom: boolean,
  isScrolling: boolean,
  messages: List<Message>,
  scrollTop: number,
  selectedMessageID?: MessageID,
}

const scrollbarWidth = 20
const lockedToBottomSlop = 20
const listBottomMargin = 10
const cellMessageStartIndex = 2 // Header and loading cells
const DEBUG_ROW_RENDER = __DEV__ && false

class ConversationList extends Component<void, Props, State> {
  _cellCache: any;
  _cellMeasurer: any;
  _list: any;
  state: State;
  _toRemeasure: Array<number>;
  _shouldForceUpdateGrid: boolean;
  _lastWidth: ?number;

  constructor (props: Props) {
    super(props)

    this.state = {
      isLockedToBottom: true,
      isScrolling: false,
      messages: props.messages,
      scrollTop: 0,
    }

    this._cellCache = new DefaultCellMeasurerCellSizeCache({
      uniformColumnWidth: true,
      uniformRowHeight: false,
    })
    this._toRemeasure = []
    this._shouldForceUpdateGrid = false

    this._setupDebug()
  }

  _setupDebug () {
    if (__DEV__ && typeof window !== 'undefined') {
      window.dumpChat = (...columns) => {
        console.table(this.state.messages.toJS().map(m => ({
          ...m,
          decoded: m.message && m.message.stringValue(),
        })), columns.length && columns)
      }
    }
  }

  shouldComponentUpdate (nextProps: Props, nextState: State) {
    return !shallowEqual(this.props, nextProps) || !shallowEqual(this.state, nextState)
  }

  componentWillUnmount () {
    // Stop any throttled/debounced functions
    this._onScroll.cancel()
    this._recomputeListDebounced.cancel()
    this._onScrollSettled.cancel()
  }

  componentWillUpdate (nextProps: Props, nextState: State) {
    // If a message has moved from pending to sent, tell the List to discard
    // heights for it (which will re-render it and everything after it)
    // TODO this doesn't work for things that take a bit to load (imgs)
    if (this._toRemeasure.length) {
      this._toRemeasure.forEach(item => {
        this._cellCache.clearRowHeight(item)
        this._list && this._list.recomputeRowHeights(item)
      })
      this._toRemeasure = []
    }

    if (this._shouldForceUpdateGrid) {
      this._shouldForceUpdateGrid = false
      this._list && this._list.forceUpdateGrid()
    }
  }

  componentDidUpdate (prevProps: Props, prevState: State) {
    if ((this.props.selectedConversation !== prevProps.selectedConversation) ||
        (this.state.messages !== prevState.messages)) {
      this.state.isLockedToBottom && this._scrollToBottom()
    }

    if (this.state.messages !== prevState.messages && prevState.messages.count() > 1) {
      // Figure out how many new items we have
      const prependedCount = this.state.messages.indexOf(prevState.messages.first())
      if (prependedCount !== -1) {
        // Measure the new items so we can adjust our scrollTop so your position doesn't jump
        const scrollTop = this.state.scrollTop + _.range(0, prependedCount)
          .map(index => this._cellMeasurer.getRowHeight({index: index + cellMessageStartIndex}))
          .reduce((total, height) => total + height, 0)

        // Disabling eslint as we normally don't want to call setState in a componentDidUpdate in case you infinitely re-render
        this.setState({scrollTop}) // eslint-disable-line react/no-did-update-set-state
      }
    }
  }

  componentWillReceiveProps (nextProps: Props) {
    if (this.props.selectedConversation !== nextProps.selectedConversation) {
      this.setState({isLockedToBottom: true})
      this._recomputeList()
    }

    const willScrollDown = nextProps.listScrollDownState !== this.props.listScrollDownState

    if (!this.state.isScrolling || willScrollDown || this.state.isLockedToBottom) {
      this._updateInternalMessages(nextProps)
    }

    if (willScrollDown) {
      this.setState({isLockedToBottom: true})
    }

    if (this.props.moreToLoad !== nextProps.moreToLoad) {
      this._shouldForceUpdateGrid = true
    }
  }

  _invalidateChangedMessages (props: Props) {
    this.state.messages.forEach((item, index) => {
      const oldMessage = props.messages.get(index, {})

      if (item.type === 'Text' && oldMessage.type === 'Text' &&
        (item.messageState !== oldMessage.messageState ||
        item.editedCount !== oldMessage.editedCount)
      ) {
        this._toRemeasure.push(index + cellMessageStartIndex)
      } else if (item.type === 'Attachment' && oldMessage.type === 'Attachment' &&
                 (item.previewPath !== oldMessage.previewPath ||
                  !shallowEqual(item.previewSize, oldMessage.previewSize))) {
        this._toRemeasure.push(index + cellMessageStartIndex)
      } else if (!shallowEqual(item, oldMessage)) {
        this._shouldForceUpdateGrid = true
      }
    })
  }

  _updateInternalMessages = (props: Props) => {
    if (props.messages !== this.state.messages) {
      this._invalidateChangedMessages(props)
      this.setState({
        messages: props.messages,
      })
    }
  }

  _onScrollSettled = _.debounce(() => {
    // If we've stopped scrolling let's update our internal messages
    this._updateInternalMessages(this.props)
    this.setState({
      isScrolling: false,
    })
  }, 1000)

  _onScroll = _.throttle(({clientHeight, scrollHeight, scrollTop}) => {
    // Do nothing if we haven't really loaded anything
    if (!clientHeight) {
      return
    }

    // At the top, load more messages. Action handles loading state and if there's actually any more
    if (scrollTop === 0) {
      this.props.onLoadMoreMessages()
    }

    // Lock to bottom if we are close to the bottom
    const isLockedToBottom = scrollTop + clientHeight >= scrollHeight - lockedToBottomSlop
    this.setState({
      isLockedToBottom,
      isScrolling: true,
      scrollTop,
    })

    // This is debounced so it resets the call
    this._onScrollSettled()
  }, 200)

  _hidePopup = () => {
    ReactDOM.unmountComponentAtNode(document.getElementById('popupContainer'))
    this.setState({
      selectedMessageID: undefined,
    })
  }

  _renderPopup (message: Message, style: Object, messageRect: any): ?React$Element<any> {
    switch (message.type) {
      case 'Text':
        return (
          <TextPopupMenu
            you={this.props.you}
            message={message}
            onShowEditor={(message: TextMessage) => this._showEditor(message, messageRect)}
            onDeleteMessage={this.props.onDeleteMessage}
            onLoadAttachment={this.props.onLoadAttachment}
            onOpenInFileUI={this.props.onOpenInFileUI}
            onHidden={this._hidePopup}
            style={style}
          />
        )
      case 'Attachment':
        const {downloadedPath, filename, messageID} = message
        return (
          <AttachmentPopupMenu
            you={this.props.you}
            message={message}
            onDeleteMessage={this.props.onDeleteMessage}
            onDownloadAttachment={() => { messageID && filename && this.props.onLoadAttachment(messageID, filename) }}
            onOpenInFileUI={() => { downloadedPath && this.props.onOpenInFileUI(downloadedPath) }}
            onHidden={this._hidePopup}
            style={style}
          />
        )
    }
  }

  _showEditor = (message: TextMessage, messageRect: any) => {
    const popupComponent = (
      <EditPopup
        messageRect={messageRect}
        onClose={this._hidePopup}
        message={message.message.stringValue()}
        onSubmit={text => { this.props.onEditMessage(message, text) }}
      />
    )

    // Have to do this cause it's triggered from a popup that we're reusing else we'll get unmounted
    setImmediate(() => {
      const container = document.getElementById('popupContainer')
      // FIXME: this is the right way to render portals retaining context for now, though it will change in the future.
      ReactDOM.unstable_renderSubtreeIntoContainer(this, popupComponent, container)
    })
  }

  _findMessageFromDOMNode (start: any) : any {
    let current = start
    while (current) {
      if (current.matches('.message')) {
        return current
      }
      current = current.parentNode
    }

    return null
  }

  _showPopup (message: TextMessage | AttachmentMessage, event: any) {
    const clientRect = event.target.getBoundingClientRect()

    const messageNode = this._findMessageFromDOMNode(event.target)
    const messageRect = messageNode && this._domNodeToRect(messageNode)
    // Position next to button (client rect)
    // TODO: Measure instead of pixel math
    const x = clientRect.left - 205
    let y = clientRect.top - (message.author === this.props.you ? 200 : 116)
    if (y < 10) y = 10

    const popupComponent = this._renderPopup(message, {left: x, position: 'absolute', top: y}, messageRect)
    if (!popupComponent) return

    this.setState({
      selectedMessageID: message.messageID,
    })

    const container = document.getElementById('popupContainer')
    // FIXME: this is the right way to render portals retaining context for now, though it will change in the future.
    ReactDOM.unstable_renderSubtreeIntoContainer(this, popupComponent, container)
  }

  _onAction = (message, event) => {
    if (message.type === 'Text' || message.type === 'Attachment') {
      this._showPopup(message, event)
    }
  }

  _onResize = ({width}) => {
    if (width !== this._lastWidth) {
      this._lastWidth = width
      this._recomputeListDebounced()
    }
  }

  _cellRenderer = ({rowIndex, ...rest}) => {
    return this._rowRenderer({index: rowIndex, ...rest})
  }

  _rowRenderer = ({index, key, style, isScrolling}: {index: number, key: string, style: Object, isScrolling: boolean}) => {
    if (__DEV__ && DEBUG_ROW_RENDER && style) {
      style = {
        ...style,
        backgroundColor: '#' + ((1 << 24) * Math.random() | 0).toString(16),
        overflow: 'hidden',
      }
    }

    if (index === 0) {
      return (
        <div key={key || index} style={{...globalStyles.flexBoxColumn, alignItems: 'center', flex: 1, justifyContent: 'center', height: 116}}>
          {!this.props.moreToLoad && <Icon type='icon-secure-266' />}
        </div>
      )
    } else if (index === 1) {
      return <LoadingMore style={style} key={key || index} hasMoreItems={this.props.moreToLoad} />
    }
    const message = this.state.messages.get(index - cellMessageStartIndex)
    const prevMessage = this.state.messages.get(index - cellMessageStartIndex - 1)
    const isFirstMessage = index - cellMessageStartIndex === 0
    const skipMsgHeader = (message.author != null && prevMessage && prevMessage.type === 'Text' && prevMessage.author === message.author)
    const isSelected = message.messageID != null && this.state.selectedMessageID === message.messageID
    const isFirstNewMessage = message.messageID != null && this.props.firstNewMessageID ? this.props.firstNewMessageID === message.messageID : false

    const options = {
      followingMap: this.props.followingMap,
      includeHeader: isFirstMessage || !skipMsgHeader,
      index,
      isFirstNewMessage,
      isScrolling,
      isSelected,
      key,
      message: message,
      metaDataMap: this.props.metaDataMap,
      onAction: this._onAction,
      onLoadAttachment: this.props.onLoadAttachment,
      onRetryAttachment: () => { message.type === 'Attachment' && this.props.onRetryAttachment(message) },
      onOpenInFileUI: this.props.onOpenInFileUI,
      onOpenInPopup: this.props.onOpenInPopup,
      onRetry: this.props.onRetryMessage,
      style,
      you: this.props.you,
    }

    return messageFactory(options)
  }

  _recomputeListDebounced = _.throttle(() => {
    this._recomputeList()
  }, 300)

  _recomputeList () {
    this._cellCache.clearAllRowHeights()
    this._list && this._list.recomputeRowHeights()
    this.state.isLockedToBottom && this._scrollToBottom()
  }

  _onCopyCapture (e) {
    // Copy text only, not HTML/styling.
    e.preventDefault()
    clipboard.writeText(window.getSelection().toString())
  }

  _setCellMeasurerRef = r => {
    this._cellMeasurer = r
  }

  _setListRef = r => {
    this._list = r
  }

  _rowCount = () => this.state.messages.count() + cellMessageStartIndex

  _scrollToBottom = () => {
    const rowCount = this._rowCount()
    this._list && this._list.Grid.scrollToCell({columnIndex: 0, rowIndex: rowCount})
  }

  _handleListClick = () => {
    if (window.getSelection().isCollapsed) {
      this.props.onFocusInput()
    }
  }

  _domNodeToRect (element) {
    const bodyRect = document.body.getBoundingClientRect()
    const elemRect = element.getBoundingClientRect()

    return {
      height: elemRect.height,
      left: elemRect.left - bodyRect.left,
      top: elemRect.top - bodyRect.top,
      width: elemRect.width,
    }
  }

  onEditLastMessage = () => {
    if (!this._list) {
      return
    }

    const entry: any = this.state.messages.findLastEntry(m => m.type === 'Text' && m.author === this.props.you)
    if (entry) {
      const idx: number = entry[0]
      const message: TextMessage = entry[1]
      this._list.Grid.scrollToCell({columnIndex: 0, rowIndex: idx})
      const listNode = ReactDOM.findDOMNode(this._list)
      if (listNode) {
        const messageNodes = listNode.querySelectorAll(`[data-message-key="${message.key}"]`)
        if (messageNodes) {
          const messageNode = messageNodes[0]
          if (messageNode) {
            this._showEditor(message, this._domNodeToRect(messageNode))
          }
        }
      }
    }
  }

  _cellRangeRenderer = options => chatCellRangeRenderer(this.state.messages.count(), this._cellCache, options)

  render () {
    if (!this.props.validated) {
      return (
        <div style={{display: 'flex', alignItems: 'center', flex: 1, justifyContent: 'center'}}>
          <Icon type='icon-securing-266' style={{alignSelf: 'flex-start'}} />
        </div>
      )
    }

    const rowCount = this._rowCount()
    let scrollToIndex = this.state.isLockedToBottom ? rowCount - 1 : undefined
    let scrollTop = scrollToIndex ? undefined : this.state.scrollTop

    return (
      <div style={containerStyle} onClick={this._handleListClick} onCopyCapture={this._onCopyCapture}>
        <style>{realCSS}</style>
        <AutoSizer onResize={this._onResize}>{
          ({height, width}) => (
            // width is adjusted to assume scrollbars, see https://github.com/bvaughn/react-virtualized/issues/401
            <CellMeasurer
              cellRenderer={this._cellRenderer}
              columnCount={1}
              ref={this._setCellMeasurerRef}
              cellSizeCache={this._cellCache}
              rowCount={rowCount}
              width={width - scrollbarWidth} >
              {({getRowHeight}) => (
                <VirtualizedList
                  cellRangeRenderer={this._cellRangeRenderer}
                  style={listStyle}
                  height={height}
                  ref={this._setListRef}
                  width={width}
                  onScroll={this._onScroll}
                  scrollTop={scrollTop}
                  scrollToIndex={scrollToIndex}
                  rowCount={rowCount}
                  rowHeight={getRowHeight}
                  columnWidth={width}
                  rowRenderer={this._rowRenderer} />)}</CellMeasurer>)}
        </AutoSizer>
      </div>
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
.message .action-button {
  visibility: hidden;
  opacity: 0;
}
.message:hover {
  border: 1px solid ${globalColors.black_10};
}
.message:hover .action-button {
  visibility: visible;
  opacity: 1;
}
`

const containerStyle = {
  ...globalStyles.flexBoxColumn,
  flex: 1,
  position: 'relative',
}

const listStyle = {
  outline: 'none',
  overflowX: 'hidden',
  paddingBottom: listBottomMargin,
}

let lastMessageCount
function chatCellRangeRenderer (messageCount: number, cellSizeCache: any, {
  cellCache,
  cellRenderer,
  columnSizeAndPositionManager,
  columnStartIndex,
  columnStopIndex,
  horizontalOffsetAdjustment,
  isScrolling,
  rowSizeAndPositionManager,
  rowStartIndex,
  rowStopIndex,
  scrollLeft,
  scrollTop,
  styleCache,
  verticalOffsetAdjustment,
  visibleColumnIndices,
  visibleRowIndices,
}: DefaultCellRangeRendererParams) {
  const renderedCells = []
  const offsetAdjusted = verticalOffsetAdjustment || horizontalOffsetAdjustment
  const canCacheStyle = !isScrolling || !offsetAdjusted

  if (messageCount !== lastMessageCount) {
    lastMessageCount = messageCount
    rowSizeAndPositionManager.resetCell(0)
    cellSizeCache.clearAllRowHeights()
  }

  for (let rowIndex = rowStartIndex; rowIndex <= rowStopIndex; rowIndex++) {
    let rowDatum = rowSizeAndPositionManager.getSizeAndPositionOfCell(rowIndex)

    for (let columnIndex = columnStartIndex; columnIndex <= columnStopIndex; columnIndex++) {
      let columnDatum = columnSizeAndPositionManager.getSizeAndPositionOfCell(columnIndex)
      let isVisible = (
        columnIndex >= visibleColumnIndices.start &&
        columnIndex <= visibleColumnIndices.stop &&
        rowIndex >= visibleRowIndices.start &&
        rowIndex <= visibleRowIndices.stop
      )

      let key = `${rowIndex}-${messageCount}`
      let style

      // Cache style objects so shallow-compare doesn't re-render unnecessarily.
      if (canCacheStyle && styleCache[key]) {
        style = styleCache[key]
      } else {
        style = {
          height: rowDatum.size,
          left: columnDatum.offset + horizontalOffsetAdjustment,
          position: 'absolute',
          top: rowDatum.offset + verticalOffsetAdjustment,
          width: columnDatum.size,
        }

        styleCache[key] = style
      }

      let cellRendererParams = {
        columnIndex,
        isScrolling,
        isVisible,
        key,
        rowIndex,
        style,
      }

      let renderedCell

      // Avoid re-creating cells while scrolling.
      // This can lead to the same cell being created many times and can cause performance issues for "heavy" cells.
      // If a scroll is in progress- cache and reuse cells.
      // This cache will be thrown away once scrolling completes.
      // However if we are scaling scroll positions and sizes, we should also avoid caching.
      // This is because the offset changes slightly as scroll position changes and caching leads to stale values.
      // For more info refer to issue #395
      if (
        isScrolling &&
        !horizontalOffsetAdjustment &&
        !verticalOffsetAdjustment
      ) {
        if (!cellCache[key]) {
          cellCache[key] = cellRenderer(cellRendererParams)
        }

        renderedCell = cellCache[key]

      // If the user is no longer scrolling, don't cache cells.
      // This makes dynamic cell content difficult for users and would also lead to a heavier memory footprint.
      } else {
        renderedCell = cellRenderer(cellRendererParams)
      }

      if (renderedCell == null || renderedCell === false) {
        continue
      }

      renderedCells.push(renderedCell)
    }
  }

  return renderedCells
}

type DefaultCellRangeRendererParams = {
  cellCache: Object,
  cellRenderer: Function,
  columnSizeAndPositionManager: Object,
  columnStartIndex: number,
  columnStopIndex: number,
  horizontalOffsetAdjustment: number,
  isScrolling: boolean,
  rowSizeAndPositionManager: Object,
  rowStartIndex: number,
  rowStopIndex: number,
  scrollLeft: number,
  scrollTop: number,
  styleCache: Object,
  verticalOffsetAdjustment: number,
  visibleColumnIndices: Object,
  visibleRowIndices: Object,
}

export default ConversationList

if (__DEV__ && typeof window !== 'undefined') {
  window.showReactVirtualListMeasurer = () => {
    const holder = window.document.body.lastChild
    holder.style.zIndex = 9999
    holder.style.backgroundColor = 'red'
    holder.style.visibility = 'visible'
    holder.style.left = '320px'
    holder.style.top = '320px'
  }
}
