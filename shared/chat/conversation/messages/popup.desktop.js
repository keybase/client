// @flow
import * as React from 'react'
import * as I from 'immutable'
import {ModalLessPopupMenu as PopupMenu} from '../../../common-adapters/popup-menu.desktop'
import {textMessageEditable} from '../../../constants/chat'
import * as Types from '../../../constants/types/chat'
import * as ChatGen from '../../../actions/chat-gen'
import * as KBFSGen from '../../../actions/kbfs-gen'
import {fileUIName} from '../../../constants/platform'
import {connect} from 'react-redux'
import {branch, renderComponent} from 'recompose'

import MessagePopupHeader from './popup-header'

import type {TextProps, AttachmentProps} from './popup'
import type {TypedState} from '../../../util/container'

const stylePopup = {
  overflow: 'visible',
  width: 196,
}

const TextPopupMenu = ({message, onShowEditor, onDeleteMessage, onHidden, style, you}: TextProps) => {
  let items = []
  if (message.author === you) {
    if (!message.senderDeviceRevokedAt) {
      items.push('Divider')
    }

    if (textMessageEditable(message)) {
      items.push({onClick: () => onShowEditor(message), title: 'Edit'})
    } else {
      items.push({disabled: true, title: 'Edit'})
    }

    items.push({
      danger: true,
      onClick: () => onDeleteMessage(message),
      subTitle: 'Deletes for everyone',
      title: 'Delete',
    })
  }
  const header = {
    title: 'header',
    view: <MessagePopupHeader message={message} isLast={!items.length} />,
  }
  return <PopupMenu header={header} items={items} onHidden={onHidden} style={{...stylePopup, ...style}} />
}

const AttachmentPopupMenu = ({
  message,
  localMessageState,
  onDeleteMessage,
  onOpenInFileUI,
  onDownloadAttachment,
  onHidden,
  style,
  you,
}: AttachmentProps) => {
  let downloadItem = null
  if (message.messageState === 'placeholder') {
    downloadItem = {disabled: true, title: `${message.author} is uploading…`}
  } else if (!localMessageState.savedPath && message.messageID) {
    downloadItem = {onClick: onDownloadAttachment, title: 'Download'}
  }

  const items = [
    'Divider',
    localMessageState.savedPath ? {onClick: onOpenInFileUI, title: `Show in ${fileUIName}`} : null,
    downloadItem,
  ]
  if (message.author === you) {
    items.push({
      danger: true,
      onClick: () => onDeleteMessage(message),
      subTitle: 'Deletes for everyone',
      title: 'Delete',
    })
  }
  const header = {
    title: 'header',
    view: <MessagePopupHeader message={message} />,
  }
  return <PopupMenu header={header} items={items} onHidden={onHidden} style={{...stylePopup, ...style}} />
}

type ConnectedTextMessageProps = {
  routeProps: I.RecordOf<{
    message: Types.TextMessage,
    onShowEditor: () => void,
  }>,
}

// $FlowIssue doen'st like routeProps here
const mapStateToProps = ({config: {username}}: TypedState, {routeProps}) => ({
  you: username,
  message: routeProps.get('message'),
})

const mapDispatchToTextProps = (
  dispatch,
  {routeProps, navigateUp}: ConnectedTextMessageProps & {navigateUp: () => any}
) => ({
  onDeleteMessage: (message: Types.Message) =>
    dispatch(ChatGen.createDeleteMessage({message: routeProps.get('message')})),
  onShowEditor: () => {
    dispatch(navigateUp())
    routeProps.get('onShowEditor')()
  },
  onHidden: () => {},
})

const ConnectedTextMessage = connect(mapStateToProps, mapDispatchToTextProps)(TextPopupMenu)

type ConnectedAttachmentMessageProps = {
  routeProps: I.RecordOf<{
    message: Types.AttachmentMessage,
    localMessageState: Types.LocalMessageState,
  }>,
}

const mapDispatchToAttachmentProps = (dispatch, {routeProps}: ConnectedAttachmentMessageProps) => {
  const localMessageState = routeProps.get('localMessageState')
  const message = routeProps.get('message')
  const {savedPath} = localMessageState
  const {key: messageKey} = message
  return {
    onOpenInFileUI: () => savedPath && dispatch(KBFSGen.createOpenInFileUI({path: savedPath})),
    onDownloadAttachment: () => dispatch(ChatGen.createSaveAttachment({messageKey})),
    onDeleteMessage: (message: Types.Message) =>
      dispatch(ChatGen.createDeleteMessage({message: routeProps.get('message')})),
    onHidden: () => {},
    localMessageState,
  }
}

const ConnectedAttachmentMessage = connect(mapStateToProps, mapDispatchToAttachmentProps)(AttachmentPopupMenu)

const ConnectedMessageAction = branch(
  // $FlowIssue doesn't like routeProps
  ({routeProps}: {routeProps: I.RecordOf<{message: Types.TextMessage | Types.AttachmentMessage}>}) =>
    routeProps.get('message').type === 'Attachment',
  renderComponent(ConnectedAttachmentMessage)
)(ConnectedTextMessage)

export {AttachmentPopupMenu, TextPopupMenu, ConnectedMessageAction}
