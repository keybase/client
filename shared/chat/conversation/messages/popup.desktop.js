// @flow
import * as React from 'react'
import * as I from 'immutable'
import {ModalLessPopupMenu as PopupMenu} from '../../../common-adapters/popup-menu.desktop'
// import {textMessageEditable} from '../../../constants/chat'
import * as Types from '../../../constants/types/chat2'
import * as Chat2Gen from '../../../actions/chat2-gen'
import * as KBFSGen from '../../../actions/kbfs-gen'
import {fileUIName} from '../../../constants/platform'
import {
  compose,
  connect,
  branch,
  renderComponent,
  type TypedState,
  type Dispatch,
} from '../../../util/container'
import MessagePopupHeader from './popup-header'

type OwnProps = {
  routeProps: I.RecordOf<{message: Types.MessageText}>,
  onClosePopup: () => void,
}

type TextProps = {
  message: Types.MessageText,
  onDelete: ?() => void,
  onEdit: ?() => void,
  onHidden: () => void,
  showDivider: boolean,
  style?: Object,
  yourMessage: boolean,
}

// type AttachmentProps = {
// localMessageState: LocalMessageState,
// message: any, // TODO
// onDelete: ?() => void,
// onDownloadAttachment: () => void,
// onHidden: () => void,
// onOpenInFileUI: () => void,
// onSaveAttachment?: () => void,
// onShareAttachment?: () => void,
// style?: Object,
// }

const TextPopupMenu = ({message, yourMessage, showDivider, onEdit, onDelete, style, onHidden}: TextProps) => {
  const items = yourMessage
    ? [
        ...(showDivider ? ['Divider'] : []),
        {disabled: !onEdit, onClick: onEdit, title: 'Edit'},
        {
          danger: true,
          disabled: !onDelete,
          onClick: onDelete,
          subTitle: 'Deletes for everyone',
          title: 'Delete',
        },
      ]
    : []

  const header = {
    title: 'header',
    view: <MessagePopupHeader message={message} isLast={!items.length} yourMessage={yourMessage} />,
  }
  return (
    <PopupMenu
      closeOnClick={true}
      header={header}
      items={items}
      onHidden={onHidden}
      style={{...stylePopup, ...style}}
    />
  )
}

const mapStateToProps = (state: TypedState) => ({_you: state.config.username})

const mapDispatchToTextProps = (dispatch: Dispatch) => ({
  _onDelete: (message: Types.Message) =>
    dispatch(
      Chat2Gen.createMessagesDelete({
        conversationIDKey: message.conversationIDKey,
        ordinals: [message.ordinal],
      })
    ),
  _onEdit: (message: Types.Message) => {},
})

const mergeTextProps = (stateProps, dispatchProps, ownProps: OwnProps) => {
  const message = ownProps.routeProps.get('message')
  const yourMessage = message.author === stateProps._you
  return {
    message,
    onDelete: yourMessage ? () => dispatchProps._onDelete(message) : null,
    onEdit: yourMessage ? () => dispatchProps._onEdit(message) : null, // TODO some things aren't editable
    onHidden: () => ownProps.onClosePopup(),
    showDivider: !message.deviceRevokedAt,
    yourMessage,
  }
}

// $FlowIssue popup plus routeProps not there
const ConnectedTextMessage = connect(mapStateToProps, mapDispatchToTextProps, mergeTextProps)(TextPopupMenu)

// type ConnectedAttachmentMessageProps = {
// routeProps: I.RecordOf<{
// message: Types.AttachmentMessage,
// localMessageState: Types.LocalMessageState,
// }>,
// }

// const mapDispatchToAttachmentProps = (dispatch, {routeProps}: ConnectedAttachmentMessageProps) => {
// const localMessageState = routeProps.get('localMessageState')
// const message = routeProps.get('message')
// const {savedPath} = localMessageState
// const {key: messageKey} = message
// return {
// onOpenInFileUI: () => savedPath && dispatch(KBFSGen.createOpenInFileUI({path: savedPath})),
// onDownloadAttachment: () => dispatch(ChatGen.createSaveAttachment({messageKey})),
// onDelete: (message: Types.Message) =>
// dispatch(ChatGen.createDeleteMessage({message: routeProps.get('message')})),
// onHidden: () => {},
// localMessageState,
// }
// }

// const AttachmentPopupMenu = ({
// message,
// localMessageState,
// onDelete,
// onOpenInFileUI,
// onDownloadAttachment,
// onHidden,
// style,
// you,
// }: AttachmentProps) => {
// let downloadItem = null
// if (message.messageState === 'placeholder') {
// downloadItem = {disabled: true, title: `${message.author} is uploading…`}
// } else if (!localMessageState.savedPath && message.messageID) {
// downloadItem = {onClick: onDownloadAttachment, title: 'Download'}
// }

// const items = [
// 'Divider',
// localMessageState.savedPath ? {onClick: onOpenInFileUI, title: `Show in ${fileUIName}`} : null,
// downloadItem,
// ...(message.author === you
// ? [
// {
// danger: true,
// onClick: onDelete,
// subTitle: 'Deletes for everyone',
// title: 'Delete',
// },
// ]
// : []),
// ]

// const header = {
// title: 'header',
// view: <MessagePopupHeader message={message} />,
// }
// return <PopupMenu header={header} items={items} onHidden={onHidden} style={{...stylePopup, ...style}} />
// }

// const ConnectedAttachmentMessage = connect(mapStateToProps, mapDispatchToAttachmentProps)(AttachmentPopupMenu)

const ConnectedMessageAction = compose(
  // branch(
  // (props: OwnProps) => props.routeProps.routeProps.get('message').type === 'attachment',
  // renderComponent(ConnectedAttachmentMessage)
  // ),
  branch(
    (props: OwnProps) => props.routeProps.get('message').type === 'text',
    renderComponent(ConnectedTextMessage)
  )
)(() => null)

const stylePopup = {
  overflow: 'visible',
  width: 196,
}

export {/* AttachmentPopupMenu, */ TextPopupMenu, ConnectedMessageAction}
