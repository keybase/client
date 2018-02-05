// @flow
import * as React from 'react'
import {ModalLessPopupMenu as PopupMenu} from '../../../../common-adapters/popup-menu.desktop'
import * as Types from '../../../../constants/types/chat2'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import {connect, type TypedState, type Dispatch} from '../../../../util/container'
import MessagePopupHeader from './header'
import type {OwnProps, Props} from './attachment'

const mapStateToProps = (state: TypedState) => ({_you: state.config.username})

const mapDispatchToProps = (dispatch: Dispatch) => ({
  _onDelete: (message: Types.Message) =>
    dispatch(
      Chat2Gen.createMessageDelete({
        conversationIDKey: message.conversationIDKey,
        ordinal: message.ordinal,
      })
    ),
})

const mergeProps = (stateProps, dispatchProps, ownProps: OwnProps) => {
  const message = ownProps.message
  const yourMessage = message.author === stateProps._you
  return {
    message,
    onDelete: yourMessage ? () => dispatchProps._onDelete(message) : null,
    onHidden: () => ownProps.onClosePopup(),
    yourMessage,
  }
}

const AttachmentPopupMenu = (props: Props) => {
  // let downloadItem = null
  // if (message.messageState === 'placeholder') {
  // downloadItem = {disabled: true, title: `${message.author} is uploading…`}
  // } else if (!localMessageState.savedPath && message.messageID) {
  // downloadItem = {onClick: onDownloadAttachment, title: 'Download'}
  // }

  const items = [
    'Divider',
    // localMessageState.savedPath ? {onClick: onOpenInFileUI, title: `Show in ${fileUIName}`} : null,
    // downloadItem,
    ...(props.yourMessage
      ? [
          {
            danger: true,
            onClick: props.onDelete,
            subTitle: 'Deletes for everyone',
            title: 'Delete',
          },
        ]
      : []),
  ]

  const header = {
    title: 'header',
    view: (
      <MessagePopupHeader message={props.message} isLast={!items.length} yourMessage={props.yourMessage} />
    ),
  }
  return (
    <PopupMenu
      header={header}
      items={items}
      onHidden={props.onHidden}
      style={{...stylePopup, ...props.style}}
    />
  )
}

const stylePopup = {
  overflow: 'visible',
  width: 196,
}

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(AttachmentPopupMenu)
