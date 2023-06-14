import * as Chat2Gen from '../../../../../actions/chat2-gen'
import * as ConfigGen from '../../../../../actions/config-gen'
import * as Constants from '../../../../../constants/chat2'
import * as Container from '../../../../../util/container'
import * as DeeplinksConstants from '../../../../../constants/deeplinks'
import * as ConfigConstants from '../../../../../constants/config'
import * as RouteTreeGen from '../../../../../actions/route-tree-gen'
import Text from '.'
import openURL from '../../../../../util/open-url'
import * as React from 'react'
import type * as TeamTypes from '../../../../../constants/types/teams'
import type * as Types from '../../../../../constants/types/chat2'
import type {Position, StylesCrossPlatform} from '../../../../../styles'
import {createShowUserProfile} from '../../../../../actions/profile-gen'
import {getCanPerformByID} from '../../../../../constants/teams'
import {makeMessageText} from '../../../../../constants/chat2/message'

type OwnProps = {
  attachTo?: () => React.Component<any> | null
  ordinal: Types.Ordinal
  conversationIDKey: Types.ConversationIDKey
  onHidden: () => void
  position: Position
  style?: StylesCrossPlatform
  visible: boolean
}

const emptyMessage = makeMessageText({})

export default (ownProps: OwnProps) => {
  const {conversationIDKey, ordinal} = ownProps
  const m = Container.useSelector(state => Constants.getMessage(state, conversationIDKey, ordinal))
  const message = m ? m : emptyMessage
  const meta = Container.useSelector(state => Constants.getMeta(state, message.conversationIDKey))
  const participantInfo = Container.useSelector(state =>
    Constants.getParticipantInfo(state, message.conversationIDKey)
  )
  const yourOperations = Container.useSelector(state => getCanPerformByID(state, meta.teamID))
  const _canDeleteHistory = yourOperations.deleteChatHistory
  const _canAdminDelete = yourOperations.deleteOtherMessages
  const _label = Container.useSelector(state => Constants.getConversationLabel(state, meta, true))
  let _canPinMessage = message.type === 'text'
  if (_canPinMessage && meta.teamname) {
    _canPinMessage = yourOperations.pinMessage
  }
  // you can reply privately *if* text message, someone else's message, and not in a 1-on-1 chat
  const _canReplyPrivately =
    message.type === 'text' && (['small', 'big'].includes(meta.teamType) || participantInfo.all.length > 2)
  const authorIsBot = Container.useSelector(state =>
    Constants.messageAuthorIsBot(state, meta, message, participantInfo)
  )
  const _teamMembers = Container.useSelector(state => state.teams.teamIDToMembers.get(meta.teamID))
  const _authorIsBot = authorIsBot
  const _isDeleteable = message.isDeleteable
  const _isEditable = message.isEditable
  const _participants = participantInfo.all
  const _teamID = meta.teamID
  const _teamname = meta.teamname
  const _you = ConfigConstants.useConfigState(s => s.username)

  const dispatch = Container.useDispatch()
  const _onAddReaction = (message: Types.Message) => {
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [
          {
            props: {
              conversationIDKey: message.conversationIDKey,
              onPickAddToMessageOrdinal: message.ordinal,
              pickKey: 'reaction',
            },
            selected: 'chatChooseEmoji',
          },
        ],
      })
    )
  }
  const _onCopy = (message: Types.Message) => {
    if (message.type === 'text') {
      dispatch(ConfigGen.createCopyToClipboard({text: message.text.stringValue()}))
    }
  }
  const _onCopyLink = (label: string, message: Types.Message) => {
    dispatch(
      ConfigGen.createCopyToClipboard({text: DeeplinksConstants.linkFromConvAndMessage(label, message.id)})
    )
  }
  const _onDelete = (message: Types.Message) => {
    dispatch(
      Chat2Gen.createMessageDelete({conversationIDKey: message.conversationIDKey, ordinal: message.ordinal})
    )
  }
  const _onDeleteMessageHistory = (message: Types.Message) => {
    dispatch(Chat2Gen.createNavigateToThread({conversationIDKey: message.conversationIDKey, reason: 'misc'}))
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [{props: {conversationIDKey: message.conversationIDKey}, selected: 'chatDeleteHistoryWarning'}],
      })
    )
  }
  const _onEdit = (message: Types.Message) => {
    dispatch(
      Chat2Gen.createMessageSetEditing({
        conversationIDKey: message.conversationIDKey,
        ordinal: message.ordinal,
      })
    )
  }
  const _onForward = (message: Types.Message) => {
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
  }
  const _onInstallBot = (message: Types.Message) => {
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [{props: {botUsername: message.author}, selected: 'chatInstallBotPick'}],
      })
    )
  }
  const _onKick = (teamID: TeamTypes.TeamID, username: string) => {
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [{props: {members: [username], teamID}, selected: 'teamReallyRemoveMember'}],
      })
    )
  }
  const _onMarkAsUnread = (message: Types.Message) => {
    dispatch(
      Chat2Gen.createMarkAsUnread({
        conversationIDKey: message.conversationIDKey,
        readMsgID: message.id,
      })
    )
  }
  const _onPinMessage = (message: Types.Message) => {
    dispatch(
      Chat2Gen.createPinMessage({
        conversationIDKey: message.conversationIDKey,
        messageID: message.id,
      })
    )
  }
  const _onReact = (message: Types.Message, emoji: string) => {
    dispatch(
      Chat2Gen.createToggleMessageReaction({
        conversationIDKey: message.conversationIDKey,
        emoji,
        ordinal: message.ordinal,
      })
    )
  }
  const _onReply = (message: Types.Message) => {
    dispatch(
      Chat2Gen.createToggleReplyToMessage({
        conversationIDKey: message.conversationIDKey,
        ordinal: message.ordinal,
      })
    )
  }
  const _onReplyPrivately = (message: Types.Message) => {
    dispatch(
      Chat2Gen.createMessageReplyPrivately({
        ordinal: message.ordinal,
        sourceConversationIDKey: message.conversationIDKey,
      })
    )
  }
  const _onUserBlock = (message: Types.Message, isSingle: boolean) => {
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
  }
  const _onViewProfile = (username: string) => {
    dispatch(createShowUserProfile({username}))
  }
  const yourMessage = message.author === _you
  const isDeleteable = !!(_isDeleteable && (yourMessage || _canAdminDelete))
  const isEditable = !!(_isEditable && yourMessage)
  const canReplyPrivately = _canReplyPrivately
  const mapUnfurl = Constants.getMapUnfurl(message)
  const authorInTeam = _teamMembers?.has(message.author) ?? true
  const isLocation = !!mapUnfurl
  // don't pass onViewMap if we don't have a coordinate (e.g. when a location share ends)
  const onViewMap =
    mapUnfurl?.mapInfo && !mapUnfurl.mapInfo.isLiveLocationDone ? () => openURL(mapUnfurl.url) : undefined
  const blockModalSingle = !_teamname && _participants.length === 2

  const props = {
    attachTo: ownProps.attachTo,
    author: message.author,
    botUsername: message.type === 'text' ? message.botUsername : undefined,
    deviceName: message.deviceName ?? '',
    deviceRevokedAt: message.deviceRevokedAt || undefined,
    deviceType: message.deviceType ?? 'backup',
    isDeleteable,
    isEditable,
    isKickable: isDeleteable && !!_teamID && !yourMessage && authorInTeam,
    isLocation,
    isTeam: !!_teamname,
    onAddReaction: Container.isMobile ? () => _onAddReaction(message) : undefined,
    onCopy: message.type === 'text' ? () => _onCopy(message) : undefined,
    onCopyLink: () => _onCopyLink(_label, message),
    onDelete: isDeleteable ? () => _onDelete(message) : undefined,
    onDeleteMessageHistory: _canDeleteHistory ? () => _onDeleteMessageHistory(message) : undefined,
    onEdit: yourMessage && message.type === 'text' ? () => _onEdit(message) : undefined,
    onForward:
      message.type === 'text' && message.unfurls && message.unfurls.size > 0
        ? () => _onForward(message)
        : undefined,
    onHidden: () => ownProps.onHidden(),
    onInstallBot: _authorIsBot ? () => _onInstallBot(message) : undefined,
    onKick: () => _onKick(_teamID, message.author),
    onMarkAsUnread: () => _onMarkAsUnread(message),
    onPinMessage: _canPinMessage ? () => _onPinMessage(message) : undefined,
    onReact: (emoji: string) => _onReact(message, emoji),
    onReply: message.type === 'text' ? () => _onReply(message) : undefined,
    onReplyPrivately: !yourMessage && canReplyPrivately ? () => _onReplyPrivately(message) : undefined,
    onUserBlock: message.author && !yourMessage ? () => _onUserBlock(message, blockModalSingle) : undefined,
    onViewMap,
    onViewProfile: message.author && !yourMessage ? () => _onViewProfile(message.author) : undefined,
    position: ownProps.position,
    showDivider: !message.deviceRevokedAt,
    style: ownProps.style,
    timestamp: message.timestamp,
    visible: ownProps.visible,
    yourMessage,
  }
  return <Text {...props} />
}
