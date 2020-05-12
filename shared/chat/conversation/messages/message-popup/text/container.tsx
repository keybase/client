import * as React from 'react'
import * as ConfigGen from '../../../../../actions/config-gen'
import * as Chat2Gen from '../../../../../actions/chat2-gen'
import * as Constants from '../../../../../constants/chat2'
import * as DeeplinksConstants from '../../../../../constants/deeplinks'
import * as Types from '../../../../../constants/types/chat2'
import * as TeamTypes from '../../../../../constants/types/teams'
import * as RouteTreeGen from '../../../../../actions/route-tree-gen'
import * as Container from '../../../../../util/container'
import {createShowUserProfile} from '../../../../../actions/profile-gen'
import {getCanPerformByID} from '../../../../../constants/teams'
import {Position} from '../../../../../common-adapters/relative-popup-hoc.types'
import {StylesCrossPlatform} from '../../../../../styles/css'
import openURL from '../../../../../util/open-url'
import Text from '.'

type OwnProps = {
  attachTo?: () => React.Component<any> | null
  message: Types.MessagesWithReactions
  onHidden: () => void
  position: Position
  style?: StylesCrossPlatform
  visible: boolean
}

const mapStateToProps = (state: Container.TypedState, ownProps: OwnProps) => {
  const message = ownProps.message
  const meta = Constants.getMeta(state, message.conversationIDKey)
  const participantInfo = Constants.getParticipantInfo(state, message.conversationIDKey)
  const yourOperations = getCanPerformByID(state, meta.teamID)
  const _canDeleteHistory = yourOperations && yourOperations.deleteChatHistory
  const _canAdminDelete = yourOperations && yourOperations.deleteOtherMessages
  const _label = Constants.getConversationLabel(state, meta, true)
  let _canPinMessage = message.type === 'text'
  if (_canPinMessage && meta.teamname) {
    _canPinMessage = yourOperations && yourOperations.pinMessage
  }
  // you can reply privately *if* text message, someone else's message, and not in a 1-on-1 chat
  const _canReplyPrivately =
    message.type === 'text' && (['small', 'big'].includes(meta.teamType) || participantInfo.all.length > 2)
  const authorIsBot = Constants.messageAuthorIsBot(state, meta, message, participantInfo)
  const _teamMembers = state.teams.teamIDToMembers.get(meta.teamID)
  return {
    _authorIsBot: authorIsBot,
    _canAdminDelete,
    _canDeleteHistory,
    _canPinMessage,
    _canReplyPrivately,
    _isDeleteable: message.isDeleteable,
    _isEditable: message.isEditable,
    _label,
    _participants: participantInfo.all,
    _teamID: meta.teamID,
    _teamMembers,
    _teamname: meta.teamname,
    _you: state.config.username,
  }
}

const mapDispatchToProps = (dispatch: Container.TypedDispatch) => ({
  _onAddReaction: (message: Types.Message) => {
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [
          {
            props: {conversationIDKey: message.conversationIDKey, onPickAddToMessageOrdinal: message.ordinal},
            selected: 'chatChooseEmoji',
          },
        ],
      })
    )
  },
  _onCopy: (message: Types.Message) => {
    if (message.type === 'text') {
      dispatch(ConfigGen.createCopyToClipboard({text: message.text.stringValue()}))
    }
  },
  _onCopyLink: (label: string, message: Types.Message) =>
    dispatch(
      ConfigGen.createCopyToClipboard({text: DeeplinksConstants.linkFromConvAndMessage(label, message.id)})
    ),
  _onDelete: (message: Types.Message) =>
    dispatch(
      Chat2Gen.createMessageDelete({conversationIDKey: message.conversationIDKey, ordinal: message.ordinal})
    ),
  _onDeleteMessageHistory: (message: Types.Message) => {
    dispatch(Chat2Gen.createNavigateToThread({conversationIDKey: message.conversationIDKey, reason: 'misc'}))
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [{props: {conversationIDKey: message.conversationIDKey}, selected: 'chatDeleteHistoryWarning'}],
      })
    )
  },
  _onEdit: (message: Types.Message) => {
    dispatch(
      Chat2Gen.createMessageSetEditing({
        conversationIDKey: message.conversationIDKey,
        ordinal: message.ordinal,
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
  _onReplyPrivately: (message: Types.Message) => {
    dispatch(
      Chat2Gen.createMessageReplyPrivately({
        ordinal: message.ordinal,
        sourceConversationIDKey: message.conversationIDKey,
      })
    )
  },
  _onUserBlock: (message: Types.Message, isSingle: boolean) => {
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [
          {
            props: {
              blockUserByDefault: true,
              context: isSingle ? 'message-popup-single' : 'message-popup',
              convID: message.conversationIDKey,
              username: message.author,
            },
            selected: 'chatBlockingModal',
          },
        ],
      })
    )
  },
  _onViewProfile: (username: string) => dispatch(createShowUserProfile({username})),
})

