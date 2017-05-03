// @flow
import React from 'react'
import {connect} from 'react-redux'
import {navigateUp} from '../../../actions/route-tree'
import {deleteMessage, showEditor} from '../../../actions/chat/creators'
import {NativeClipboard, PopupMenu} from '../../../common-adapters/index.native'
import * as ChatConstants from '../../../constants/chat'
import MessagePopupHeader from './popup-header'
import {isIOS} from '../../../constants/platform'

import type {TextProps, AttachmentProps} from './popup'
import type {RouteProps} from '../../../route-tree/render-route'
import type {TypedState} from '../../../constants/reducer'
import type {ServerMessage, TextMessage} from '../../../constants/chat'

function _textMessagePopupHelper ({message, type, onDeleteMessage, onHidden, onShowEditor, you}: TextProps) {
  const edit = message.author === you ? [{
    onClick: () => {
      onShowEditor(message)
      onHidden()
    },
    title: 'Edit',
  }] : []

  const copy = [{
    onClick: () => {
      NativeClipboard.setString(message.message.stringValue())
      onHidden()
    },
    title: 'Copy Text',
  }]

  return [...edit, ...copy]
}

function _attachmentMessagePopupHelper ({message, onSaveAttachment, onShareAttachment, onHidden}: AttachmentProps) {
  const attachment: ChatConstants.AttachmentMessage = message
  const items = []
  items.push({
    onClick: () => {
      onSaveAttachment && onSaveAttachment(attachment)
      onHidden()
    },
    title: 'Save Image',
  })

  if (isIOS && onShareAttachment) {
    items.push({
      onClick: () => {
        onShareAttachment && onShareAttachment(attachment)
        onHidden()
      },
      title: 'Share Image',
    })
  }

  return items
}

function MessagePopup (props: TextProps | AttachmentProps) {
  const {message, onDeleteMessage, onHidden, you} = props
  if (message.type !== 'Text' && message.type !== 'Attachment') return null

  let items = []

  if (message.type === 'Text') {
    // $FlowIssue can't figure out variants from variant in the .message field
    const tProps: TextProps = props
    items = items.concat(_textMessagePopupHelper(tProps))
  }

  if (message.type === 'Attachment') {
    if (message.messageState === 'placeholder') {
      items = [{
        disabled: true,
        title: `${message.author} is uploading…`,
      }]
    } else {
      // $FlowIssue can't figure out variants from variant in the .message field
      const aProps: AttachmentProps = props
      items = items.concat(_attachmentMessagePopupHelper(aProps))
    }
  }

  if (message.author === you) {
    items.push({
      danger: true,
      onClick: () => {
        onDeleteMessage(message)
        onHidden()
      },
      title: 'Delete',
    })
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
    const you = state.config.username
    return {
      message,
      you,
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
