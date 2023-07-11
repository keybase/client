import * as Chat2Gen from '../../../../../actions/chat2-gen'
import * as ConfigGen from '../../../../../actions/config-gen'
import * as Constants from '../../../../../constants/chat2'
import * as TeamsConstants from '../../../../../constants/teams'
import * as Container from '../../../../../util/container'
import * as ConfigConstants from '../../../../../constants/config'
import * as DeeplinksConstants from '../../../../../constants/deeplinks'
import * as FsGen from '../../../../../actions/fs-gen'
import * as RouteTreeGen from '../../../../../actions/route-tree-gen'
import Attachment from '.'
import * as React from 'react'
import type * as TeamTypes from '../../../../../constants/types/teams'
import type * as Types from '../../../../../constants/types/chat2'
import type {Position, StylesCrossPlatform} from '../../../../../styles'
import {getCanPerformByID} from '../../../../../constants/teams'
import {isMobile, isIOS} from '../../../../../constants/platform'
import {makeMessageAttachment} from '../../../../../constants/chat2/message'

type OwnProps = {
  attachTo?: () => React.Component<any> | null
  ordinal: Types.Ordinal
  conversationIDKey: Types.ConversationIDKey
  onHidden: () => void
  position: Position
  style?: StylesCrossPlatform
  visible: boolean
}

const emptyMessage = makeMessageAttachment({})

export default (ownProps: OwnProps) => {
  const {conversationIDKey, ordinal} = ownProps
  const m = Container.useSelector(state => Constants.getMessage(state, conversationIDKey, ordinal))
  const message = m?.type === 'attachment' ? m : emptyMessage
  const meta = Container.useSelector(state => Constants.getMeta(state, message.conversationIDKey))
  const isTeam = !!meta.teamname
  const participantInfo = Container.useSelector(state =>
    Constants.getParticipantInfo(state, message.conversationIDKey)
  )
  const yourOperations = TeamsConstants.useState(s => getCanPerformByID(s, meta.teamID))
  const _canAdminDelete = yourOperations.deleteOtherMessages
  const _canPinMessage = !isTeam || yourOperations.pinMessage
  const _authorIsBot = TeamsConstants.useState(s =>
    Constants.messageAuthorIsBot(s, meta, message, participantInfo)
  )
  const _teamMembers = TeamsConstants.useState(s => s.teamIDToMembers.get(meta.teamID))
  const _label = Container.useSelector(state => Constants.getConversationLabel(state, meta, true))
  const _teamID = meta.teamID
  const _you = ConfigConstants.useCurrentUserState(s => s.username)
  const pending = !!message.transferState

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
  const _onAllMedia = (conversationIDKey: Types.ConversationIDKey) => {
    dispatch(RouteTreeGen.createClearModals())
    dispatch(Chat2Gen.createShowInfoPanel({conversationIDKey, show: true, tab: 'attachments'}))
  }
  const _onCopyLink = (label: string, message: Types.Message) => {
    dispatch(
      ConfigGen.createCopyToClipboard({text: DeeplinksConstants.linkFromConvAndMessage(label, message.id)})
    )
  }
  const _onDelete = (message: Types.Message) => {
    dispatch(
      Chat2Gen.createMessageDelete({
        conversationIDKey: message.conversationIDKey,
        ordinal: message.ordinal,
      })
    )
    dispatch(RouteTreeGen.createClearModals())
  }
  const _onDownload = (message: Types.MessageAttachment) => {
    dispatch(
      Chat2Gen.createAttachmentDownload({
        conversationIDKey: message.conversationIDKey,
        ordinal: message.id,
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
  const _onSaveAttachment = (message: Types.MessageAttachment) => {
    dispatch(Chat2Gen.createMessageAttachmentNativeSave({message}))
  }
  const _onShareAttachment = (message: Types.MessageAttachment) => {
    dispatch(Chat2Gen.createMessageAttachmentNativeShare({message}))
  }
  const _onShowInFinder = (message: Types.MessageAttachment) => {
    message.downloadPath &&
      dispatch(FsGen.createOpenLocalPathInSystemFileManager({localPath: message.downloadPath}))
  }
  const yourMessage = message.author === _you
  const isDeleteable = yourMessage || _canAdminDelete
  const isEditable = !!(message.isEditable && yourMessage)
  const authorInTeam = _teamMembers?.has(message.author) ?? true
  const props = {
    attachTo: ownProps.attachTo,
    author: message.author,
    deviceName: message.deviceName,
    deviceRevokedAt: message.deviceRevokedAt || undefined,
    deviceType: message.deviceType,
    isDeleteable,
    isEditable,
    isKickable: isDeleteable && !!_teamID && !yourMessage && authorInTeam,
    onAddReaction: isMobile ? () => _onAddReaction(message) : undefined,
    onAllMedia: () => _onAllMedia(message.conversationIDKey),
    onCopyLink: () => _onCopyLink(_label, message),
    onDelete: isDeleteable ? () => _onDelete(message) : undefined,
    onDownload: !isMobile && !message.downloadPath ? () => _onDownload(message) : undefined,
    onEdit: () => _onEdit(message),
    onForward: () => _onForward(message),
    onHidden: () => ownProps.onHidden(),
    onInstallBot: _authorIsBot ? () => _onInstallBot(message) : undefined,
    onKick: () => _onKick(_teamID, message.author),
    onMarkAsUnread: () => _onMarkAsUnread(message),
    onPinMessage: _canPinMessage ? () => _onPinMessage(message) : undefined,
    onReact: (emoji: string) => _onReact(message, emoji),
    onReply: () => _onReply(message),
    onSaveAttachment:
      isMobile && message.attachmentType === 'image' ? () => _onSaveAttachment(message) : undefined,
    onShareAttachment: isIOS ? () => _onShareAttachment(message) : undefined,
    onShowInFinder: !isMobile && message.downloadPath ? () => _onShowInFinder(message) : undefined,
    pending,
    position: ownProps.position,
    style: ownProps.style,
    timestamp: message.timestamp,
    visible: ownProps.visible,
    yourMessage,
  }
  return <Attachment {...props} />
}
