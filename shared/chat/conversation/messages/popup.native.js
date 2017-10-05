// @flow
import * as React from 'react'
import {connect} from 'react-redux'
import {deleteMessage, showEditor} from '../../../actions/chat/creators'
import {NativeClipboard, PopupMenu} from '../../../common-adapters/index.native'
import * as ChatConstants from '../../../constants/chat'
import MessagePopupHeader from './popup-header'
import {isIOS} from '../../../constants/platform'

import type {TextProps, AttachmentProps} from './popup'
import type {RouteProps} from '../../../route-tree/render-route'
import type {TypedState} from '../../../constants/reducer'
import type {ServerMessage, TextMessage} from '../../../constants/chat'

function _textMessagePopupHelper({message, type, onDeleteMessage, onHidden, onShowEditor, you}: TextProps) {
  const edit = message.author === you
    ? [
        {
          onClick: () => {
            onShowEditor(message)
          },
          title: 'Edit',
        },
      ]
    : []

  const copy = [
    {
      onClick: () => {
        NativeClipboard.setString(message.message.stringValue())
      },
      title: 'Copy Text',
    },
  ]

  return [...edit, ...copy]
}

function _attachmentMessagePopupHelper({
  message,
  onSaveAttachment,
  onShareAttachment,
  onHidden,
}: AttachmentProps) {
  const attachment: ChatConstants.AttachmentMessage = message
  const items = []
  let itemType = 'File'
  if (attachment.filename != null && ChatConstants.isImageFileName(attachment.filename)) itemType = 'Image'
  items.push({
    onClick: () => {
      onSaveAttachment && onSaveAttachment(attachment)
    },
    title: 'Save ' + itemType,
  })

  if (isIOS && onShareAttachment) {
    items.push({
      onClick: () => {
        onShareAttachment && onShareAttachment(attachment)
      },
      title: 'Share ' + itemType,
    })
  }

  return items
}

function MessagePopup(props: TextProps | AttachmentProps) {
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
      items = [
        {
          disabled: true,
          title: `${message.author} is uploading…`,
        },
      ]
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

  return <PopupMenu {...menuProps} />
}

type MessagePopupRouteProps = RouteProps<
  {
    message: ServerMessage,
    onShowEditor: (message: TextMessage) => void,
  },
  {}
>
type OwnProps = MessagePopupRouteProps & {}

export default connect(
  (state: TypedState, {routeProps}: OwnProps) => {
    const message = routeProps.get('message')
    const you = state.config.username
    return {
      message,
      you,
    }
  },
  (dispatch: Dispatch, {routeProps, navigateUp}: OwnProps) => ({
    onDeleteMessage: (message: ServerMessage) => {
      dispatch(deleteMessage(message))
    },
    onHidden: () => dispatch(navigateUp()),
    onShowEditor: () => dispatch(showEditor(routeProps.get('message'))),
    onSaveAttachment: message =>
      dispatch(
        ({
          type: 'chat:saveAttachmentNative',
          payload: {messageKey: message.key},
        }: ChatConstants.SaveAttachmentNative)
      ),
    onShareAttachment: message =>
      dispatch(
        ({type: 'chat:shareAttachment', payload: {messageKey: message.key}}: ChatConstants.ShareAttachment)
      ),
  })
)(MessagePopup)
