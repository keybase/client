import * as React from 'react'
import * as Chat2Gen from '../../../../../actions/chat2-gen'
import * as ConfigGen from '../../../../../actions/config-gen'
import * as DeeplinksConstants from '../../../../../constants/deeplinks'
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
    const _teamMembers = state.teams.teamIDToMembers.get(meta.teamID)
    const _label = Constants.getConversationLabel(state, meta, true)
    return {
      _authorIsBot,
      _canAdminDelete,
      _canDeleteHistory,
      _canPinMessage,
      _label,
      _teamID: meta.teamID,
      _teamMembers,
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
              props: {
                conversationIDKey: message.conversationIDKey,
                onPickAddToMessageOrdinal: message.ordinal,
              },
              selected: 'chatChooseEmoji',
            },
          ],
        })
      )
    },
    _onAllMedia: (conversationIDKey: Types.ConversationIDKey) => {
      dispatch(RouteTreeGen.createClearModals())
      dispatch(Chat2Gen.createShowInfoPanel({conversationIDKey, show: true, tab: 'attachments'}))
    },
    _onCopyLink: (label: string, message: Types.Message) =>
      dispatch(
        ConfigGen.createCopyToClipboard({text: DeeplinksConstants.linkFromConvAndMessage(label, message.id)})
      ),
    _onDelete: (message: Types.Message) => {
      dispatch(
        Chat2Gen.createMessageDelete({
          conversationIDKey: message.conversationIDKey,
          ordinal: message.ordinal,
        })
      )
      dispatch(RouteTreeGen.createClearModals())
    },
    _onDownload: (message: Types.MessageAttachment) => {
      dispatch(
        Chat2Gen.createAttachmentDownload({
          message,
        })
      )
    },
    _onForward: (message: Types.Message) => {
      dispatch(
        RouteTreeGen.createNavigateAppend({
          path: [
            {
              props: {ordinal: message.ordinal, srcConvID: message.conversationIDKey},
              selected: 'chatForwardMsgPick',
            },
          ],
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
          path: [{props: {members: [username], teamID}, selected: 'teamReallyRemoveMember'}],
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
    _onReact: (message: Types.Message, emoji: string) => {
      dispatch(
        Chat2Gen.createToggleMessageReaction({
          conversationIDKey: message.conversationIDKey,
          emoji,
          ordinal: message.ordinal,
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
    const authorInTeam = stateProps._teamMembers?.has(message.author) ?? true
    return {
      attachTo: ownProps.attachTo,
      author: message.author,
      deviceName: message.deviceName,
      deviceRevokedAt: message.deviceRevokedAt || undefined,
      deviceType: message.deviceType,
      isDeleteable,
      isKickable: isDeleteable && !!stateProps._teamID && !yourMessage && authorInTeam,
      onAddReaction: isMobile ? () => dispatchProps._onAddReaction(message) : undefined,
      onAllMedia: () => dispatchProps._onAllMedia(message.conversationIDKey),
      onCopyLink: () => dispatchProps._onCopyLink(stateProps._label, message),
      onDelete: isDeleteable ? () => dispatchProps._onDelete(message) : undefined,
      onDownload: !isMobile && !message.downloadPath ? () => dispatchProps._onDownload(message) : undefined,
      onForward: () => dispatchProps._onForward(message),
      onHidden: () => ownProps.onHidden(),
      onInstallBot: stateProps._authorIsBot ? () => dispatchProps._onInstallBot(message) : undefined,
      onKick: () => dispatchProps._onKick(stateProps._teamID, message.author),
      onPinMessage: stateProps._canPinMessage ? () => dispatchProps._onPinMessage(message) : undefined,
      onReact: (emoji: string) => dispatchProps._onReact(message, emoji),
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
