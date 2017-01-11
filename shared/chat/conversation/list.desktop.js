// @flow
// An infinite scrolling chat list. Using react-virtualized which doens't really handle this case out of the box
// We control which set of messages we render in our state object
// We load that in in our constructor, after you stop scrolling or if we get an update and we're not currently scrolling

import LoadingMore from './messages/loading-more'
import {TextPopupMenu, AttachmentPopupMenu} from './messages/popup'
import React, {Component} from 'react'
import ReactDOM from 'react-dom'
import SidePanel from './side-panel/index.desktop'
import _ from 'lodash'
import messageFactory from './messages'
import shallowEqual from 'shallowequal'
import {AutoSizer, CellMeasurer, List as VirtualizedList, defaultCellMeasurerCellSizeCache} from 'react-virtualized'
import {Box, ProgressIndicator} from '../../common-adapters'
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

class ConversationList extends Component<void, Props, State> {
  _cellCache: any;
  _cellMeasurer: any;
  _list: any;
  state: State;
  _toRemeasure: Array<number>;
  _lastWidth: ?number;

  constructor (props: Props) {
    super(props)

    this.state = {
      isLockedToBottom: true,
      isScrolling: false,
      messages: props.messages,
      scrollTop: 0,
    }

    this._cellCache = new CellSizeCache(this._indexToID)
    this._toRemeasure = []
  }

