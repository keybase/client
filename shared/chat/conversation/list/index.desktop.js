// @flow
// An infinite scrolling chat list. Using react-virtualized which doesn't really handle this case out of the box.
// We control which set of messages we render in our state object.
// We load that in in our constructor, after you stop scrolling or if we get an update and we're not currently scrolling.
//
//
// TODO:  hanle scroll stuff
//
//
//
import * as Constants from '../../../constants/chat'
import * as Virtualized from 'react-virtualized'
import React, {Component} from 'react'
import ReactDOM from 'react-dom'
import EditPopup from '../edit-popup.desktop'
import {TextPopupMenu, AttachmentPopupMenu} from '../messages/popup'
import {findDOMNode} from '../../../util/dom'
import messageFactory from '../messages'
import {Icon} from '../../../common-adapters'
// import {clipboard} from 'electron'
import {globalColors, globalStyles} from '../../../styles'

import type {Props} from '.'

type State = {
  // isLockedToBottom: boolean,
  // isScrolling: boolean,
  // scrollTop: number,
  selectedMessageKey: ?Constants.MessageKey,
}

const lockedToBottomSlop = 20
const listBottomMargin = 10
// const DEBUG_ROW_RENDER = __DEV__ && false

class BaseList extends Component<void, Props, State> {
  _cellCache = new Virtualized.CellMeasurerCache({
    fixedWidth: true,
    keyMapper: (rowIndex: number) => this.props.messageKeys.get(rowIndex),
  })

  // This is similar to a state but it changing value doesn't actually need to cause us to re-render.
  // We're either locked at the bottom or not and it only affects when we get new messages which'll cause a render anyways
  _isLockedToBottom = true

  state = {
    selectedMessageKey: null,
    // isScrolling: false,
    // scrollTop: 0,
  }

  // componentWillUnmount () {
    // // Stop any throttled/debounced functions
    // this._onScroll.cancel()
    // this._recomputeListDebounced.cancel()
    // this._onScrollSettled.cancel()
  // }

  // TODO keep a counter in the keys list to force these changes automatically. pass that itno the list
  // componentWillUpdate (nextProps: Props, nextState: State) {
    // If a message has moved from pending to sent, tell the List to discard
    // heights for it (which will re-render it and everything after it)
    // TODO this doesn't work for things that take a bit to load (imgs)
    // if (this._toRemeasure.length) {
      // this._toRemeasure.forEach(item => {
        // this._cellCache.clearRowHeight(item)
        // if (this._listIsGood()) {
          // this._list.recomputeRowHeights(item)
        // }
      // })
      // this._toRemeasure = []
    // }

    // if (this._shouldForceUpdateGrid) {
      // this._shouldForceUpdateGrid = false
      // if (this._listIsGood()) {
        // this._list.forceUpdateGrid()
      // }
    // }
  // }

  // _listIsGood () {
    // return this._list && this._list.Grid
  // }

  _onAction = (message: Constants.ServerMessage, event: any) => {
    throw new Error('Implemented in PopupEnabledList')
  }
  // componentDidUpdate (prevProps: Props, prevState: State) {
    // if ((this.props.selectedConversation !== prevProps.selectedConversation) ||
        // (this.props.messageKeys !== prevProps.messageKeys)) {
      // this.state.isLockedToBottom && this._scrollToBottom()
    // }

    // if (this.props.editLastMessageCounter !== prevProps.editLastMessageCounter) {
      // this.onEditLastMessage()
    // }

    // if (this.props.messageKeys !== prevProps.messageKeys && prevProps.messageKeys.count() > 1) {
      // const prependedCount = this.props.messageKeys.indexOf(prevProps.messageKeys.first())
      // // const headerCount = this.props.headerMessages.count()
      // if (prependedCount !== -1) {
        // // Measure the new items so we can adjust our scrollTop so your position doesn't jump
        // const scrollTop = this.state.scrollTop + _.range(0, prependedCount)
          // .map(index => this._cellMeasurer.getRowHeight({index}))
          // .reduce((total, height) => total + height, 0)

        // // Disabling eslint as we normally don't want to call setState in a componentDidUpdate in case you infinitely re-render
        // this.setState({scrollTop}) // eslint-disable-line react/no-did-update-set-state
      // }
    // }
  // }

