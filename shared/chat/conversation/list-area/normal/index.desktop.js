// @flow
// An infinite scrolling chat list. Using react-virtualized which doesn't really handle this case out of the box.
// import * as Constants from '../../../constants/chat'
// import * as Types from '../../../constants/types/chat2'
import * as Virtualized from 'react-virtualized'
// import EditPopup from '../edit-popup.desktop'
import * as React from 'react'
// import ReactDOM from 'react-dom'
import Message from '../../messages'
import {ErrorBoundary} from '../../../../common-adapters'
import clipboard from '../../../../desktop/clipboard'
import debounce from 'lodash/debounce'
// import {findDOMNode} from '../../../util/dom'
import {globalColors, globalStyles} from '../../../../styles'

import type {Props} from '.'

type State = {
  isLockedToBottom: boolean,
  listRerender: number,
  // selectedMessageKey: ?Types.MessageKey,
}

const lockedToBottomSlop = 20
// const listBottomMargin = 10

// const DivRow = glamorous.div({
// ':last-child': {
// paddingBottom: listBottomMargin,
// },
// })

class BaseList extends React.Component<Props, State> {
  _cellCache = new Virtualized.CellMeasurerCache({
    fixedWidth: true,
    keyMapper: (rowIndex: number) => this.props.messageOrdinals.get(rowIndex),
  })

  _list: any
  _keepIdxVisible: number = -1
  _lastRowIdx: number = -1

  state = {
    isLockedToBottom: true,
    listRerender: 0,
    selectedMessageKey: null,
  }

  // _onShowMenu = () => {
  // throw new Error('_onShowMenu Implemented in PopupEnabledList')
  // }
  // _onShowEditor = () => {
  // throw new Error('_onShowEditor Implemented in PopupEnabledList')
  // }
  // _onEditLastMessage = () => {
  // throw new Error('_onEditLastMessage Implemented in PopupEnabledList')
  // }

