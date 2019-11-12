import * as Types from '../../../constants/types/chat2'
import * as Constants from '../../../constants/chat2'
import * as Chat2Gen from '../../../actions/chat2-gen'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import * as FsGen from '../../../actions/fs-gen'
import Fullscreen from '.'
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
  _onAllMedia: (conversationIDKey: Types.ConversationIDKey) =>
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [
          {
            props: {conversationIDKey, tab: 'attachments'},
            selected: 'chatInfoPanel',
          },
        ],
      })
    ),
  onClose: () => dispatch(RouteTreeGen.createNavigateUp()),
  _onDownloadAttachment: (message: Types.MessageAttachment) =>
    dispatch(Chat2Gen.createAttachmentDownload({message})),
  _onShowInFinder: (message: Types.MessageAttachment) => {
    message.downloadPath &&
      dispatch(FsGen.createOpenLocalPathInSystemFileManager({localPath: message.downloadPath}))
  },
  _onSwitchAttachment: (
    conversationIDKey: Types.ConversationIDKey,
    messageID: Types.MessageID,
    prev: boolean
  ) => {
    dispatch(Chat2Gen.createAttachmentFullscreenNext({backInTime: prev, conversationIDKey, messageID}))
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
      isVideo: Constants.isVideoAttachment(message),
      message,
      onAllMedia: () => dispatchProps._onAllMedia(message.conversationIDKey),
      onClose: dispatchProps.onClose,
      onDownloadAttachment: message.downloadPath
        ? undefined
        : () => dispatchProps._onDownloadAttachment(message),
      onNextAttachment: () => dispatchProps._onSwitchAttachment(message.conversationIDKey, message.id, false),
      onPreviousAttachment: () =>
        dispatchProps._onSwitchAttachment(message.conversationIDKey, message.id, true),
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
