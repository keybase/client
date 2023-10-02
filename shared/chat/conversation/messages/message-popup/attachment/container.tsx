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
  const {ordinal, attachTo, onHidden, position, style, visible} = ownProps
  const m = C.useChatContext(s => s.messageMap.get(ordinal))
  const message = m?.type === 'attachment' ? m : emptyMessage
  const {author, deviceName, downloadPath, deviceType, id, attachmentType, timestamp} = message
  const meta = C.useChatContext(s => s.meta)
  const {teamID, teamname} = meta
  const isTeam = !!teamname
  const participantInfo = C.useChatContext(s => s.participants)
  const yourOperations = C.useTeamsState(s => C.getCanPerformByID(s, teamID))
  const canAdminDelete = yourOperations.deleteOtherMessages
  const authorIsBot = C.useTeamsState(s => Constants.messageAuthorIsBot(s, meta, message, participantInfo))
  const teamMembers = C.useTeamsState(s => s.teamIDToMembers.get(teamID))
  const label = Constants.getConversationLabel(participantInfo, meta, true)
  const you = C.useCurrentUserState(s => s.username)
  const yourMessage = author === you
  const isDeleteable = yourMessage || canAdminDelete
  const isEditable = !!(message.isEditable && yourMessage)
  const authorInTeam = teamMembers?.has(author) ?? true
  const isKickable = isDeleteable && !!teamID && !yourMessage && authorInTeam
  const deviceRevokedAt = message.deviceRevokedAt || undefined
  const pending = !!message.transferState
  const navigateAppend = C.useChatNavigateAppend()
  const _onAddReaction = React.useCallback(() => {
    navigateAppend(conversationIDKey => ({
      props: {
        conversationIDKey,
        onPickAddToMessageOrdinal: ordinal,
        pickKey: 'reaction',
      },
      selected: 'chatChooseEmoji',
    }))
  }, [navigateAppend, ordinal])
  const onAddReaction = C.isMobile ? () => _onAddReaction : undefined
  const clearModals = C.useRouterState(s => s.dispatch.clearModals)
  const showInfoPanel = C.useChatContext(s => s.dispatch.showInfoPanel)
  const onAllMedia = () => {
    clearModals()
    showInfoPanel(true, 'attachments')
  }
  const copyToClipboard = C.useConfigState(s => s.dispatch.dynamic.copyToClipboard)
  const onCopyLink = React.useCallback(() => {
    copyToClipboard(linkFromConvAndMessage(label, id))
  }, [copyToClipboard, id, label])
  const messageDelete = C.useChatContext(s => s.dispatch.messageDelete)
  const _onDelete = React.useCallback(() => {
    messageDelete(ordinal)
    clearModals()
  }, [messageDelete, clearModals, ordinal])
  const onDelete = isDeleteable ? _onDelete : undefined
  const attachmentDownload = C.useChatContext(s => s.dispatch.attachmentDownload)
  const _onDownload = React.useCallback(() => {
    attachmentDownload(id)
  }, [attachmentDownload, id])
  const onDownload = !C.isMobile && !message.downloadPath ? _onDownload : undefined
  const setEditing = C.useChatContext(s => s.dispatch.setEditing)
  const onEdit = React.useCallback(() => {
    setEditing(ordinal)
  }, [setEditing, ordinal])
  const onForward = React.useCallback(() => {
    navigateAppend(conversationIDKey => ({
      props: {conversationIDKey, ordinal},
      selected: 'chatForwardMsgPick',
    }))
  }, [navigateAppend, ordinal])

  const _onInstallBot = React.useCallback(() => {
    navigateAppend(() => ({props: {botUsername: author}, selected: 'chatInstallBotPick'}))
  }, [navigateAppend, author])
  const onInstallBot = authorIsBot ? _onInstallBot : undefined

  const onKick = React.useCallback(() => {
    navigateAppend(() => ({props: {members: [author], teamID}, selected: 'teamReallyRemoveMember'}))
  }, [navigateAppend, author, teamID])
  const setMarkAsUnread = C.useChatContext(s => s.dispatch.setMarkAsUnread)
  const onMarkAsUnread = React.useCallback(() => {
    setMarkAsUnread(id)
  }, [setMarkAsUnread, id])

  const canPinMessage = !isTeam || yourOperations.pinMessage
  const pinMessage = C.useChatContext(s => s.dispatch.pinMessage)
  const _onPinMessage = React.useCallback(() => {
    pinMessage(id)
  }, [pinMessage, id])
  const onPinMessage = canPinMessage ? _onPinMessage : undefined

  const toggleMessageReaction = C.useChatContext(s => s.dispatch.toggleMessageReaction)
  const onReact = React.useCallback(
    (emoji: string) => {
      toggleMessageReaction(ordinal, emoji)
    },
    [toggleMessageReaction, ordinal]
  )

  const setReplyTo = C.useChatContext(s => s.dispatch.setReplyTo)
  const onReply = React.useCallback(() => {
    setReplyTo(ordinal)
  }, [setReplyTo, ordinal])

  const messageAttachmentNativeSave = C.useChatContext(s => s.dispatch.messageAttachmentNativeSave)
  const messageAttachmentNativeShare = C.useChatContext(s => s.dispatch.messageAttachmentNativeShare)
  const _onSaveAttachment = React.useCallback(() => {
    messageAttachmentNativeSave(message)
  }, [messageAttachmentNativeSave, message])
  const onSaveAttachment = C.isMobile && attachmentType === 'image' ? _onSaveAttachment : undefined

  const _onShareAttachment = React.useCallback(() => {
    messageAttachmentNativeShare(ordinal)
  }, [messageAttachmentNativeShare, ordinal])
  const onShareAttachment = C.isIOS ? _onShareAttachment : undefined

  const openLocalPathInSystemFileManagerDesktop = C.useFSState(
    s => s.dispatch.dynamic.openLocalPathInSystemFileManagerDesktop
  )
  const _onShowInFinder = React.useCallback(() => {
    downloadPath && openLocalPathInSystemFileManagerDesktop?.(downloadPath)
  }, [downloadPath, openLocalPathInSystemFileManagerDesktop])
  const onShowInFinder = !C.isMobile && message.downloadPath ? _onShowInFinder : undefined

  const props = {
    attachTo,
    author,
    deviceName,
    deviceRevokedAt,
    deviceType,
    isDeleteable,
    isEditable,
    isKickable,
    onAddReaction,
    onAllMedia,
    onCopyLink,
    onDelete,
    onDownload,
    onEdit,
    onForward,
    onHidden,
    onInstallBot,
    onKick,
    onMarkAsUnread,
    onPinMessage,
    onReact,
    onReply,
    onSaveAttachment,
    onShareAttachment,
    onShowInFinder,
    pending,
    position,
    style,
    timestamp,
    visible,
    yourMessage,
  }
  return <Attachment {...props} />
}
