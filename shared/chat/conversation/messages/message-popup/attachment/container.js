// @flow
import * as React from 'react'
import * as Chat2Gen from '../../../../../actions/chat2-gen'
import * as FsGen from '../../../../../actions/fs-gen'
import * as Constants from '../../../../../constants/chat2'
import * as Types from '../../../../../constants/types/chat2'
import * as RouteTreeGen from '../../../../../actions/route-tree-gen'
import {getCanPerform} from '../../../../../constants/teams'
import {connect} from '../../../../../util/container'
import {isMobile, isIOS} from '../../../../../constants/platform'
import type {Position} from '../../../../../common-adapters/relative-popup-hoc.types'
import type {StylesCrossPlatform} from '../../../../../styles/css'
import Attachment from '.'

type OwnProps = {
  attachTo: () => ?React.Component<any>,
  message: Types.MessageAttachment,
  onHidden: () => void,
  position: Position,
  style?: StylesCrossPlatform,
  visible: boolean,
}

const mapStateToProps = (state, ownProps: OwnProps) => {
  const message = ownProps.message
  const meta = Constants.getMeta(state, message.conversationIDKey)
  const yourOperations = getCanPerform(state, meta.teamname)
  const _canDeleteHistory = yourOperations && yourOperations.deleteChatHistory
  const _canAdminDelete = yourOperations && yourOperations.deleteOtherMessages
  return {
    _canAdminDelete,
    _canDeleteHistory,
    _you: state.config.username,
    pending: !!message.transferState,
  }
}

const mapDispatchToProps = dispatch => ({
  _onAddReaction: (message: Types.Message) => {
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [
          {
            props: {conversationIDKey: message.conversationIDKey, ordinal: message.ordinal},
            selected: 'chooseEmoji',
          },
        ],
      })
    )
  },
  _onDelete: (message: Types.Message) => {
    dispatch(
      Chat2Gen.createMessageDelete({
        conversationIDKey: message.conversationIDKey,
        ordinal: message.ordinal,
      })
    )
    dispatch(Chat2Gen.createNavigateToThread())
  },

  _onDownload: (message: Types.MessageAttachment) => {
    dispatch(
      Chat2Gen.createAttachmentDownload({
        message,
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
    message.downloadPath &&
      dispatch(FsGen.createOpenLocalPathInSystemFileManager({localPath: message.downloadPath}))
  },
})

const mergeProps = (stateProps, dispatchProps, ownProps: OwnProps) => {
  const message = ownProps.message
  const yourMessage = message.author === stateProps._you
  const isDeleteable = yourMessage || stateProps._canAdminDelete
  return {
    attachTo: ownProps.attachTo,
    author: message.author,
    deviceName: message.deviceName,
    deviceRevokedAt: message.deviceRevokedAt,
    deviceType: message.deviceType,
    isDeleteable,
    onAddReaction: isMobile ? () => dispatchProps._onAddReaction(message) : null,
    onDelete: isDeleteable ? () => dispatchProps._onDelete(message) : null,
    onDownload: !isMobile && !message.downloadPath ? () => dispatchProps._onDownload(message) : null,
    // We only show the share/save options for video if we have the file stored locally from a download
    onHidden: () => ownProps.onHidden(),
    onSaveAttachment:
      isMobile && message.attachmentType === 'image' ? () => dispatchProps._onSaveAttachment(message) : null,
    onShareAttachment: isIOS ? () => dispatchProps._onShareAttachment(message) : null,
    onShowInFinder: !isMobile && message.downloadPath ? () => dispatchProps._onShowInFinder(message) : null,
    pending: stateProps.pending,
    position: ownProps.position,
    style: ownProps.style,
    timestamp: message.timestamp,
    visible: ownProps.visible,
    yourMessage,
  }
}

export default connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(Attachment)
