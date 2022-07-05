import * as Types from '../../../../../constants/types/chat2'
import * as CryptoTypes from '../../../../../constants/types/crypto'
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
  message: Types.MessageAttachment
}

export default Container.connect(
  () => ({}),
  dispatch => ({
    _onDownload: (message: Types.MessageAttachment) => {
      switch (message.transferState) {
        case 'uploading':
        case 'downloading':
        case 'mobileSaving':
          return
      }
      dispatch(
        Chat2Gen.createAttachmentDownload({
          message,
        })
      )
    },
    _onSaltpackFileOpen: (path: string, operation: CryptoTypes.Operations) => {
      dispatch(RouteTreeGen.createSwitchTab({tab: Tabs.cryptoTab}))
      dispatch(
        CryptoGen.createOnSaltpackOpenFile({
          operation,
          path: new Container.HiddenString(path),
        })
      )
    },
    _onShare: (message: Types.MessageAttachment) => {
      dispatch(Chat2Gen.createMessageAttachmentNativeShare({message}))
    },
    _onShowInFinder: (message: Types.MessageAttachment) => {
      message.downloadPath &&
        dispatch(FsGen.createOpenLocalPathInSystemFileManager({localPath: message.downloadPath}))
    },
  }),
  (_, dispatchProps, ownProps: OwnProps) => {
    const message = ownProps.message
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
    return {
      arrowColor,
      errorMsg: message.transferErrMsg || '',
      fileName: message.fileName,
      hasProgress,
      isSaltpackFile: isPathSaltpack(message.fileName),
      message,
      onDownload: () => {
        if (Container.isMobile) {
          dispatchProps._onShare(message)
        } else {
          if (!message.downloadPath) {
            dispatchProps._onDownload(message)
          }
        }
      },
      onSaltpackFileOpen: dispatchProps._onSaltpackFileOpen,
      onShowInFinder:
        !Container.isMobile && message.downloadPath
          ? () => dispatchProps._onShowInFinder(message)
          : undefined,
      progress: message.transferProgress,
      title: message.decoratedText?.stringValue() || message.title || message.fileName,
      transferState,
    }
  }
)(File)
