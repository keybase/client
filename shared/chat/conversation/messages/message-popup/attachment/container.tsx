import * as C from '../../../../../constants'
import * as Constants from '../../../../../constants/chat2'
import {linkFromConvAndMessage} from '../../../../../constants'
import Attachment from '.'
import * as React from 'react'
import type * as T from '../../../../../constants/types'
import type {Position, StylesCrossPlatform} from '../../../../../styles'
import {makeMessageAttachment} from '../../../../../constants/chat2/message'

type OwnProps = {
  attachTo?: () => React.Component<any> | null
  ordinal: T.Chat.Ordinal
  onHidden: () => void
  position: Position
  style?: StylesCrossPlatform
  visible: boolean
}

const emptyMessage = makeMessageAttachment({})

export default (ownProps: OwnProps) => {
  const {ordinal} = ownProps
  const m = C.useChatContext(s => s.messageMap.get(ordinal))
  const message = m?.type === 'attachment' ? m : emptyMessage
  const meta = C.useChatContext(s => s.meta)
  const isTeam = !!meta.teamname
  const participantInfo = C.useChatContext(s => s.participants)
  const yourOperations = C.useTeamsState(s => C.getCanPerformByID(s, meta.teamID))
  const _canAdminDelete = yourOperations.deleteOtherMessages
  const _canPinMessage = !isTeam || yourOperations.pinMessage
  const _authorIsBot = C.useTeamsState(s => Constants.messageAuthorIsBot(s, meta, message, participantInfo))
  const _teamMembers = C.useTeamsState(s => s.teamIDToMembers.get(meta.teamID))
  const _label = Constants.getConversationLabel(participantInfo, meta, true)
  const _teamID = meta.teamID
  const _you = C.useCurrentUserState(s => s.username)
  const pending = !!message.transferState
  const navigateAppend = C.useChatNavigateAppend()
  const _onAddReaction = (message: T.Chat.Message) => {
    navigateAppend(conversationIDKey => ({
      props: {
        conversationIDKey,
        onPickAddToMessageOrdinal: message.ordinal,
        pickKey: 'reaction',
      },
      selected: 'chatChooseEmoji',
    }))
  }
  const clearModals = C.useRouterState(s => s.dispatch.clearModals)
  const showInfoPanel = C.useChatContext(s => s.dispatch.showInfoPanel)
  const onAllMedia = () => {
    clearModals()
    showInfoPanel(true, 'attachments')
  }
  const copyToClipboard = C.useConfigState(s => s.dispatch.dynamic.copyToClipboard)
  const _onCopyLink = (label: string, message: T.Chat.Message) => {
    copyToClipboard(linkFromConvAndMessage(label, message.id))
  }
  const messageDelete = C.useChatContext(s => s.dispatch.messageDelete)
  const _onDelete = (message: T.Chat.Message) => {
    messageDelete(message.ordinal)
    clearModals()
  }
  const attachmentDownload = C.useChatContext(s => s.dispatch.attachmentDownload)
  const _onDownload = (message: T.Chat.MessageAttachment) => {
    attachmentDownload(message.id)
  }
  const setEditing = C.useChatContext(s => s.dispatch.setEditing)
  const _onEdit = (message: T.Chat.Message) => {
    setEditing(message.ordinal)
  }
  const _onForward = (message: T.Chat.Message) => {
    navigateAppend(conversationIDKey => ({
      props: {conversationIDKey, ordinal: message.ordinal},
      selected: 'chatForwardMsgPick',
    }))
  }
  const _onInstallBot = (message: T.Chat.Message) => {
    navigateAppend(() => ({props: {botUsername: message.author}, selected: 'chatInstallBotPick'}))
  }
  const _onKick = (teamID: T.Teams.TeamID, username: string) => {
    navigateAppend(() => ({props: {members: [username], teamID}, selected: 'teamReallyRemoveMember'}))
  }
  const setMarkAsUnread = C.useChatContext(s => s.dispatch.setMarkAsUnread)
  const _onMarkAsUnread = (message: T.Chat.Message) => {
    setMarkAsUnread(message.id)
  }
  const pinMessage = C.useChatContext(s => s.dispatch.pinMessage)

  const _onPinMessage = (message: T.Chat.Message) => {
    pinMessage(message.id)
  }
  const toggleMessageReaction = C.useChatContext(s => s.dispatch.toggleMessageReaction)
  const _onReact = (message: T.Chat.Message, emoji: string) => {
    toggleMessageReaction(message.ordinal, emoji)
  }

  const setReplyTo = C.useChatContext(s => s.dispatch.setReplyTo)
  const _onReply = (message: T.Chat.Message) => {
    setReplyTo(message.ordinal)
  }

  const messageAttachmentNativeSave = C.useChatContext(s => s.dispatch.messageAttachmentNativeSave)
  const messageAttachmentNativeShare = C.useChatContext(s => s.dispatch.messageAttachmentNativeShare)
  const _onSaveAttachment = (message: T.Chat.MessageAttachment) => {
    messageAttachmentNativeSave(message)
  }
  const _onShareAttachment = (message: T.Chat.MessageAttachment) => {
    messageAttachmentNativeShare(message)
  }
  const openLocalPathInSystemFileManagerDesktop = C.useFSState(
    s => s.dispatch.dynamic.openLocalPathInSystemFileManagerDesktop
  )
  const _onShowInFinder = (message: T.Chat.MessageAttachment) => {
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
    onAddReaction: C.isMobile ? () => _onAddReaction(message) : undefined,
    onAllMedia,
    onCopyLink: () => _onCopyLink(_label, message),
    onDelete: isDeleteable ? () => _onDelete(message) : undefined,
    onDownload: !C.isMobile && !message.downloadPath ? () => _onDownload(message) : undefined,
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
      C.isMobile && message.attachmentType === 'image' ? () => _onSaveAttachment(message) : undefined,
    onShareAttachment: C.isIOS ? () => _onShareAttachment(message) : undefined,
    onShowInFinder: !C.isMobile && message.downloadPath ? () => _onShowInFinder(message) : undefined,
    pending,
    position: ownProps.position,
    style: ownProps.style,
    timestamp: message.timestamp,
    visible: ownProps.visible,
    yourMessage,
  }
  return <Attachment {...props} />
}