  _indexToID = index => {
    if (index === 0) {
      // loader
      return 0
    } else if (index === this.state.messages.count() + 1) {
      // footer
      return -1
    } else {
      // minus one because loader message is there
      const messageIndex = index - 1
      const message = this.state.messages.get(messageIndex)
      const id = message && message.key
      if (id == null) {
        console.warn('id is null for index:', messageIndex)
      }
      return id
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
  }

  componentDidUpdate (prevProps: Props, prevState: State) {
    if (!this.state.isLockedToBottom && this.state.messages !== prevState.messages && prevState.messages.count() > 1) {
      // Figure out how many new items we have
      const prependedCount = this.state.messages.indexOf(prevState.messages.first())
      if (prependedCount !== -1) {
        // Measure the new items so we can adjust our scrollTop so your position doesn't jump
        const scrollTop = this.state.scrollTop + _.range(0, prependedCount)
          .map(index => this._cellMeasurer.getRowHeight({index: index + 1})) // +1 since 0 is the loading message
          .reduce((total, height) => total + height, 0)

        // Disabling eslint as we normally don't want to call setState in a componentDidUpdate in case you infinitely re-render
        this.setState({scrollTop}) // eslint-disable-line react/no-did-update-set-state
      }
    }
  }

  componentWillReceiveProps (nextProps: Props) {
    if (this.props.selectedConversation !== nextProps.selectedConversation) {
      this.setState({isLockedToBottom: true})
      this._recomputeList(true)
    }

    // If we're not scrolling let's update our internal messages
    if (!this.state.isScrolling) {
      this._invalidateChangedMessages(nextProps)
      this.setState({
        messages: nextProps.messages,
      })
    }
  }

  _invalidateChangedMessages (props: Props) {
    this.state.messages.forEach((item, index) => {
      const oldMessage = props.messages.get(index, {})

      if (item.type === 'Text' && oldMessage.type === 'Text' && item.messageState !== oldMessage.messageState) {
        this._toRemeasure.push(index + 1)
      }

      if (item.type === 'Attachment' && oldMessage.type === 'Attachment' && item.previewPath !== oldMessage.previewPath) {
        this._toRemeasure.push(index + 1)
      }
    })
  }

  _onScrollSettled = _.debounce(() => {
    // If we've stopped scrolling let's update our internal messages
    this._invalidateChangedMessages(this.props)
    this.setState({
      isScrolling: false,
      ...(this.state.messages !== this.props.messages ? {messages: this.props.messages} : null),
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
    const isLockedToBottom = scrollTop + clientHeight >= scrollHeight - 20
    this.setState({
      isLockedToBottom,
      isScrolling: true,
      scrollTop,
    })

    // This is debounced so it resets the call
    this._onScrollSettled()
  }, 100)

  _hidePopup () {
    ReactDOM.unmountComponentAtNode(document.getElementById('popupContainer'))
    this.setState({
      selectedMessageID: undefined,
    })
  }

  _renderPopup (message: Message, style: Object): ?React$Element<any> {
    switch (message.type) {
      case 'Text':
        return (
          <TextPopupMenu
            message={message}
            onEditMessage={this.props.onEditMessage}
            onDeleteMessage={this.props.onDeleteMessage}
            onLoadAttachment={this.props.onLoadAttachment}
            onOpenInFileUI={this.props.onOpenInFileUI}
            onHidden={() => this._hidePopup()}
            style={style}
          />
        )
      case 'Attachment':
        const {downloadedPath, filename, messageID} = message
        return (
          <AttachmentPopupMenu
            message={message}
            onDeleteMessage={this.props.onDeleteMessage}
            onDownloadAttachment={() => { messageID && this.props.onLoadAttachment(messageID, filename) }}
            onOpenInFileUI={() => { downloadedPath && this.props.onOpenInFileUI(downloadedPath) }}
            onHidden={() => this._hidePopup()}
            style={style}
          />
        )
    }
  }

  _showPopup (message: TextMessage | AttachmentMessage, event: any) {
    const clientRect = event.target.getBoundingClientRect()
    // Position next to button (client rect)
    // TODO: Measure instead of pixel math
    const x = clientRect.left - 205
    let y = clientRect.top - (message.followState === 'You' ? 200 : 116)
    if (y < 10) y = 10

    const popupComponent = this._renderPopup(message, {position: 'absolute', top: y, left: x})
    if (!popupComponent) return

    this.setState({
      selectedMessageID: message.messageID,
    })
    const container = document.getElementById('popupContainer')
    ReactDOM.render(popupComponent, container)
  }

  _onAction = (message, event) => {
    if (message.type === 'Text' || message.type === 'Attachment') {
      this._showPopup(message, event)
    }
  }

  _rowRenderer = ({index, key, style, isScrolling}: {index: number, key: string, style: Object, isScrolling: boolean}) => {
    if (index === 0) {
      return <LoadingMore style={style} key={key || index} hasMoreItems={this.props.moreToLoad} />
    }
    if (index === this.state.messages.count() + 1) {
      return <Box key={'footer'} style={{height: 20}} />
    }

    const message = this.state.messages.get(index - 1)
    const prevMessage = this.state.messages.get(index - 2)
    const isFirstMessage = index - 1 === 0
    const skipMsgHeader = (message.author != null && prevMessage && prevMessage.type === 'Text' && prevMessage.author === message.author)
    const isSelected = message.messageID != null && this.state.selectedMessageID === message.messageID
    const isFirstNewMessage = message.messageID != null && this.props.firstNewMessageID ? this.props.firstNewMessageID === message.messageID : false

    return messageFactory(message, isFirstMessage || !skipMsgHeader, index, key, isFirstNewMessage, style, isScrolling, this._onAction, isSelected, this.props.onLoadAttachment, this.props.onOpenInFileUI, this.props.onOpenInPopup, this.props.onRetryMessage)
  }

  _recomputeListDebounced = _.debounce(() => {
    this._recomputeList()
  }, 300)

  _recomputeList () {
    this._cellCache.clearAllRowHeights()
    this._list && this._list.recomputeRowHeights()
  }

  render () {
    if (!this.props.validated) {
      return (
        <div style={{...globalStyles.flexBoxColumn, flex: 1, alignItems: 'center', justifyContent: 'center'}}>
          <ProgressIndicator style={{width: 20}} />
        </div>
      )
    }
    const rowCount = this.state.messages.count() + 2 // Loading row on top always and footer row
    let scrollToIndex = this.state.isLockedToBottom ? rowCount - 1 : undefined
    let scrollTop = scrollToIndex ? undefined : this.state.scrollTop

    // We need to use both visibility and opacity css properties for the
    // action button hide/show on hover.
    // We use opacity because it shows/hides the button immediately on
    // hover, while visibility has slight lag.
    // We use visibility so that the action button content isn't copied
    // during copy/paste actions since user-select isn't working in
    // Chrome.
    const realCSS = `
    .message {
      background-color: transparent;
    }
    .message .action-button {
      visibility: hidden;
      opacity: 0;
    }
    .message:hover {
      background-color: ${globalColors.black_05};
    }
    .message:hover .action-button {
      visibility: visible;
      opacity: 1;
    }
    `

    return (
      <div style={{...globalStyles.flexBoxColumn, flex: 1, position: 'relative'}}>
        <style>{realCSS}</style>
        <AutoSizer
          onResize={({width}) => {
            if (width !== this._lastWidth) {
              this._lastWidth = width
              this._recomputeListDebounced()
            }
          }} >
          {({height, width}) => {
            return <CellMeasurer
              cellRenderer={({rowIndex, ...rest}) => this._rowRenderer({index: rowIndex, ...rest})}
              columnCount={1}
              ref={r => { this._cellMeasurer = r }}
              cellSizeCache={this._cellCache}
              rowCount={rowCount}
              width={width} >
              {({getRowHeight}) => {
                return <VirtualizedList
                  style={{outline: 'none'}}
                  height={height}
                  ref={r => { this._list = r }}
                  width={width}
                  onScroll={this._onScroll}
                  scrollTop={scrollTop}
                  scrollToIndex={scrollToIndex}
                  rowCount={rowCount}
                  rowHeight={getRowHeight}
                  columnWidth={width}
                  rowRenderer={this._rowRenderer} />
              }}
            </CellMeasurer>
          }}
        </AutoSizer>
        {this.props.sidePanelOpen && <div style={{...globalStyles.flexBoxColumn, position: 'absolute', right: 0, top: 0, bottom: 0, width: 320}}>
          <SidePanel {...this.props} />
        </div>}
      </div>
    )
  }
}

class CellSizeCache extends defaultCellMeasurerCellSizeCache {
  _indexToID: (index: number) => ?number;

  constructor (indexToID) {
    super({uniformColumnWidth: true, uniformRowHeight: false})
    this._indexToID = indexToID
  }

  getRowHeight (index) {
    return super.getRowHeight(this._indexToID(index))
  }

  getColumnWidth (index) {
    return super.getColumnWidth(this._indexToID(index))
  }

  setRowHeight (index, height) {
    super.setRowHeight(this._indexToID(index), height)
  }

  setColumnWidth (index, width) {
    super.setColumnWidth(this._indexToID(index), width)
  }

  clearRowHeight (index) {
    super.clearRowHeight(this._indexToID(index))
  }

  clearColumnWidth (index) {
    super.clearColumnWidth(this._indexToID(index))
  }
}

export default ConversationList
