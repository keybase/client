// @flow
// An infinite scrolling chat list. Using react-virtualized which doesn't really handle this case out of the box.
import * as Constants from '../../../constants/chat'
import * as Virtualized from 'react-virtualized'
import EditPopup from '../edit-popup.desktop'
import React, {Component} from 'react'
import ReactDOM from 'react-dom'
import messageFactory from '../messages'
import {Icon} from '../../../common-adapters'
import {TextPopupMenu, AttachmentPopupMenu} from '../messages/popup'
import {clipboard} from 'electron'
import {debounce} from 'lodash'
import {findDOMNode} from '../../../util/dom'
import {globalColors, globalStyles} from '../../../styles'

import type {Props} from '.'

type State = {
  isLockedToBottom: boolean,
  listRerender: number,
  selectedMessageKey: ?Constants.MessageKey,
}

const lockedToBottomSlop = 20

class BaseList extends Component<void, Props, State> {
  _cellCache = new Virtualized.CellMeasurerCache({
    fixedWidth: true,
    keyMapper: (rowIndex: number) => this.props.messageKeys.get(rowIndex),
  })

  _list: any
  _keepIdxVisible: number = -1
  _lastRowIdx: number = -1

  state = {
    isLockedToBottom: true,
    listRerender: 0,
    selectedMessageKey: null,
  }

  _onAction = (message: Constants.ServerMessage, event: any) => {
    throw new Error('_onAction Implemented in PopupEnabledList')
  }
  _onShowEditor = (message: Constants.Message, event: any) => {
    throw new Error('_onShowEditor Implemented in PopupEnabledList')
  }
  _onEditLastMessage = () => {
    throw new Error('_onEditLastMessage Implemented in PopupEnabledList')
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
    // Force a rerender if we passed a row to scroll to. If it's kept around the virutal list gets confused so we only want it to render once basically
    if (this._keepIdxVisible !== -1) {
      this.setState({listRerender: this.state.listRerender + 1}) // eslint-disable-line react/no-did-update-set-state
      this._keepIdxVisible = -1
    }
    this._lastRowIdx = -1 // always reset this to be safe

    if (this.props.editLastMessageCounter !== prevProps.editLastMessageCounter) {
      this._onEditLastMessage()
    }
  }

