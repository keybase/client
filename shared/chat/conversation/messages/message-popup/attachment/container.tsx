import * as React from 'react'
import * as Chat2Gen from '../../../../../actions/chat2-gen'
import * as FsGen from '../../../../../actions/fs-gen'
import * as Constants from '../../../../../constants/chat2'
import * as Types from '../../../../../constants/types/chat2'
import * as RouteTreeGen from '../../../../../actions/route-tree-gen'
import {getCanPerform} from '../../../../../constants/teams'
import * as Container from '../../../../../util/container'
import {isMobile, isIOS} from '../../../../../constants/platform'
import {Position} from '../../../../../common-adapters/relative-popup-hoc.types'
import {StylesCrossPlatform} from '../../../../../styles/css'
import Attachment from '.'

type OwnProps = {
  attachTo?: () => React.Component<any> | null
  message: Types.MessageAttachment
  onHidden: () => void
  position: Position
  style?: StylesCrossPlatform
  visible: boolean
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
            selected: 'chatChooseEmoji',
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
  _onReply: (message: Types.Message) => {
    dispatch(
      Chat2Gen.createToggleReplyToMessage({
        conversationIDKey: message.conversationIDKey,
        ordinal: message.ordinal,
      })
    )
  },
  _onSaveAttachment: (message: Types.MessageAttachment) => {
    dispatch(
      Chat2Gen.createMessageAttachmentNativeSave({
        message,
      })
    )
  },
  _onShareAttachment: (message: Types.MessageAttachment) => {
    dispatch(
      Chat2Gen.createMessageAttachmentNativeShare({
        message,
      })
    )
  },
  _onShowInFinder: (message: Types.MessageAttachment) => {
    message.downloadPath &&
      dispatch(FsGen.createOpenLocalPathInSystemFileManager({localPath: message.downloadPath}))
  },
})

export default Container.connect(
  mapStateToProps,
  mapDispatchToProps,

  (stateProps, dispatchProps, ownProps: OwnProps) => {
    const message = ownProps.message
    const yourMessage = message.author === stateProps._you
    const isDeleteable = yourMessage || stateProps._canAdminDelete
    return {
      attachTo: ownProps.attachTo,
      author: message.author,
      deviceName: message.deviceName,
      deviceRevokedAt: message.deviceRevokedAt || undefined,
      deviceType: message.deviceType,
      isDeleteable,
      onAddReaction: isMobile ? () => dispatchProps._onAddReaction(message) : undefined,
      onDelete: isDeleteable ? () => dispatchProps._onDelete(message) : undefined,
      onDownload: !isMobile && !message.downloadPath ? () => dispatchProps._onDownload(message) : undefined,
      // We only show the share/save options for video if we have the file stored locally from a download
      onHidden: () => ownProps.onHidden(),
      onReply: () => dispatchProps._onReply(message),
      onSaveAttachment:
        isMobile && message.attachmentType === 'image'
          ? () => dispatchProps._onSaveAttachment(message)
          : undefined,
      onShareAttachment: isIOS ? () => dispatchProps._onShareAttachment(message) : undefined,
      onShowInFinder:
        !isMobile && message.downloadPath ? () => dispatchProps._onShowInFinder(message) : undefined,
      pending: stateProps.pending,
      position: ownProps.position,
      style: ownProps.style,
      timestamp: message.timestamp,
      visible: ownProps.visible,
      yourMessage,
    }
  }
)(Attachment)
