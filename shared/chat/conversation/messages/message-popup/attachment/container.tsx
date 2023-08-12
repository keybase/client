import * as C from '../../../../../constants'
import * as Chat2Gen from '../../../../../actions/chat2-gen'
import * as Constants from '../../../../../constants/chat2'
import * as TeamsConstants from '../../../../../constants/teams'
import * as Container from '../../../../../util/container'
import * as ConfigConstants from '../../../../../constants/config'
import {linkFromConvAndMessage} from '../../../../../constants'
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
  const {ordinal} = ownProps
  const m = Constants.useContext(s => s.messageMap.get(ordinal))
  const message = m?.type === 'attachment' ? m : emptyMessage
  const meta = Constants.useContext(s => s.meta)
  const isTeam = !!meta.teamname
  const participantInfo = Constants.useContext(s => s.participants)
  const yourOperations = TeamsConstants.useState(s => getCanPerformByID(s, meta.teamID))
  const _canAdminDelete = yourOperations.deleteOtherMessages
  const _canPinMessage = !isTeam || yourOperations.pinMessage
  const _authorIsBot = TeamsConstants.useState(s =>
    Constants.messageAuthorIsBot(s, meta, message, participantInfo)
  )
  const _teamMembers = TeamsConstants.useState(s => s.teamIDToMembers.get(meta.teamID))
  const _label = Constants.getConversationLabel(participantInfo, meta, true)
  const _teamID = meta.teamID
  const _you = ConfigConstants.useCurrentUserState(s => s.username)
  const pending = !!message.transferState

  const dispatch = Container.useDispatch()

  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
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
  const clearModals = C.useRouterState(s => s.dispatch.clearModals)
  const showInfoPanel = Constants.useState(s => s.dispatch.showInfoPanel)
  const _onAllMedia = (conversationIDKey: Types.ConversationIDKey) => {
    clearModals()
    showInfoPanel(true, 'attachments', conversationIDKey)
  }
  const copyToClipboard = ConfigConstants.useConfigState(s => s.dispatch.dynamic.copyToClipboard)
  const _onCopyLink = (label: string, message: Types.Message) => {
    copyToClipboard(linkFromConvAndMessage(label, message.id))
  }
  const messageDelete = Constants.useContext(s => s.dispatch.messageDelete)
  const _onDelete = (message: Types.Message) => {
    messageDelete(message.ordinal)
    clearModals()
  }
  const attachmentDownload = Constants.useContext(s => s.dispatch.attachmentDownload)
  const _onDownload = (message: Types.MessageAttachment) => {
    attachmentDownload(message.id)
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

  const messageAttachmentNativeSave = Constants.useContext(s => s.dispatch.messageAttachmentNativeSave)
  const messageAttachmentNativeShare = Constants.useContext(s => s.dispatch.messageAttachmentNativeShare)
  const _onSaveAttachment = (message: Types.MessageAttachment) => {
    messageAttachmentNativeSave(message)
  }
  const _onShareAttachment = (message: Types.MessageAttachment) => {
    messageAttachmentNativeShare(message)
  }
  const openLocalPathInSystemFileManagerDesktop = C.useFSState(
    s => s.dispatch.dynamic.openLocalPathInSystemFileManagerDesktop
  )
  const _onShowInFinder = (message: Types.MessageAttachment) => {
    message.downloadPath && openLocalPathInSystemFileManagerDesktop?.(message.downloadPath)
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
