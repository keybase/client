import * as RouterConstants from '../../../../../constants/router2'
import * as Chat2Gen from '../../../../../actions/chat2-gen'
import * as Constants from '../../../../../constants/chat2'
import * as TeamsConstants from '../../../../../constants/teams'
import * as ProfileConstants from '../../../../../constants/profile'
import * as Container from '../../../../../util/container'
import * as DeeplinksConstants from '../../../../../constants/deeplinks'
import * as ConfigConstants from '../../../../../constants/config'
import Text from '.'
import openURL from '../../../../../util/open-url'
import * as React from 'react'
import type * as TeamTypes from '../../../../../constants/types/teams'
import type * as Types from '../../../../../constants/types/chat2'
import type {Position, StylesCrossPlatform} from '../../../../../styles'
import {getCanPerformByID} from '../../../../../constants/teams'
import {makeMessageText} from '../../../../../constants/chat2/message'
import {isIOS} from '../../../../../constants/platform'

type OwnProps = {
  attachTo?: () => React.Component<any> | null
  ordinal: Types.Ordinal
  onHidden: () => void
  position: Position
  style?: StylesCrossPlatform
  visible: boolean
}

const emptyMessage = makeMessageText({})

export default (ownProps: OwnProps) => {
  const {ordinal} = ownProps
  const m = Constants.useContext(s => s.messageMap.get(ordinal))
  const message = m ? m : emptyMessage
  const meta = Constants.useContext(s => s.meta)
  const participantInfo = Constants.useContext(s => s.participants)
  const yourOperations = TeamsConstants.useState(s => getCanPerformByID(s, meta.teamID))
  const _canDeleteHistory = yourOperations.deleteChatHistory
  const _canAdminDelete = yourOperations.deleteOtherMessages
  const _label = Constants.getConversationLabel(participantInfo, meta, true)
  let _canPinMessage = message.type === 'text'
  if (_canPinMessage && meta.teamname) {
    _canPinMessage = yourOperations.pinMessage
  }
  // you can reply privately *if* text message, someone else's message, and not in a 1-on-1 chat
  const _canReplyPrivately =
    message.type === 'text' && (['small', 'big'].includes(meta.teamType) || participantInfo.all.length > 2)
  const authorIsBot = TeamsConstants.useState(s =>
    Constants.messageAuthorIsBot(s, meta, message, participantInfo)
  )
  const _teamMembers = TeamsConstants.useState(s => s.teamIDToMembers.get(meta.teamID))
  const _authorIsBot = authorIsBot
  const _isDeleteable = message.isDeleteable
  const _isEditable = message.isEditable
  const _participants = participantInfo.all
  const _teamID = meta.teamID
  const _teamname = meta.teamname
  const _you = ConfigConstants.useCurrentUserState(s => s.username)

  const dispatch = Container.useDispatch()
  const navigateAppend = RouterConstants.useState(s => s.dispatch.navigateAppend)
  const _onAddReaction = (message: Types.Message) => {
    navigateAppend({
      props: {
        conversationIDKey: message.conversationIDKey,
        onPickAddToMessageOrdinal: message.ordinal,
        pickKey: 'reaction',
      },
      selected: 'chatChooseEmoji',
    })
  }
  const copyToClipboard = ConfigConstants.useConfigState(s => s.dispatch.dynamic.copyToClipboard)
  const _onCopy = (message: Types.Message) => {
    if (message.type === 'text') {
      copyToClipboard(message.text.stringValue())
    }
  }
  const _onCopyLink = (label: string, message: Types.Message) => {
    copyToClipboard(DeeplinksConstants.linkFromConvAndMessage(label, message.id))
  }
  const messageDelete = Constants.useContext(s => s.dispatch.messageDelete)
  const _onDelete = (message: Types.Message) => {
    messageDelete(message.ordinal)
  }
  const _onDeleteMessageHistory = (message: Types.Message) => {
    Constants.getConvoState(message.conversationIDKey).dispatch.navigateToThread('misc')
    navigateAppend({
      props: {conversationIDKey: message.conversationIDKey},
      selected: 'chatDeleteHistoryWarning',
    })
  }
  const setEditing = Constants.useContext(s => s.dispatch.setEditing)
  const _onEdit = (message: Types.Message) => {
    setEditing(message.ordinal)
  }
  const _onForward = (message: Types.Message) => {
    navigateAppend({
      props: {ordinal: message.ordinal, srcConvID: message.conversationIDKey},
      selected: 'chatForwardMsgPick',
    })
  }
  const _onInstallBot = (message: Types.Message) => {
    navigateAppend({props: {botUsername: message.author}, selected: 'chatInstallBotPick'})
  }
  const _onKick = (teamID: TeamTypes.TeamID, username: string) => {
    navigateAppend({props: {members: [username], teamID}, selected: 'teamReallyRemoveMember'})
  }
  const setMarkAsUnread = Constants.useContext(s => s.dispatch.setMarkAsUnread)
  const _onMarkAsUnread = (message: Types.Message) => {
    setMarkAsUnread(message.id)
  }
  const _onPinMessage = (message: Types.Message) => {
    dispatch(
      Chat2Gen.createPinMessage({
        conversationIDKey: message.conversationIDKey,
        messageID: message.id,
      })
    )
  }
  const toggleMessageReaction = Constants.useContext(s => s.dispatch.toggleMessageReaction)
  const _onReact = (message: Types.Message, emoji: string) => {
    toggleMessageReaction(message.ordinal, emoji)
  }
  const setReplyTo = Constants.useContext(s => s.dispatch.setReplyTo)
  const _onReply = (message: Types.Message) => {
    setReplyTo(message.ordinal)
  }
  const messageReplyPrivately = Constants.useContext(s => s.dispatch.messageReplyPrivately)
  const _onReplyPrivately = (message: Types.Message) => {
    messageReplyPrivately(message.ordinal)
  }
  const _onUserBlock = (message: Types.Message, isSingle: boolean) => {
    navigateAppend({
      props: {
        blockUserByDefault: true,
        context: isSingle ? 'message-popup-single' : 'message-popup',
        convID: message.conversationIDKey,
        username: message.author,
      },
      selected: 'chatBlockingModal',
    })
  }
  const _onUserFilter = (message: Types.Message, isSingle: boolean) => {
    navigateAppend({
      props: {
        blockUserByDefault: true,
        context: isSingle ? 'message-popup-single' : 'message-popup',
        convID: message.conversationIDKey,
        filterUserByDefault: true,
        username: message.author,
      },
      selected: 'chatBlockingModal',
    })
  }
  const _onUserFlag = (message: Types.Message, isSingle: boolean) => {
    navigateAppend({
      props: {
        blockUserByDefault: true,
        context: isSingle ? 'message-popup-single' : 'message-popup',
        convID: message.conversationIDKey,
        flagUserByDefault: true,
        reportsUserByDefault: true,
        username: message.author,
      },
      selected: 'chatBlockingModal',
    })
  }
  const _onUserReport = (message: Types.Message, isSingle: boolean) => {
    navigateAppend({
      props: {
        blockUserByDefault: true,
        context: isSingle ? 'message-popup-single' : 'message-popup',
        convID: message.conversationIDKey,
        reportsUserByDefault: true,
        username: message.author,
      },
      selected: 'chatBlockingModal',
    })
  }

  const showUserProfile = ProfileConstants.useState(s => s.dispatch.showUserProfile)
  const _onViewProfile = showUserProfile
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
    onUserFilter:
      isIOS && message.author && !yourMessage ? () => _onUserFilter(message, blockModalSingle) : undefined,
    onUserFlag:
      isIOS && message.author && !yourMessage ? () => _onUserFlag(message, blockModalSingle) : undefined,
    onUserReport:
      isIOS && message.author && !yourMessage ? () => _onUserReport(message, blockModalSingle) : undefined,
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
