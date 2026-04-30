import * as C from '@/constants'
import * as Chat from '@/constants/chat'
import * as Kb from '@/common-adapters'
import type * as React from 'react'
import type * as T from '@/constants/types'
import {type Position, fileUIName, type StylesCrossPlatform} from '@/styles'
import {
  attachmentDownloadMessage,
  messageAttachmentNativeSaveMessage,
  messageAttachmentNativeShareMessage,
  useConversationAttachmentActions,
} from '../../attachment-actions'
import {openLocalPathInSystemFileManagerDesktop} from '@/util/fs-storeless-actions'
import {showConversationInfoPanel, useConversationThreadMessage} from '../../thread-context'
import {useConversationMetadata} from '../../data-hooks'
import type {MessagePopupItems} from './hooks'
import {useHeader, useHeaderForMessage, useItems, useStorelessItems} from './hooks'

type OwnProps = {
  attachTo?: React.RefObject<Kb.MeasureRef | null>
  conversationIDKey?: T.Chat.ConversationIDKey
  message?: T.Chat.Message
  mode?: 'modal' | 'bottomsheet'
  ordinal: T.Chat.Ordinal
  onHidden: () => void
  position: Position
  style?: StylesCrossPlatform
  visible: boolean
}

const emptyMessage = Chat.makeMessageAttachment({})

type AttachmentActions = {
  download: () => void
  save: () => void
  share: () => void
}

const PopAttachLoaded = (ownProps: OwnProps & {
  actions: AttachmentActions
  conversationIDKey: T.Chat.ConversationIDKey
  header: React.ReactNode
  itemsData: MessagePopupItems
  message: T.Chat.MessageAttachment
}) => {
  const {actions, attachTo, conversationIDKey, header, itemsData: i, message, mode} = ownProps
  const {onHidden, position, style, visible} = ownProps
  const {downloadPath, attachmentType, id} = message
  const pending = !!message.transferState
  const clearModals = C.Router2.clearModals

  const onJump = () => {
    showConversationInfoPanel(conversationIDKey, false, 'attachments')
    clearModals()
    C.Router2.navigateToThread(conversationIDKey, 'misc', id)
  }

  const onAllMedia = () => {
    clearModals()
    showConversationInfoPanel(conversationIDKey, true, 'attachments')
  }
  const onDownload = !C.isMobile && !message.downloadPath ? actions.download : undefined
  const onSaveAttachment =
    C.isMobile && (attachmentType === 'image' || Chat.isImageViewable(message)) ? actions.save : undefined
  const onShareAttachment = C.isMobile ? actions.share : undefined

  const _onShowInFinder = () => {
    if (downloadPath) {
      openLocalPathInSystemFileManagerDesktop(downloadPath)
    }
  }
  const onShowInFinder = !C.isMobile && message.downloadPath ? _onShowInFinder : undefined

  const {itemBot, itemReaction, itemCopyLink, itemReply, itemEdit, itemForward, itemPin, itemUnread} = i
  const {itemExplode, itemDelete, itemKick, itemProfile} = i

  const itemFinder = onShowInFinder
    ? ([{icon: 'iconfont-finder', onClick: onShowInFinder, title: `Show in ${fileUIName}`}] as const)
    : []
  const itemSave = onSaveAttachment
    ? ([
        {
          disabled: pending,
          icon: 'iconfont-download-2',
          onClick: onSaveAttachment,
          title: 'Save',
        },
      ] as const)
    : []
  const itemDownload = onDownload
    ? ([{disabled: pending, icon: 'iconfont-download-2', onClick: onDownload, title: 'Download'}] as const)
    : []
  const itemShare = onShareAttachment
    ? ([{disabled: pending, icon: 'iconfont-share', onClick: onShareAttachment, title: 'Share'}] as const)
    : []
  const itemMedia = [{icon: 'iconfont-camera', onClick: onAllMedia, title: 'All media'}] as const
  const itemJump = [{icon: 'iconfont-search', onClick: onJump, title: 'Jump to message'}] as const

  const topSection = [...itemSave, ...itemShare, ...itemDelete, ...itemExplode]

  const items = [
    ...itemReaction,
    ...topSection,
    ...(topSection.length ? ['Divider' as const] : []),
    ...itemMedia,
    ...itemCopyLink,
    ...itemEdit,
    ...itemReply,
    ...itemForward,
    ...itemDownload,
    ...itemJump,
    ...itemUnread,
    ...itemFinder,
    ...itemBot,
    ...itemProfile,
    ...itemKick,
    ...itemPin,
  ]

  const snapPoints = [8 * 40 + 25]

  return (
    <Kb.FloatingMenu
      attachTo={attachTo}
      header={header}
      items={items}
      mode={mode}
      onHidden={onHidden}
      closeOnSelect={true}
      position={position}
      containerStyle={style}
      snapPoints={snapPoints}
      visible={visible}
    />
  )
}

const PopAttachThread = (ownProps: OwnProps) => {
  const {ordinal, onHidden} = ownProps
  const loadedMessage = useConversationThreadMessage(ordinal)
  const message = loadedMessage?.type === 'attachment' ? loadedMessage : emptyMessage
  const {attachmentDownload, messageAttachmentNativeSave, messageAttachmentNativeShare} =
    useConversationAttachmentActions()
  const itemsData = useItems(ordinal, onHidden)
  const header = useHeader(ordinal, onHidden)
  return (
    <PopAttachLoaded
      {...ownProps}
      actions={{
        download: () => attachmentDownload(ordinal),
        save: () => messageAttachmentNativeSave(ordinal),
        share: () => messageAttachmentNativeShare(ordinal),
      }}
      conversationIDKey={message.conversationIDKey}
      header={header}
      itemsData={itemsData}
      message={message}
    />
  )
}

const PopAttachStoreless = (ownProps: OwnProps & {
  conversationIDKey: T.Chat.ConversationIDKey
  message: T.Chat.MessageAttachment
}) => {
  const {conversationIDKey, message, onHidden} = ownProps
  const {meta, participants: participantInfo} = useConversationMetadata(conversationIDKey)
  const itemsData = useStorelessItems({conversationIDKey, message, meta, onHidden, participantInfo})
  const header = useHeaderForMessage(message, onHidden)
  return (
    <PopAttachLoaded
      {...ownProps}
      actions={{
        download: () => attachmentDownloadMessage(conversationIDKey, message),
        save: () => messageAttachmentNativeSaveMessage(conversationIDKey, message),
        share: () => messageAttachmentNativeShareMessage(conversationIDKey, message),
      }}
      header={header}
      itemsData={itemsData}
    />
  )
}

const PopAttach = (ownProps: OwnProps) => {
  const {conversationIDKey, message} = ownProps
  if (conversationIDKey && message?.type === 'attachment') {
    return <PopAttachStoreless {...ownProps} conversationIDKey={conversationIDKey} message={message} />
  }
  return <PopAttachThread {...ownProps} />
}

export default PopAttach