  componentDidUpdate(prevProps: Props, prevState: State) {
    // Force a rerender if we passed a row to scroll to. If it's kept around the virutal list gets confused so we only want it to render once basically
    if (this._keepIdxVisible !== -1) {
      this.setState(prevState => ({listRerender: prevState.listRerender + 1})) // eslint-disable-line react/no-did-update-set-state
      this._keepIdxVisible = -1
    }
    this._lastRowIdx = -1 // always reset this to be safe

    // if (this.props.editLastMessageCounter !== prevProps.editLastMessageCounter) {
    // this._onEditLastMessage()
    // }
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

  _maybeLoadMoreMessages = debounce((clientHeight: number, scrollTop: number) => {
    if (clientHeight && scrollTop === 0) {
      this.props.loadMoreMessages()
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

  _measure = ordinal => {
    // TODO find index
    // this._cellCache.clearAll()
    // this._list && this._list.Grid && this._list.recomputeRowHeights(0)
  }

  _rowRenderer = ({index, isScrolling, isVisible, key, parent, style}) => {
    const ordinal = this.props.messageOrdinals.get(index)
    const prevOrdinal = index > 0 ? this.props.messageOrdinals.get(index - 1) : null
    // const isSelected = false // messageKey === this.state.selectedMessageKey
    // {({measure}) => (
    // const message = messageFactory(
    // ordinal,
    // prevOrdinal,
    // this._onAction,
    // this._onShowEditor,
    // isSelected,
    // measure
    // )
    return (
      <Virtualized.CellMeasurer
        cache={this._cellCache}
        columnIndex={0}
        key={key}
        parent={parent}
        rowIndex={index}
      >
        {({measure}) => (
          <div style={style}>
            <Message
              ordinal={ordinal}
              previous={prevOrdinal}
              measure={measure}
              conversationIDKey={this.props.conversationIDKey}
            />
          </div>
        )}
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
    // if (!this.props.validated) {
    // return (
    // <div style={{alignItems: 'center', display: 'flex', flex: 1, justifyContent: 'center'}}>
    // <Icon type="icon-securing-266" style={{alignSelf: 'flex-start'}} />
    // </div>
    // )
    // }

    const rowCount = this.props.messageOrdinals.size
    const scrollToIndex = this.state.isLockedToBottom ? rowCount - 1 : this._keepIdxVisible

    // We pass additional props (listRerender, selectedMessageKey) to Virtualized.List so we can force re-rendering automatically
    // messageKeys={this.props.messageKeys}
    // selectedMessageKey={this.state.selectedMessageKey}
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

// Adds in popup handling
class PopupEnabledList extends BaseList {
  _keepIdxVisible: number = -1
  _list: any

  // _hidePopup = () => {
  // ReactDOM.unmountComponentAtNode(document.getElementById('popupContainer'))
  // this.setState({selectedMessageKey: null})
  // }
  // _domNodeToRect(element) {
  // if (!document.body) {
  // throw new Error('Body not ready')
  // }
  // const bodyRect = document.body.getBoundingClientRect()
  // const elemRect = element.getBoundingClientRect()

  // return {
  // height: elemRect.height,
  // left: elemRect.left - bodyRect.left,
  // top: elemRect.top - bodyRect.top,
  // width: elemRect.width,
  // }
  // }

  // How this works is kinda crappy. We have to plumb through this key => message helper and all this DOM stuff just to support this
  // _onEditLastMessage = () => {
  // let tuple: ?[number, Types.MessageKey, Types.TextMessage]
  // this.props.messageKeys.findLastEntry((v, k) => {
  // const m = this.props.getMessageFromMessageKey(v)
  // if (m && m.type === 'Text' && m.author === this.props.you) {
  // tuple = [k, v, m]
  // return true
  // }
  // return false
  // })
  // if (!tuple) {
  // return
  // }
  // const [idx, messageKey, message] = tuple
  // if (!Constants.textMessageEditable(message)) {
  // return
  // }
  // this._keepIdxVisible = idx
  // this.setState(prevState => ({listRerender: prevState.listRerender + 1}))
  // const listNode = ReactDOM.findDOMNode(this._list)
  // if (!(listNode instanceof window.Element)) {
  // return
  // }
  // const messageNodes = listNode.querySelectorAll(`[data-message-key="${messageKey}"]`)
  // if (!messageNodes) {
  // return
  // }
  // const messageNode = messageNodes[0]
  // if (!messageNode) {
  // return
  // }
  // this._showEditor(message, this._domNodeToRect(messageNode))
  // }

  // message: Types.TextMessage, messageRect: any
  // _showEditor = () => {
  // const popupComponent = (
  // <EditPopup
  // messageRect={messageRect}
  // onClose={this._hidePopup}
  // message={message.message.stringValue()}
  // onSubmit={text => {
  // this.props.onEditMessage(message, text)
  // }}
  // />
  // )
  // // Have to do this cause it's triggered from a popup that we're reusing else we'll get unmounted
  // setImmediate(() => {
  // const container = document.getElementById('popupContainer')
  // // FIXME: this is the right way to render portals retaining context for now, though it will change in the future.
  // ReactDOM.unstable_renderSubtreeIntoContainer(this, popupComponent, container)
  // })
  // }

  // _findMessageFromDOMNode(start: any): any {
  // const node = findDOMNode(start, '.message')
  // if (node) return node

  // // If not found, try to find it in the message-wrapper
  // const wrapper = findDOMNode(start, '.message-wrapper')
  // if (wrapper) {
  // const messageNodes = wrapper.getElementsByClassName('message')
  // if (messageNodes.length > 0) return messageNodes[0]
  // }

  // return null
  // }

  // message: Types.ServerMessage,
  // localMessageState: Types.LocalMessageState,
  // event: SyntheticEvent<>
  // _onShowMenu = () => {
  // if (message.type === 'Text' || message.type === 'Attachment') {
  // this.setState({selectedMessageKey: message.key})
  // const node = event.target instanceof window.HTMLElement ? event.target : null
  // const messageNode = this._findMessageFromDOMNode(event.target)
  // const messageRect = messageNode && this._domNodeToRect(messageNode)
  // this.props.onMessageAction(
  // message,
  // localMessageState,
  // () => {
  // if (message.type === 'Text') {
  // this._showEditor(message, messageRect)
  // }
  // },
  // () => {
  // this.setState({selectedMessageKey: null})
  // },
  // node && node.getBoundingClientRect()
  // )
  // }
  // }

  // message: Types.Message, event: SyntheticEvent<>
  // _onShowEditor = () => {
  // if (message.type === 'Text') {
  // const messageNode = this._findMessageFromDOMNode(event.target)
  // const messageRect = messageNode && this._domNodeToRect(messageNode)
  // if (messageRect) {
  // this._showEditor(message, messageRect)
  // }
  // }
  // }
}

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

export default PopupEnabledList
