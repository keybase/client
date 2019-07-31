import * as Types from '../../../constants/types/chat2'
import * as Constants from '../../../constants/chat2'
import * as Chat2Gen from '../../../actions/chat2-gen'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import * as FsGen from '../../../actions/fs-gen'
import Fullscreen from './'
import * as Container from '../../../util/container'
import {imgMaxWidthRaw} from '../messages/attachment/image/image-render'

const blankMessage = Constants.makeMessageAttachment({})

type OwnProps = {}

const mapStateToProps = (state: Container.TypedState) => {
  const selection = state.chat2.attachmentFullscreenSelection
  const message = selection ? selection.message : blankMessage
  return {
    autoPlay: selection ? selection.autoPlay : false,
    message: message.type === 'attachment' ? message : blankMessage,
  }
}

const mapDispatchToProps = (dispatch: Container.TypedDispatch) => ({
  _onDownloadAttachment: (message: Types.MessageAttachment) => {
    dispatch(
      Chat2Gen.createAttachmentDownload({
        message,
      })
    )
  },
  _onHotkey: (conversationIDKey: Types.ConversationIDKey, messageID: Types.MessageID, cmd: string) => {
    switch (cmd) {
      case 'left':
      case 'right':
        dispatch(
          Chat2Gen.createAttachmentFullscreenNext({
            backInTime: cmd === 'left',
            conversationIDKey,
            messageID,
          })
        )
        break
    }
  },
  _onShowInFinder: (message: Types.MessageAttachment) => {
    message.downloadPath &&
      dispatch(FsGen.createOpenLocalPathInSystemFileManager({localPath: message.downloadPath}))
  },
  onClose: () => {
    dispatch(RouteTreeGen.createNavigateUp())
  },
})

const Connected = Container.connect(
  mapStateToProps,
  mapDispatchToProps,
  (stateProps, dispatchProps, _: OwnProps) => {
    const message = stateProps.message
    const {height, width} = Constants.clampImageSize(
      message.previewWidth,
      message.previewHeight,
      imgMaxWidthRaw()
    )
    return {
      autoPlay: stateProps.autoPlay,
      hotkeys: ['left', 'right'],
      isVideo: Constants.isVideoAttachment(message),
      message,
      onClose: dispatchProps.onClose,
      onDownloadAttachment: message.downloadPath
        ? undefined
        : () => dispatchProps._onDownloadAttachment(message),
      onHotkey: (cmd: string) => dispatchProps._onHotkey(message.conversationIDKey, message.id, cmd),
      onShowInFinder: message.downloadPath ? () => dispatchProps._onShowInFinder(message) : undefined,
      path: message.fileURL || message.previewURL,
      previewHeight: height,
      previewWidth: width,
      progress: message.transferProgress,
      progressLabel: message.fileURL ? undefined : 'Loading',
      title: message.title,
    }
  }
)(Fullscreen)

export default Connected
