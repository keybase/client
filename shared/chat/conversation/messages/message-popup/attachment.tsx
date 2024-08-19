import * as C from '@/constants'
import * as React from 'react'
import type * as T from '@/constants/types'
import {type Position, fileUIName, type StylesCrossPlatform} from '@/styles'
import {useItems, useHeader} from './hooks'
import * as Kb from '@/common-adapters'

type OwnProps = {
  attachTo?: React.RefObject<Kb.MeasureRef>
  ordinal: T.Chat.Ordinal
  onHidden: () => void
  position: Position
  style?: StylesCrossPlatform
  visible: boolean
}

const emptyMessage = C.Chat.makeMessageAttachment({})

const PopAttach = (ownProps: OwnProps) => {
  const {ordinal, attachTo, onHidden, position, style, visible} = ownProps
  const m = C.useChatContext(s => s.messageMap.get(ordinal))
  const message = m?.type === 'attachment' ? m : emptyMessage
  const {downloadPath, attachmentType} = message
  const pending = !!message.transferState
  const clearModals = C.useRouterState(s => s.dispatch.clearModals)
  const showInfoPanel = C.useChatContext(s => s.dispatch.showInfoPanel)

  const loadMessagesCentered = C.useChatContext(s => s.dispatch.loadMessagesCentered)

  const onJump = React.useCallback(() => {
    m && loadMessagesCentered(m.id, 'always')
    showInfoPanel(false, 'attachments')
    clearModals()
  }, [m, loadMessagesCentered, showInfoPanel, clearModals])

  const onAllMedia = () => {
    clearModals()
    showInfoPanel(true, 'attachments')
  }
  const attachmentDownload = C.useChatContext(s => s.dispatch.attachmentDownload)
  const _onDownload = React.useCallback(() => {
    attachmentDownload(ordinal)
  }, [attachmentDownload, ordinal])
  const onDownload = !C.isMobile && !message.downloadPath ? _onDownload : undefined

  const messageAttachmentNativeSave = C.useChatContext(s => s.dispatch.messageAttachmentNativeSave)
  const messageAttachmentNativeShare = C.useChatContext(s => s.dispatch.messageAttachmentNativeShare)
  const _onSaveAttachment = React.useCallback(() => {
    messageAttachmentNativeSave(ordinal)
  }, [messageAttachmentNativeSave, ordinal])

  const onSaveAttachment =
    C.isMobile && (attachmentType === 'image' || C.Chat.isImageViewable(message))
      ? _onSaveAttachment
      : undefined

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

  const header = useHeader(ordinal)
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