export default Container.namedConnect(
  mapStateToProps,
  mapDispatchToProps,
  (stateProps, dispatchProps, ownProps: OwnProps) => {
    const message = ownProps.message
    const yourMessage = message.author === stateProps._you
    const isDeleteable = !!(stateProps._isDeleteable && (yourMessage || stateProps._canAdminDelete))
    const isEditable = !!(stateProps._isEditable && yourMessage)
    const canReplyPrivately = stateProps._canReplyPrivately
    const mapUnfurl = Constants.getMapUnfurl(message)
    const authorInTeam = stateProps._teamMembers?.has(message.author) ?? true
    const isLocation = !!mapUnfurl
    // don't pass onViewMap if we don't have a coordinate (e.g. when a location share ends)
    const onViewMap =
      mapUnfurl && mapUnfurl.mapInfo && !mapUnfurl.mapInfo.isLiveLocationDone
        ? () => openURL(mapUnfurl.url)
        : undefined
    const blockModalSingle = !stateProps._teamname && stateProps._participants.length === 2
    return {
      attachTo: ownProps.attachTo,
      author: message.author,
      botUsername: message.type === 'text' ? message.botUsername : undefined,
      deviceName: message.deviceName,
      deviceRevokedAt: message.deviceRevokedAt || undefined,
      deviceType: message.deviceType,
      isDeleteable,
      isEditable,
      isKickable: isDeleteable && !!stateProps._teamID && !yourMessage && authorInTeam,
      isLocation,
      isTeam: !!stateProps._teamname,
      onAddReaction: Container.isMobile ? () => dispatchProps._onAddReaction(message) : undefined,
      onCopy: message.type === 'text' ? () => dispatchProps._onCopy(message) : undefined,
      onCopyLink: () => dispatchProps._onCopyLink(stateProps._label, message),
      onDelete: isDeleteable ? () => dispatchProps._onDelete(message) : undefined,
      onDeleteMessageHistory: stateProps._canDeleteHistory
        ? () => dispatchProps._onDeleteMessageHistory(message)
        : undefined,
      onEdit: yourMessage && message.type === 'text' ? () => dispatchProps._onEdit(message) : undefined,
      onForward:
        message.type === 'text' && message.unfurls && message.unfurls.size > 0
          ? () => dispatchProps._onForward(message)
          : undefined,
      onHidden: () => ownProps.onHidden(),
      onInstallBot: stateProps._authorIsBot ? () => dispatchProps._onInstallBot(message) : undefined,
      onKick: () => dispatchProps._onKick(stateProps._teamID, message.author),
      onPinMessage: stateProps._canPinMessage ? () => dispatchProps._onPinMessage(message) : undefined,
      onReact: (emoji: string) => dispatchProps._onReact(message, emoji),
      onReply: message.type === 'text' ? () => dispatchProps._onReply(message) : undefined,
      onReplyPrivately:
        !yourMessage && canReplyPrivately ? () => dispatchProps._onReplyPrivately(message) : undefined,
      onUserBlock:
        message.author && !yourMessage
          ? () => dispatchProps._onUserBlock(message, blockModalSingle)
          : undefined,
      onViewMap,
      onViewProfile:
        message.author && !yourMessage ? () => dispatchProps._onViewProfile(message.author) : undefined,
      position: ownProps.position,
      showDivider: !message.deviceRevokedAt,
      style: ownProps.style,
      timestamp: message.timestamp,
      visible: ownProps.visible,
      yourMessage,
    }
  },
  'MessagePopupText'
)(Text)
