// @flow
import React, {Component} from 'react'
import ReactDOM from 'react-dom'
import EditPopup from '../edit-popup.desktop'
import {TextPopupMenu, AttachmentPopupMenu} from '../messages/popup'
import {findDOMNode} from '../../../util/dom'

function HeaderHoc<P> (WrappedComponent: ReactClass<P>) {
function PopupWrapperHoc<P> = (WrappedComponent: ReactClass<P>) => {
  return class PopupWrapper extends Component {
    _hidePopup = () => {
      ReactDOM.unmountComponentAtNode(document.getElementById('popupContainer'))
      // this.setState({
        // selectedMessageKey: null,
      // })
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
        selectedMessageID: message.key,
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

    render () {
      return <ChatList {...this.props} />
    }
  }
}

export default PopupWrapperHOC
