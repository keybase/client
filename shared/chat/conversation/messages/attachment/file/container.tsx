import * as C from '@/constants'
import * as React from 'react'
import File from '.'
import type * as T from '@/constants/types'
import {OrdinalContext} from '@/chat/conversation/messages/ids-context'
import {globalColors} from '@/styles'
import {isPathSaltpack} from '@/constants/crypto'

type OwnProps = {
  showPopup: () => void
}

const missingMessage = C.Chat.makeMessageAttachment({})

const FileContainer = React.memo(function FileContainer(p: OwnProps) {
  const ordinal = React.useContext(OrdinalContext)
  const isEditing = C.useChatContext(s => !!s.editing)
  const conversationIDKey = C.useChatContext(s => s.id)

  const {fileType, downloadPath, transferState, transferErrMsg, fileName} = C.useChatContext(
    C.useShallow(s => {
      const m = s.messageMap.get(ordinal) ?? missingMessage
      const {downloadPath, fileName, fileType, transferErrMsg, transferState} = m
      return {downloadPath, fileName, fileType, transferErrMsg, transferState}
    })
  )

  const title = C.useChatContext(s => {
    const _m = s.messageMap.get(ordinal)
    const m = _m?.type === 'attachment' ? _m : missingMessage
    return m.decoratedText?.stringValue() || m.title || m.fileName
  })

  const progress = C.useChatContext(s => {
    const _m = s.messageMap.get(ordinal)
    const m = _m?.type === 'attachment' ? _m : missingMessage
    return m.transferProgress
  })

  const saltpackOpenFile = C.useCryptoState(s => s.dispatch.onSaltpackOpenFile)
  const switchTab = C.useRouterState(s => s.dispatch.switchTab)
  const onSaltpackFileOpen = React.useCallback(
    (path: string, operation: T.Crypto.Operations) => {
      switchTab(C.Tabs.cryptoTab)
      saltpackOpenFile(operation, path)
    },
    [switchTab, saltpackOpenFile]
  )
  const openLocalPathInSystemFileManagerDesktop = C.useFSState(
    s => s.dispatch.dynamic.openLocalPathInSystemFileManagerDesktop
  )
  const onShowInFinder = React.useCallback(() => {
    downloadPath && openLocalPathInSystemFileManagerDesktop?.(downloadPath)
  }, [openLocalPathInSystemFileManagerDesktop, downloadPath])

  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const attachmentDownload = C.useChatContext(s => s.dispatch.attachmentDownload)
  const messageAttachmentNativeShare = C.useChatContext(s => s.dispatch.messageAttachmentNativeShare)
  const onDownload = React.useCallback(() => {
    if (C.isMobile) {
      messageAttachmentNativeShare(ordinal)
    } else if (!downloadPath) {
      if (fileType === 'application/pdf') {
        navigateAppend({
          props: {conversationIDKey, ordinal},
          selected: 'chatPDF',
        })
      } else {
        switch (transferState) {
          case 'uploading':
          case 'downloading':
          case 'mobileSaving':
            return
          default:
        }
        attachmentDownload(ordinal)
      }
    }
  }, [
    ordinal,
    conversationIDKey,
    navigateAppend,
    attachmentDownload,
    messageAttachmentNativeShare,
    downloadPath,
    transferState,
    fileType,
  ])

  const arrowColor = C.isMobile
    ? ''
    : downloadPath
      ? globalColors.green
      : transferState === 'downloading'
        ? globalColors.blue
        : ''
  const hasProgress =
    !!transferState && transferState !== 'remoteUploading' && transferState !== 'mobileSaving'

  const props = {
    arrowColor,
    errorMsg: transferErrMsg || '',
    fileName: fileName ?? '',
    hasProgress,
    isEditing,
    isSaltpackFile: !!fileName && isPathSaltpack(fileName),
    onDownload,
    onSaltpackFileOpen,
    onShowInFinder: !C.isMobile && downloadPath ? onShowInFinder : undefined,
    progress,
    showMessageMenu: p.showPopup,
    title,
    transferState,
  }

  return <File {...props} />
})

export default FileContainer
