// @flow
import * as Types from '../../../../../constants/types/chat2'
import * as KBFSGen from '../../../../../actions/kbfs-gen'
import * as Chat2Gen from '../../../../../actions/chat2-gen'
import {connect, type TypedState, type Dispatch, isMobile} from '../../../../../util/container'
import {globalColors} from '../../../../../styles'
import ImageAttachment from '.'
import {imgMaxWidth} from './image-render'

type OwnProps = {
  message: Types.MessageAttachment,
  toggleMessageMenu: () => void,
}

const mapStateToProps = (state: TypedState) => ({})

const mapDispatchToProps = (dispatch: Dispatch) => ({
  _onClick: (message: Types.MessageAttachment) => {
    dispatch(
      Chat2Gen.createAttachmentPreviewSelect({
        message,
      })
    )
  },
  _onShowInFinder: (message: Types.MessageAttachment) => {
    message.downloadPath && dispatch(KBFSGen.createOpenInFileUI({path: message.downloadPath}))
  },
})

const mergeProps = (stateProps, dispatchProps, ownProps: OwnProps) => {
  const {message} = ownProps
  // On mobile we use this icon to indicate we have the file stored locally, and it can be viewed. This is a
  // similar meaning to desktop.
  const arrowColor = !isMobile
    ? message.downloadPath
      ? globalColors.green
      : message.transferState === 'downloading'
        ? globalColors.blue
        : null
    : null
  const progressLabel =
    message.transferState === 'downloading'
      ? 'Downloading'
      : message.transferState === 'uploading'
        ? 'Uploading'
        : message.transferState === 'remoteUploading'
          ? 'waiting...'
          : null
  const buttonType = message.showPlayButton ? 'play' : null
  const hasProgress = message.transferState && message.transferState !== 'remoteUploading'
  return {
    arrowColor,
    height: message.previewHeight,
    message,
    onClick: () => dispatchProps._onClick(message),
    onShowInFinder:
      !isMobile && message.downloadPath
        ? (e: SyntheticEvent<any>) => {
            e.preventDefault()
            e.stopPropagation()
            dispatchProps._onShowInFinder(message)
          }
        : null,
    path: message.previewURL,
    fullPath: message.fileURL,
    progress: message.transferProgress,
    progressLabel,
    showButton: buttonType,
    videoDuration: message.videoDuration || '',
    inlineVideoPlayable: message.videoDuration,
    title: message.title || message.fileName,
    toggleMessageMenu: ownProps.toggleMessageMenu,
    width: Math.min(message.previewWidth, imgMaxWidth()),
    hasProgress,
  }
}

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(ImageAttachment)
