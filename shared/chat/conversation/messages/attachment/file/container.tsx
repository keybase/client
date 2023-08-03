import * as Chat2Gen from '../../../../../actions/chat2-gen'
import * as Constants from '../../../../../constants/chat2'
import * as RouterConstants from '../../../../../constants/router2'
import * as FSConstants from '../../../../../constants/fs'
import * as CryptoConstants from '../../../../../constants/crypto'
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
  const isEditing = Constants.useContext(s => !!s.editing)

  const {fileType, downloadPath, transferState, transferErrMsg, fileName} = Constants.useContext(s => {
    const m = s.messageMap.get(ordinal) ?? missingMessage
    const {downloadPath, fileName, fileType, transferErrMsg, transferState} = m
    return {downloadPath, fileName, fileType, transferErrMsg, transferState}
  }, shallowEqual)

  // TODO not message
  const message = Constants.useContext(s => {
    const m = s.messageMap.get(ordinal)
    return m?.type === 'attachment' ? m : missingMessage
  })

  const dispatch = Container.useDispatch()
  const saltpackOpenFile = CryptoConstants.useState(s => s.dispatch.onSaltpackOpenFile)
  const switchTab = RouterConstants.useState(s => s.dispatch.switchTab)
  const onSaltpackFileOpen = React.useCallback(
    (path: string, operation: CryptoTypes.Operations) => {
      switchTab(Tabs.cryptoTab)
      saltpackOpenFile(operation, path)
    },
    [switchTab, saltpackOpenFile]
  )
  const openLocalPathInSystemFileManagerDesktop = FSConstants.useState(
    s => s.dispatch.dynamic.openLocalPathInSystemFileManagerDesktop
  )
  const onShowInFinder = React.useCallback(() => {
    downloadPath && openLocalPathInSystemFileManagerDesktop?.(downloadPath)
  }, [openLocalPathInSystemFileManagerDesktop, downloadPath])

  const navigateAppend = RouterConstants.useState(s => s.dispatch.navigateAppend)
  const onDownload = React.useCallback(() => {
    if (Container.isMobile) {
      message && dispatch(Chat2Gen.createMessageAttachmentNativeShare({message}))
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
          message &&
            dispatch(
              Chat2Gen.createAttachmentDownload({
                conversationIDKey: message.conversationIDKey,
                ordinal: message.ordinal,
              })
            )
        }
      }
    }
  }, [navigateAppend, dispatch, downloadPath, transferState, fileType, message])

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
