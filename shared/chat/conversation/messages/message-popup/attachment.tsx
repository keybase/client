import * as C from '@/constants'
import * as Chat from '@/stores/chat2'
import * as React from 'react'
import type * as T from '@/constants/types'
import {type Position, fileUIName, type StylesCrossPlatform} from '@/styles'
import {useItems, useHeader} from './hooks'
import * as Kb from '@/common-adapters'
import {useFSState} from '@/stores/fs'

type OwnProps = {
  attachTo?: React.RefObject<Kb.MeasureRef | null>
  ordinal: T.Chat.Ordinal
  onHidden: () => void
  position: Position
  style?: StylesCrossPlatform
  visible: boolean
}

const emptyMessage = Chat.makeMessageAttachment({})

const PopAttach = (ownProps: OwnProps) => {
  const {ordinal, attachTo, onHidden, position, style, visible} = ownProps
  const message = Chat.useChatContext(s => {
    const m = s.messageMap.get(ordinal)
    const message = m?.type === 'attachment' ? m : emptyMessage
    return message
  })
  const {downloadPath, attachmentType, id} = message
  const pending = !!message.transferState
  const clearModals = C.useRouterState(s => s.dispatch.clearModals)

  const {
    attachmentDownload,
    loadMessagesCentered,
    messageAttachmentNativeSave,
    messageAttachmentNativeShare,
    showInfoPanel,
  } = Chat.useChatContext(
    C.useShallow(s => {
      const {
        attachmentDownload,
        loadMessagesCentered,
        messageAttachmentNativeSave,
        messageAttachmentNativeShare,
        showInfoPanel,
      } = s.dispatch
      return {
        attachmentDownload,
        loadMessagesCentered,
        messageAttachmentNativeSave,
        messageAttachmentNativeShare,
        showInfoPanel,
      }
    })
  )

  const onJump = React.useCallback(() => {
    loadMessagesCentered(id, 'always')
    showInfoPanel(false, 'attachments')
    clearModals()
  }, [id, loadMessagesCentered, showInfoPanel, clearModals])

  const onAllMedia = () => {
    clearModals()
    showInfoPanel(true, 'attachments')
  }
  const _onDownload = React.useCallback(() => {
    attachmentDownload(ordinal)
  }, [attachmentDownload, ordinal])
  const onDownload = !C.isMobile && !message.downloadPath ? _onDownload : undefined

  const _onSaveAttachment = React.useCallback(() => {
    messageAttachmentNativeSave(ordinal)
  }, [messageAttachmentNativeSave, ordinal])

  const onSaveAttachment =
    C.isMobile && (attachmentType === 'image' || Chat.isImageViewable(message))
      ? _onSaveAttachment
      : undefined

  const _onShareAttachment = React.useCallback(() => {
    messageAttachmentNativeShare(ordinal)
  }, [messageAttachmentNativeShare, ordinal])
  const onShareAttachment = C.isMobile ? _onShareAttachment : undefined

  const openLocalPathInSystemFileManagerDesktop = useFSState(
    s => s.dispatch.defer.openLocalPathInSystemFileManagerDesktop
  )
  const _onShowInFinder = React.useCallback(() => {
    downloadPath && openLocalPathInSystemFileManagerDesktop?.(downloadPath)
  }, [downloadPath, openLocalPathInSystemFileManagerDesktop])
  const onShowInFinder = !C.isMobile && message.downloadPath ? _onShowInFinder : undefined

  const i = useItems(ordinal, onHidden)
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

  const header = useHeader(ordinal, onHidden)
  const snapPoints = React.useMemo(() => [8 * 40 + 25], [])

  return (
    <Kb.FloatingMenu
      attachTo={attachTo}
      header={header}
      items={items}
      onHidden={onHidden}
      closeOnSelect={true}
      position={position}
      containerStyle={style}
      snapPoints={snapPoints}
      visible={visible}
    />
  )
}
export default PopAttach
