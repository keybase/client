import * as Types from '../../../../../constants/types/chat2'
import * as FsGen from '../../../../../actions/fs-gen'
import * as Chat2Gen from '../../../../../actions/chat2-gen'
import * as Container from '../../../../../util/container'
import {globalColors} from '../../../../../styles'
import File from '.'

type OwnProps = {
  message: Types.MessageAttachment
}

export default Container.connect(
  () => ({}),
  dispatch => ({
    _onDownload: (message: Types.MessageAttachment) => {
      dispatch(
        Chat2Gen.createAttachmentDownload({
          message,
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
      ? 'green'
      : transferState === 'downloading'
      ? 'blue'
      : ''
    const hasProgress =
      !!transferState && transferState !== 'remoteUploading' && transferState !== 'mobileSaving'
    return {
      arrowColor,
      errorMsg: message.transferErrMsg || '',
      fileName: message.fileName,
      hasProgress,
      onDownload: Container.isMobile
        ? () => dispatchProps._onShare(message)
        : !message.downloadPath
        ? () => dispatchProps._onDownload(message)
        : undefined,
      onShowInFinder:
        !Container.isMobile && message.downloadPath
          ? () => dispatchProps._onShowInFinder(message)
          : undefined,
      progress: message.transferProgress,
      title: message.title || message.fileName,
      transferState,
    }
  }
)(File)
