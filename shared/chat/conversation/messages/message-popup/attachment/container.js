// @flow
import type {Component} from 'react'
import * as Chat2Gen from '../../../../../actions/chat2-gen'
import * as KBFSGen from '../../../../../actions/kbfs-gen'
import * as Route from '../../../../../actions/route-tree'
import * as Constants from '../../../../../constants/chat2'
import * as Types from '../../../../../constants/types/chat2'
import {getCanPerform} from '../../../../../constants/teams'
import {connect, type TypedState, type Dispatch} from '../../../../../util/container'
import {isMobile, isIOS} from '../../../../../constants/platform'
import type {Position} from '../../../../../common-adapters/relative-popup-hoc'
import Attachment from '.'

type OwnProps = {
  attachTo: ?Component<any, any>,
  message: Types.MessageAttachment,
  onHidden: () => void,
  position: Position,
  visible: boolean,
}

const mapStateToProps = (state: TypedState, ownProps: OwnProps) => {
  const message = ownProps.message
  const meta = Constants.getMeta(state, message.conversationIDKey)
  const yourOperations = getCanPerform(state, meta.teamname)
  const _canDeleteHistory = meta.teamType === 'adhoc' || (yourOperations && yourOperations.deleteChatHistory)
  return {
    _canDeleteHistory,
    _you: state.config.username,
  }
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
  _onDelete: (message: Types.Message) => {
    dispatch(
      Chat2Gen.createMessageDelete({
        conversationIDKey: message.conversationIDKey,
        ordinal: message.ordinal,
      })
    )
    dispatch(Chat2Gen.createNavigateToThread())
  },
  _onDeleteMessageHistory: (message: Types.Message) => {
    dispatch(Chat2Gen.createNavigateToThread())
    dispatch(Route.navigateAppend([{props: {message}, selected: 'deleteHistoryWarning'}]))
  },
  _onDownload: (message: Types.MessageAttachment) => {
    dispatch(
      Chat2Gen.createAttachmentDownload({
        conversationIDKey: message.conversationIDKey,
        ordinal: message.ordinal,
      })
    )
  },
  _onSaveAttachment: (message: Types.MessageAttachment) => {
    dispatch(
      Chat2Gen.createMessageAttachmentNativeSave({
        conversationIDKey: message.conversationIDKey,
        ordinal: message.ordinal,
      })
    )
  },
  _onShareAttachment: (message: Types.MessageAttachment) => {
    dispatch(
      Chat2Gen.createMessageAttachmentNativeShare({
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
    attachTo: ownProps.attachTo,
    author: message.author,
    deviceName: message.deviceName,
    deviceRevokedAt: message.deviceRevokedAt,
    deviceType: message.deviceType,
    onDelete: yourMessage ? () => dispatchProps._onDelete(message) : null,
    onDeleteMessageHistory: stateProps._canDeleteHistory
      ? () => dispatchProps._onDeleteMessageHistory(message)
      : null,
    onDownload: !isMobile && !message.downloadPath ? () => dispatchProps._onDownload(message) : null,
    onHidden: () => ownProps.onHidden(),
    onSaveAttachment:
      isMobile && message.attachmentType === 'image' ? () => dispatchProps._onSaveAttachment(message) : null,
    onShareAttachment: isIOS ? () => dispatchProps._onShareAttachment(message) : null,
    onShowInFinder: !isMobile && message.downloadPath ? () => dispatchProps._onShowInFinder(message) : null,
    position: ownProps.position,
    timestamp: message.timestamp,
    visible: ownProps.visible,
    yourMessage,
  }
}

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(Attachment)
