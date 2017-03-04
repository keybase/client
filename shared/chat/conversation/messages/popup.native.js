// @flow
import React from 'react'
import {ActionSheetIOS} from 'react-native'
import {connect} from 'react-redux'
import {navigateUp} from '../../../actions/route-tree'
import {deleteMessage, showEditor} from '../../../actions/chat'
import {NativeClipboard, PopupMenu} from '../../../common-adapters/index.native'
import * as ChatConstants from '../../../constants/chat'
import MessagePopupHeader from './popup-header'
import {isIOS} from '../../../constants/platform'

import type {TextProps, AttachmentProps} from './popup'
import type {RouteProps} from '../../../route-tree/render-route'
import type {TypedState} from '../../../constants/reducer'
import type {ServerMessage, TextMessage} from '../../../constants/chat'

function MessagePopup ({message, onDeleteMessage, onHidden, onShowEditor, onSaveAttachment, onShareAttachment}: TextProps | AttachmentProps) {
  if (message.type !== 'Text' && message.type !== 'Attachment') return null

  const items = []

  if (message.type === 'Text') {
    const textMessage: TextMessage = message

    items.push({
      onClick: () => {
        onShowEditor(message)
        onHidden()
      },
      title: 'Edit',
    })
    items.push({
      onClick: () => {
        NativeClipboard.setString(textMessage.message.stringValue())
        onHidden()
      },
      title: 'Copy Text',
    })
  }

  items.push({
    danger: true,
    onClick: () => {
      onDeleteMessage(message)
      onHidden()
    },
    title: 'Delete',
  })

  if (message.type === 'Attachment') {
    const attachment: ChatConstants.AttachmentMessage = message
    items.push({
      onClick: () => {
        onSaveAttachment(attachment)
        onHidden()
      },
      title: 'Save Image',
    })

    if (isIOS) {
      items.push({
        onClick: () => {
          onShareAttachment(attachment)
          onHidden()
        },
        title: 'Share Image',
      })
    }
  }

  const menuProps = {
    header: {
      title: 'header',
      view: <MessagePopupHeader message={message} />,
    },
    items,
    onHidden,
  }

  return (
    <PopupMenu {...menuProps} />
  )
}

type MessagePopupRouteProps = RouteProps<{
  message: ServerMessage,
  onShowEditor: (message: TextMessage) => void,
}, {}>
type OwnProps = MessagePopupRouteProps & {}

export default connect(
  (state: TypedState, {routeProps}: OwnProps) => {
    const {message} = routeProps
    return {
      message,
    }
  },
  (dispatch: Dispatch, {routeProps}: OwnProps) => ({
    onDeleteMessage: (message: ServerMessage) => { dispatch(deleteMessage(message)) },
    onHidden: () => dispatch(navigateUp()),
    onShowEditor: () => dispatch(showEditor(routeProps.message)),
    onSaveAttachment: (message) => dispatch(({type: 'chat:saveAttachmentNative', payload: {message}}: ChatConstants.SaveAttachmentNative)),
    onShareAttachment: (message) => dispatch(({type: 'chat:shareAttachment', payload: {message}}: ChatConstants.ShareAttachment)),
  })
)(MessagePopup)
