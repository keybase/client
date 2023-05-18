import * as Chat2Gen from '../../../../../actions/chat2-gen'
import * as Constants from '../../../../../constants/chat2'
import * as Container from '../../../../../util/container'
import * as CryptoGen from '../../../../../actions/crypto-gen'
import * as FsGen from '../../../../../actions/fs-gen'
import * as React from 'react'
import * as RouteTreeGen from '../../../../../actions/route-tree-gen'
import * as Tabs from '../../../../../constants/tabs'
import File from '.'
import type * as CryptoTypes from '../../../../../constants/types/crypto'
import {ConvoIDContext, OrdinalContext} from '../../ids-context'
import {globalColors} from '../../../../../styles'
import {isPathSaltpack} from '../../../../../constants/crypto'
import shallowEqual from 'shallowequal'

type OwnProps = {
  toggleMessageMenu: () => void
}

const missingMessage = Constants.makeMessageAttachment({})

const FileContainer = React.memo(function FileContainer(p: OwnProps) {
  const conversationIDKey = React.useContext(ConvoIDContext)
  const ordinal = React.useContext(OrdinalContext)
  const isEditing = Container.useSelector(state => {
    const editInfo = Constants.getEditInfo(state, conversationIDKey)
    return editInfo?.ordinal === ordinal
  })

  const {fileType, downloadPath, transferState, transferErrMsg, fileName} = Container.useSelector(state => {
    const m = Constants.getMessage(state, conversationIDKey, ordinal) ?? missingMessage
    const {downloadPath, fileName, fileType, transferErrMsg, transferState} = m
    return {downloadPath, fileName, fileType, transferErrMsg, transferState}
  }, shallowEqual)

  // TODO not message
  const message = Container.useSelector(state => {
    const m = Constants.getMessage(state, conversationIDKey, ordinal)
    return m?.type === 'attachment' ? m : missingMessage
  })

  const dispatch = Container.useDispatch()

  const onSaltpackFileOpen = React.useCallback(
    (path: string, operation: CryptoTypes.Operations) => {
      dispatch(RouteTreeGen.createSwitchTab({tab: Tabs.cryptoTab}))
      dispatch(CryptoGen.createOnSaltpackOpenFile({operation, path: new Container.HiddenString(path)}))
    },
    [dispatch]
  )
  const onShowInFinder = React.useCallback(() => {
    downloadPath && dispatch(FsGen.createOpenLocalPathInSystemFileManager({localPath: downloadPath}))
  }, [dispatch, downloadPath])

  const onDownload = React.useCallback(() => {
    if (Container.isMobile) {
      message && dispatch(Chat2Gen.createMessageAttachmentNativeShare({message}))
    } else {
      if (!downloadPath) {
        if (fileType === 'application/pdf') {
          dispatch(RouteTreeGen.createNavigateAppend({path: [{props: {message}, selected: 'chatPDF'}]}))
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
  }, [dispatch, downloadPath, transferState, fileType, message])

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
    transferState: transferState ?? null,
  }

  return <File {...props} />
})

export default FileContainer
