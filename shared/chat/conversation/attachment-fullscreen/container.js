// @flow
import * as Types from '../../../constants/types/chat2'
import * as Constants from '../../../constants/chat2'
import * as Chat2Gen from '../../../actions/chat2-gen'
import * as FsGen from '../../../actions/fs-gen'
import Fullscreen from './'
import {compose, withStateHandlers, connect, withProps} from '../../../util/container'
import {type RouteProps} from '../../../route-tree/render-route'

const blankMessage = Constants.makeMessageAttachment({})

type OwnProps = RouteProps<{}, {}>

const mapStateToProps = state => {
  const message = state.chat2.attachmentFullscreenMessage || blankMessage
  return {
    message: message.type === 'attachment' ? message : blankMessage,
  }
}

const mapDispatchToProps = (dispatch, {navigateUp, navigateAppend}: OwnProps) => ({
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
    dispatch(navigateUp())
  },
})

const mergeProps = (stateProps, dispatchProps, ownProps: OwnProps) => {
  const message = stateProps.message
  return {
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
    progress: message.transferProgress,
    progressLabel: message.fileURL ? undefined : 'Loading',
    title: message.title,
  }
}

export default compose(
  connect<OwnProps, _, _, _, _>(
    mapStateToProps,
    mapDispatchToProps,
    mergeProps
  ),
  withStateHandlers(
    {isZoomed: false},
    {
      onToggleZoom: ({isZoomed}) => () => ({isZoomed: !isZoomed}),
    }
  ),
  withProps(props => ({
    onHotkey: (cmd: string) => props.onHotkey(cmd),
  }))
)(Fullscreen)