  componentWillReceiveProps(nextProps: Props) {
    if (
      this.props.selectedConversation !== nextProps.selectedConversation ||
      this.props.listScrollDownCounter !== nextProps.listScrollDownCounter
    ) {
      this._cellCache.clearAll()
      this.setState({isLockedToBottom: true})
    }

    if (this.props.messageKeys.count() !== nextProps.messageKeys.count()) {
      if (this.props.messageKeys.count() > 1 && this._lastRowIdx !== -1) {
        const toFind = this.props.messageKeys.get(this._lastRowIdx)
        this._keepIdxVisible = nextProps.messageKeys.indexOf(toFind)
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

  _maybeLoadMoreMessages = debounce((clientHeight: number, scrollTop: number) => {
    if (clientHeight && scrollTop === 0) {
      this.props.onLoadMoreMessages()
    }
  }, 500)

  _onScroll = ({clientHeight, scrollHeight, scrollTop}) => {
    this._updateBottomLock(clientHeight, scrollHeight, scrollTop)
    this._maybeLoadMoreMessages(clientHeight, scrollTop)
  }

  _onResize = ({width}) => {
    if (this._cellCache.columnWidth({index: 0}) !== width) {
      this._cellCache.clearAll()
    }
  }

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
        rowIndex={index}
      >
        {({measure}) => {
          const message = messageFactory(
            messageKey,
            prevMessageKey,
            this._onAction,
            this._onShowEditor,
            isSelected,
            measure
          )
          return (
            <div style={style}>
              {message}
            </div>
          )
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
    if (!this.props.validated) {
      return (
        <div style={{alignItems: 'center', display: 'flex', flex: 1, justifyContent: 'center'}}>
          <Icon type="icon-securing-266" style={{alignSelf: 'flex-start'}} />
        </div>
      )
    }

    const rowCount = this.props.messageKeys.count()
    const scrollToIndex = this.state.isLockedToBottom ? rowCount - 1 : this._keepIdxVisible

    // We pass additional props (listRerender, selectedMessageKey) to Virtualized.List so we can force re-rendering automatically
    return (
      <div style={containerStyle} onClick={this._handleListClick} onCopyCapture={this._onCopyCapture}>
        <style>{realCSS}</style>
        <Virtualized.AutoSizer onResize={this._onResize}>
          {({height, width}) => (
            <Virtualized.List
              messageKeys={this.props.messageKeys}
              listRerender={this.state.listRerender}
              selectedMessageKey={this.state.selectedMessageKey}
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
  _keepIdxVisible: number = -1
  _list: any

  _hidePopup = () => {
    ReactDOM.unmountComponentAtNode(document.getElementById('popupContainer'))
    this.setState({selectedMessageKey: null})
  }
  _domNodeToRect(element) {
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

  // How this works is kinda crappy. We have to plumb through this key => message helper and all this DOM stuff just to support this
  _onEditLastMessage = () => {
    const entry: any = this.props.messageKeys.findLastEntry(k => {
      const m = this.props.getMessageFromMessageKey(k)
      return !!(m && m.type === 'Text' && m.author === this.props.you)
    })

    if (entry) {
      const idx: number = entry[0]
      const messageKey: Constants.MessageKey = entry[1]
      // $ForceType
      const message: Constants.TextMessage = this.props.getMessageFromMessageKey(messageKey)

      this._keepIdxVisible = idx
      this.setState({listRerender: this.state.listRerender + 1})

      const listNode = ReactDOM.findDOMNode(this._list)
      if (listNode) {
        const messageNodes = listNode.querySelectorAll(`[data-message-key="${messageKey}"]`)
        if (messageNodes) {
          const messageNode = messageNodes[0]
          if (messageNode) {
            this._showEditor(message, this._domNodeToRect(messageNode))
          }
        }
      }
    }
  }

  _renderPopup(message: Constants.Message, style: Object, messageRect: any): ?React$Element<any> {
    switch (message.type) {
      case 'Text':
        return (
          <TextPopupMenu
            you={this.props.you}
            message={message}
            onShowEditor={(message: Constants.TextMessage) => this._showEditor(message, messageRect)}
            onDeleteMessage={this.props.onDeleteMessage}
            onDownloadAttachment={this.props.onDownloadAttachment}
            onOpenInFileUI={this.props.onOpenInFileUI}
            onHidden={this._hidePopup}
            style={style}
          />
        )
      case 'Attachment':
        const {savedPath, messageID} = message
        return (
          <AttachmentPopupMenu
            you={this.props.you}
            message={message}
            onDeleteMessage={this.props.onDeleteMessage}
            onDownloadAttachment={() => {
              messageID && this.props.onDownloadAttachment(messageID)
            }}
            onOpenInFileUI={() => {
              savedPath && this.props.onOpenInFileUI(savedPath)
            }}
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
        onSubmit={text => {
          this.props.onEditMessage(message, text)
        }}
      />
    )
    // Have to do this cause it's triggered from a popup that we're reusing else we'll get unmounted
    setImmediate(() => {
      const container = document.getElementById('popupContainer')
      // FIXME: this is the right way to render portals retaining context for now, though it will change in the future.
      ReactDOM.unstable_renderSubtreeIntoContainer(this, popupComponent, container)
    })
  }

  _findMessageFromDOMNode(start: any): any {
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

  _showPopup(message: Constants.TextMessage | Constants.AttachmentMessage, event: any) {
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

    this.setState({selectedMessageKey: message.key})

    const container = document.getElementById('popupContainer')
    // FIXME: this is the right way to render portals retaining context for now, though it will change in the future.
    ReactDOM.unstable_renderSubtreeIntoContainer(this, popupComponent, container)
  }

  _onAction = (message: Constants.ServerMessage, event: any) => {
    if (message.type === 'Text' || message.type === 'Attachment') {
      this._showPopup(message, event)
    }
  }

  _onShowEditor = (message: Constants.Message, event: any) => {
    if (message.type === 'Text') {
      const messageNode = this._findMessageFromDOMNode(event.target)
      const messageRect = messageNode && this._domNodeToRect(messageNode)
      if (messageRect) {
        this._showEditor(message, messageRect)
      }
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
}

export default PopupEnabledList
