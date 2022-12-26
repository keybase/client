import * as React from 'react'
import type * as Types from '../../../../../constants/types/chat2'
import * as Constants from '../../../../../constants/chat2'
import type * as CryptoTypes from '../../../../../constants/types/crypto'
import * as Tabs from '../../../../../constants/tabs'
import * as FsGen from '../../../../../actions/fs-gen'
import * as Chat2Gen from '../../../../../actions/chat2-gen'
import * as RouteTreeGen from '../../../../../actions/route-tree-gen'
import * as CryptoGen from '../../../../../actions/crypto-gen'
import * as Container from '../../../../../util/container'
import {globalColors} from '../../../../../styles'
import {isPathSaltpack} from '../../../../../constants/crypto'
import File from '.'

type OwnProps = {
  isHighlighted?: boolean
  message: Types.MessageAttachment
}

const FileContainer = React.memo(function FileContainer(p: OwnProps) {
  const {message, isHighlighted} = p
  const editInfo = Container.useSelector(state => Constants.getEditInfo(state, message.conversationIDKey))
  const isEditing = !!(editInfo && editInfo.ordinal === message.ordinal)

  const dispatch = Container.useDispatch()

  const onSaltpackFileOpen = React.useCallback(
    (path: string, operation: CryptoTypes.Operations) => {
      dispatch(RouteTreeGen.createSwitchTab({tab: Tabs.cryptoTab}))
      dispatch(CryptoGen.createOnSaltpackOpenFile({operation, path: new Container.HiddenString(path)}))
    },
    [dispatch]
  )
  const onShowInFinder = React.useCallback(() => {
    message.downloadPath &&
      dispatch(FsGen.createOpenLocalPathInSystemFileManager({localPath: message.downloadPath}))
  }, [dispatch, message])

  const onDownload = React.useCallback(() => {
    if (Container.isMobile) {
      dispatch(Chat2Gen.createMessageAttachmentNativeShare({message}))
    } else {
      if (!message.downloadPath) {
        if (message.fileType === 'application/pdf') {
          dispatch(RouteTreeGen.createNavigateAppend({path: [{props: {message}, selected: 'chatPDF'}]}))
        } else {
          switch (message.transferState) {
            case 'uploading':
            case 'downloading':
            case 'mobileSaving':
              return
            default:
          }
          dispatch(Chat2Gen.createAttachmentDownload({message}))
        }
      }
    }
  }, [dispatch, message])

  const {downloadPath, transferState} = message

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
    errorMsg: message.transferErrMsg || '',
    fileName: message.fileName,
    hasProgress,
    isEditing,
    isHighlighted,
    isSaltpackFile: isPathSaltpack(message.fileName),
    message,
    onDownload,
    onSaltpackFileOpen,
    onShowInFinder: !Container.isMobile && message.downloadPath ? onShowInFinder : undefined,
    progress: message.transferProgress,
    title: message.decoratedText?.stringValue() || message.title || message.fileName,
    transferState,
  }

  return <File {...props} />
})

export default FileContainer
