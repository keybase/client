// @flow
import * as Chat2Gen from '../../../../actions/chat2-gen'
import * as KBFSGen from '../../../../actions/kbfs-gen'
import * as Route from '../../../../actions/route-tree'
import * as React from 'react'
import * as Types from '../../../../constants/types/chat2'
import {chatTab} from '../../../../constants/tabs'
import MessagePopupHeader from './header'
import type {OwnProps, Props} from './attachment'
import {ModalLessPopupMenu as PopupMenu} from '../../../../common-adapters/popup-menu.desktop'
import {connect, type TypedState, type Dispatch} from '../../../../util/container'
import {fileUIName, isMobile} from '../../../../styles'

const mapStateToProps = (state: TypedState) => ({_you: state.config.username})

const mapDispatchToProps = (dispatch: Dispatch) => ({
  _onDelete: (message: Types.Message) => {
    dispatch(
      Chat2Gen.createMessageDelete({
        conversationIDKey: message.conversationIDKey,
        ordinal: message.ordinal,
      })
    )
    dispatch(Route.navigateTo([{props: {}, selected: null}], [chatTab]))
  },
  _onDownload: (message: Types.MessageAttachment) => {
    dispatch(
      Chat2Gen.createAttachmentDownload({
        conversationIDKey: message.conversationIDKey,
        ordinal: message.ordinal,
      })
    )
  },
  _onShowInFinder: (message: Types.MessageAttachment) => {
    message.downloadPath && dispatch(KBFSGen.createOpenInFileUI({path: message.downloadPath}))
  },
})

const mergeProps = (stateProps, dispatchProps, ownProps: OwnProps) => {
  const message = ownProps.message
  const yourMessage = message.author === stateProps._you
  return {
    message,
    onDelete: yourMessage ? () => dispatchProps._onDelete(message) : null,
    onDownload: !isMobile && !message.downloadPath ? () => dispatchProps._onDownload(message) : null,
    onHidden: () => ownProps.onClosePopup(),
    onShowInFinder:
      !isMobile && message.downloadPath ? () => dispatchProps._onShowInFinder(message) : undefined,
    yourMessage,
  }
}

const AttachmentPopupMenu = (props: Props) => {
  const items = [
    'Divider',
    ...(props.onShowInFinder ? [{onClick: props.onShowInFinder, title: `Show in ${fileUIName}`}] : []),
    ...(props.onDownload ? [{onClick: props.onDownload, title: 'Download'}] : []),
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
      closeOnClick={true}
      style={{...stylePopup, ...props.style}}
    />
  )
}

const stylePopup = {
  overflow: 'visible',
  width: 196,
}

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(AttachmentPopupMenu)
