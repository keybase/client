import * as React from 'react'
import * as Chat2Gen from '../../../../../actions/chat2-gen'
import * as FsGen from '../../../../../actions/fs-gen'
import * as Constants from '../../../../../constants/chat2'
import * as Types from '../../../../../constants/types/chat2'
import * as TeamTypes from '../../../../../constants/types/teams'
import * as RouteTreeGen from '../../../../../actions/route-tree-gen'
import {getCanPerformByID} from '../../../../../constants/teams'
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

export default Container.connect(
  (state, ownProps: OwnProps) => {
    const message = ownProps.message
    const meta = Constants.getMeta(state, message.conversationIDKey)
    const isTeam = !!meta.teamname
    const participantInfo = Constants.getParticipantInfo(state, message.conversationIDKey)
    const yourOperations = getCanPerformByID(state, meta.teamID)
    const _canDeleteHistory = yourOperations && yourOperations.deleteChatHistory
    const _canAdminDelete = yourOperations && yourOperations.deleteOtherMessages
    const _canPinMessage = !isTeam || (yourOperations && yourOperations.pinMessage)
    const _authorIsBot = Constants.messageAuthorIsBot(state, meta, message, participantInfo)
    return {
      _authorIsBot,
      _canAdminDelete,
      _canDeleteHistory,
      _canPinMessage,
      _participants: participantInfo.all,
      _teamID: meta.teamID,
      _you: state.config.username,
      pending: !!message.transferState,
    }
  },
  dispatch => ({
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
    _onAllMedia: (conversationIDKey: Types.ConversationIDKey) =>
      dispatch(
        RouteTreeGen.createNavigateAppend({
          path: [
            {
              props: {conversationIDKey, tab: 'attachments'},
              selected: 'chatInfoPanel',
            },
          ],
        })
      ),
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
    _onInstallBot: (message: Types.Message) => {
      dispatch(
        RouteTreeGen.createNavigateAppend({
          path: [{props: {botUsername: message.author, navToChat: true}, selected: 'chatInstallBotPick'}],
        })
      )
    },
    _onKick: (teamID: TeamTypes.TeamID, username: string) =>
      dispatch(
        RouteTreeGen.createNavigateAppend({
          path: [{props: {navToChat: true, teamID, username}, selected: 'teamReallyRemoveMember'}],
        })
      ),
    _onPinMessage: (message: Types.Message) => {
      dispatch(
        Chat2Gen.createPinMessage({
          conversationIDKey: message.conversationIDKey,
          messageID: message.id,
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
  }),
  (stateProps, dispatchProps, ownProps: OwnProps) => {
    const message = ownProps.message
    const yourMessage = message.author === stateProps._you
    const isDeleteable = yourMessage || stateProps._canAdminDelete
    const authorInConv = stateProps._participants.includes(message.author)
    return {
      attachTo: ownProps.attachTo,
      author: message.author,
      deviceName: message.deviceName,
      deviceRevokedAt: message.deviceRevokedAt || undefined,
      deviceType: message.deviceType,
      isDeleteable,
      isKickable: isDeleteable && !!stateProps._teamID && !yourMessage && authorInConv,
      onAddReaction: isMobile ? () => dispatchProps._onAddReaction(message) : undefined,
      onAllMedia: () => dispatchProps._onAllMedia(message.conversationIDKey),
      onDelete: isDeleteable ? () => dispatchProps._onDelete(message) : undefined,
      onDownload: !isMobile && !message.downloadPath ? () => dispatchProps._onDownload(message) : undefined,
      // We only show the share/save options for video if we have the file stored locally from a download
      onHidden: () => ownProps.onHidden(),
      onInstallBot: stateProps._authorIsBot ? () => dispatchProps._onInstallBot(message) : undefined,
      onKick: () => dispatchProps._onKick(stateProps._teamID, message.author),
      onPinMessage: stateProps._canPinMessage ? () => dispatchProps._onPinMessage(message) : undefined,
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
