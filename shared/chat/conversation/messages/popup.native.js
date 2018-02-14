// @flow
import * as ChatConstants from '../../../constants/chat'
import * as Types from '../../../constants/types/chat'
import * as ChatGen from '../../../actions/chat-gen'
import * as React from 'react'
import MessagePopupHeader from './popup-header'
import {NativeClipboard, PopupMenu} from '../../../common-adapters/index.native'
import {connect, type TypedState} from '../../../util/container'
import {isIOS} from '../../../constants/platform'
import {navigateAppend} from '../../../actions/route-tree'

import {type RouteProps} from '../../../route-tree/render-route'
import {type TextProps, type AttachmentProps} from './popup'

function _textMessagePopupHelper({
  message,
  type,
  onDeleteMessage,
  onDeleteMessageHistory,
  onHidden,
  onShowEditor,
  you,
}: TextProps) {
  const edit =
    message.author === you
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
  const attachment: Types.AttachmentMessage = message
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
  const {message, onDeleteMessage, onDeleteMessageHistory, onHidden, you} = props
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
      onClick: () => onDeleteMessage(message),
      title: 'Delete',
    })
  }
  items.push({
    danger: true,
    onClick: () => onDeleteMessageHistory && onDeleteMessageHistory(message),
    title: 'Delete all messages before this one',
  })

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
    message: Types.ServerMessage,
    onShowEditor: (message: Types.TextMessage) => void,
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
    onDeleteMessage: (message: Types.ServerMessage) => {
      dispatch(ChatGen.createDeleteMessage({message}))
    },
    onDeleteMessageHistory: message => {
      dispatch(navigateUp())
      dispatch(navigateAppend([{props: {message}, selected: 'deleteHistoryWarning'}]))
    },
    onHidden: () => dispatch(navigateUp()),
    onShowEditor: () => dispatch(ChatGen.createShowEditor({message: routeProps.get('message')})),
    onSaveAttachment: message =>
      dispatch(
        ChatGen.createSaveAttachmentNative({
          messageKey: message.key,
        })
      ),
    onShareAttachment: message =>
      dispatch(
        ChatGen.createShareAttachment({
          messageKey: message.key,
        })
      ),
  })
)(MessagePopup)
