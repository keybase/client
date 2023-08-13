import * as C from '../../../../../constants'
import * as Constants from '../../../../../constants/chat2'
import * as Container from '../../../../../util/container'
import * as React from 'react'
import * as Tabs from '../../../../../constants/tabs'
import File from '.'
import type * as CryptoTypes from '../../../../../constants/types/crypto'
import {OrdinalContext} from '../../ids-context'
import {globalColors} from '../../../../../styles'
import {isPathSaltpack} from '../../../../../constants/crypto'
import shallowEqual from 'shallowequal'

type OwnProps = {
  toggleMessageMenu: () => void
}

const missingMessage = Constants.makeMessageAttachment({})

const FileContainer = React.memo(function FileContainer(p: OwnProps) {
  const ordinal = React.useContext(OrdinalContext)
  const isEditing = C.useChatContext(s => !!s.editing)

  const {fileType, downloadPath, transferState, transferErrMsg, fileName} = C.useChatContext(s => {
    const m = s.messageMap.get(ordinal) ?? missingMessage
    const {downloadPath, fileName, fileType, transferErrMsg, transferState} = m
    return {downloadPath, fileName, fileType, transferErrMsg, transferState}
  }, shallowEqual)

  // TODO not message
  const message = C.useChatContext(s => {
    const m = s.messageMap.get(ordinal)
    return m?.type === 'attachment' ? m : missingMessage
  })

  const saltpackOpenFile = C.useCryptoState(s => s.dispatch.onSaltpackOpenFile)
  const switchTab = C.useRouterState(s => s.dispatch.switchTab)
  const onSaltpackFileOpen = React.useCallback(
    (path: string, operation: CryptoTypes.Operations) => {
      switchTab(Tabs.cryptoTab)
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
    if (Container.isMobile) {
      message && messageAttachmentNativeShare(message)
    } else {
      if (!downloadPath) {
        if (fileType === 'application/pdf') {
          navigateAppend({props: {message}, selected: 'chatPDF'})
        } else {
          switch (transferState) {
            case 'uploading':
            case 'downloading':
            case 'mobileSaving':
              return
            default:
          }
          message && attachmentDownload(message.ordinal)
        }
      }
    }
  }, [
    navigateAppend,
    attachmentDownload,
    messageAttachmentNativeShare,
    downloadPath,
    transferState,
    fileType,
    message,
  ])

  const arrowColor = Container.isMobile
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
    message,
    onDownload,
    onSaltpackFileOpen,
    onShowInFinder: !Container.isMobile && downloadPath ? onShowInFinder : undefined,
    progress: message.transferProgress,
    title: message.decoratedText?.stringValue() || message.title || message.fileName,
    toggleMessageMenu: p.toggleMessageMenu,
    transferState,
  }

  return <File {...props} />
})

export default FileContainer
