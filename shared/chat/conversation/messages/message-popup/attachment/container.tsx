import * as C from '../../../../../constants'
import Attachment from '.'
import * as React from 'react'
import type * as T from '../../../../../constants/types'
import type {Position, StylesCrossPlatform} from '../../../../../styles'
import {makeMessageAttachment} from '../../../../../constants/chat2/message'
import {useData} from '../hooks'

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
  const d = useData(ordinal, true)
  const {yourMessage, onCopyLink, deviceType, onReply, onPinMessage, onAddReaction} = d
  const {onReact, onMarkAsUnread, onKick, onInstallBot, onForward, onEdit, onDelete} = d
  const {deviceRevokedAt, deviceName, author, timestamp} = d
  const m = C.useChatContext(s => s.messageMap.get(ordinal))
  const message = m?.type === 'attachment' ? m : emptyMessage
  const {downloadPath, id, attachmentType} = message
  const pending = !!message.transferState
  const clearModals = C.useRouterState(s => s.dispatch.clearModals)
  const showInfoPanel = C.useChatContext(s => s.dispatch.showInfoPanel)
  const onAllMedia = () => {
    clearModals()
    showInfoPanel(true, 'attachments')
  }
  const attachmentDownload = C.useChatContext(s => s.dispatch.attachmentDownload)
  const _onDownload = React.useCallback(() => {
    attachmentDownload(id)
  }, [attachmentDownload, id])
  const onDownload = !C.isMobile && !message.downloadPath ? _onDownload : undefined

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