  componentWillReceiveProps (nextProps: Props) {
    if (this.props.selectedConversation !== nextProps.selectedConversation) {
      this._isLockedToBottom = true
      // this._recomputeList()
    }

    // const willScrollDown = nextProps.listScrollDownCounter !== this.props.listScrollDownCounter

    // if (willScrollDown) {
      // this.setState({isLockedToBottom: true})
    // }

    // if (this.props.moreToLoad !== nextProps.moreToLoad) {
      // this._shouldForceUpdateGrid = true
    // }
  }

  // _onScrollSettled = _.debounce(() => {
    // this.setState({
      // isScrolling: false,
    // })
  // }, 1000)

  _updateBottomLock = (clientHeight: number, scrollHeight: number, scrollTop: number) => {
    // meaningless otherwise
    if (clientHeight) {
      this._isLockedToBottom = scrollTop + clientHeight >= scrollHeight - lockedToBottomSlop
    }
    // this.setState({
      // isScrolling: true,
      // scrollTop,
    // })
  }

  // _onScroll = _.throttle(({clientHeight, scrollHeight, scrollTop}) => {
  _onScroll = ({clientHeight, scrollHeight, scrollTop}) => {
    // // Do nothing if we haven't really loaded anything
    // if (!clientHeight) {
      // return
    // }

    // // At the top, load more messages. Action handles loading state and if there's actually any more
    // if (scrollTop === 0) {
      // this.props.onLoadMoreMessages()
    // }

    this._updateBottomLock(clientHeight, scrollHeight, scrollTop)

    // // Lock to bottom if we are close to the bottom
    // const isLockedToBottom = scrollTop + clientHeight >= scrollHeight - lockedToBottomSlop
    // this.setState({
      // isLockedToBottom,
      // // isScrolling: true,
      // // scrollTop,
    // })

    // // This is debounced so it resets the call
    // this._onScrollSettled()
  // }, 200)
  }

  _onResize = ({width}) => {
    if (this._cellCache.columnWidth({index: 0}) !== width) {
      this._cellCache.clearAll()
    }
  }

  // _onShowEditor = (message: Constants.Message, event: any) => {
    // if (message.type === 'Text') {
      // const messageNode = this._findMessageFromDOMNode(event.target)
      // const messageRect = messageNode && this._domNodeToRect(messageNode)
      // if (messageRect) {
        // this._showEditor(message, messageRect)
      // }
    // }
  // }

  _rowRenderer = ({index, isScrolling, isVisible, key, parent, style}) => {
    const messageKey = this.props.messageKeys.get(index)
    const prevMessageKey = this.props.messageKeys.get(index - 1)
    const isSelected = messageKey === this.state.selectedMessageKey
    return (
      <Virtualized.CellMeasurer
        cache={this._cellCache}
        columnIndex={0}
        key={key}
        parent={parent}
        rowIndex={index}>
        {({measure}) => {
          const message = messageFactory(messageKey, prevMessageKey, this._onAction, isSelected, measure)
          return (
            <div style={style}>
              {message}
            </div>
          )
        }}
      </Virtualized.CellMeasurer>
    )

    // const message = this.props.messageKeys.get(index)
    // const prevMessage = this.props.messages.get(index - 1)
    // const isFirstMessage = index === 0
    // const isSelected = false // TODO selectedKey instead

    // const options = this.props.optionsFn(message, prevMessage, isFirstMessage, isSelected, isScrolling, key, style, this._onAction, this._onShowEditor, false)

    // return messageFactory(options)
  }

  // _recomputeListDebounced = _.throttle(() => {
    // this._recomputeList()
  // }, 300)

  // _recomputeList () {
    // // this._cellCache.clearAllRowHeights()

    // // if (this._listIsGood()) {
      // // this._list && this._list.recomputeRowHeights()
    // // }
    // this.state.isLockedToBottom && this._scrollToBottom()
  // }

  // _onCopyCapture (e) {
    // // Copy text only, not HTML/styling.
    // e.preventDefault()
    // clipboard.writeText(window.getSelection().toString())
  // }

  // _setCellMeasurerRef = r => {
    // this._cellMeasurer = r
  // }

  // _setListRef = r => {
    // this._list = r
  // }

  // _rowCount = () => this.props.messageKeys.count()

  // _scrollToBottom = () => {
    // const rowCount = this._rowCount()
    // if (this._listIsGood()) {
      // this._list && this._list.Grid.scrollToCell({columnIndex: 0, rowIndex: rowCount})
    // }
  // }

  // _handleListClick = () => {
    // if (window.getSelection().isCollapsed) {
      // this.props.onFocusInput()
    // }
  // }

  // onEditLastMessage = () => {
    // if (!this._list) {
      // return
    // }

    // TODO put this back
    // const entry: any = this.props.messageKeys.findLastEntry(m => m.type === 'Text' && m.author === this.props.you)
    // if (entry) {
      // const idx: number = entry[0]
      // const message: Constants.TextMessage = entry[1]

      // if (this._listIsGood()) {
        // this._list.Grid.scrollToCell({columnIndex: 0, rowIndex: idx})
      // }
      // const listNode = ReactDOM.findDOMNode(this._list)
      // if (listNode) {
        // const messageNodes = listNode.querySelectorAll(`[data-message-key="${message.key}"]`)
        // if (messageNodes) {
          // const messageNode = messageNodes[0]
          // if (messageNode) {
            // this._showEditor(message, this._domNodeToRect(messageNode))
          // }
        // }
      // }
    // }
  // }

  // _cellRangeRenderer = options => {
    // const message = this.props.messages.get(0)
    // const firstKey = message && message.key || '0'
    // return chatCellRangeRenderer(firstKey, this._cellCache, options)
  // }

  render () {
    if (!this.props.validated) {
      return (
        <div style={{alignItems: 'center', display: 'flex', flex: 1, justifyContent: 'center'}}>
          <Icon type='icon-securing-266' style={{alignSelf: 'flex-start'}} />
        </div>
      )
    }

    const rowCount = this.props.messageKeys.count()

    // let scrollToIndex = this.state.isLockedToBottom ? rowCount - 1 : undefined
    // let scrollTop = scrollToIndex ? undefined : this.state.scrollTop
              // scrollTop={scrollTop}
              // ref={this._setListRef}
    return (
      <div style={containerStyle} onClick={undefined/*this._handleListClick*/} onCopyCapture={undefined/*this._onCopyCapture*/}>
        <style>{realCSS}</style>
        <Virtualized.AutoSizer onResize={this._onResize}>
          {({height, width}) => (
            <Virtualized.List
              columnWidth={width}
              deferredMeasurementCache={this._cellCache}
              height={height}
              onScroll={this._onScroll}
              rowCount={rowCount}
              rowHeight={this._cellCache.rowHeight}
              rowRenderer={this._rowRenderer}
              scrollToIndex={this._isLockedToBottom ? rowCount - 1 : undefined}
              style={listStyle}
              width={width}
            />
          )}
        </Virtualized.AutoSizer>
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

// Adds in popup handling
class PopupEnabledList extends BaseList {
  _hidePopup = () => {
    ReactDOM.unmountComponentAtNode(document.getElementById('popupContainer'))
    this.setState({selectedMessageKey: null})
  }
  _domNodeToRect (element) {
    if (!document.body) {
      throw new Error('Body not ready')
    }
    const bodyRect = document.body.getBoundingClientRect()
    const elemRect = element.getBoundingClientRect()

    return {
      height: elemRect.height,
      left: elemRect.left - bodyRect.left,
      top: elemRect.top - bodyRect.top,
      width: elemRect.width,
    }
  }

  _renderPopup (message: Constants.Message, style: Object, messageRect: any): ?React$Element<any> {
    switch (message.type) {
      case 'Text':
        return (
          <TextPopupMenu
            you={this.props.you}
            message={message}
            onShowEditor={(message: Constants.TextMessage) => this._showEditor(message, messageRect)}
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

  _showEditor = (message: Constants.TextMessage, messageRect: any) => {
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
    const node = findDOMNode(start, '.message')
    if (node) return node

    // If not found, try to find it in the message-wrapper
    const wrapper = findDOMNode(start, '.message-wrapper')
    if (wrapper) {
      const messageNodes = wrapper.getElementsByClassName('message')
      if (messageNodes.length > 0) return messageNodes[0]
    }

    return null
  }

  _showPopup (message: Constants.TextMessage | Constants.AttachmentMessage, event: any) {
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
      selectedMessageKey: message.key,
    })

    const container = document.getElementById('popupContainer')
    // FIXME: this is the right way to render portals retaining context for now, though it will change in the future.
    ReactDOM.unstable_renderSubtreeIntoContainer(this, popupComponent, container)
  }

  _onAction = (message: Constants.ServerMessage, event: any) => {
    if (message.type === 'Text' || message.type === 'Attachment') {
      this._showPopup(message, event)
    }
  }
}

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

export default PopupEnabledList
