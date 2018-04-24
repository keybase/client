// @flow
import * as Types from '../../../../../constants/types/chat2'
import * as KBFSGen from '../../../../../actions/kbfs-gen'
import * as Chat2Gen from '../../../../../actions/chat2-gen'
import {connect, type TypedState, type Dispatch, isMobile} from '../../../../../util/container'
import {globalColors} from '../../../../../styles'
import File from '.'

const mapStateToProps = (state: TypedState) => ({})

const mapDispatchToProps = (dispatch: Dispatch) => ({
  _loadPreview: (conversationIDKey: Types.ConversationIDKey, ordinal: Types.Ordinal) =>
    dispatch(
      Chat2Gen.createAttachmentNeedsUpdating({
        conversationIDKey,
        isPreview: true,
        ordinal,
      })
    ),
  _onDownload: (message: Types.MessageAttachment) => {
    dispatch(
      Chat2Gen.createAttachmentDownload({
        conversationIDKey: message.conversationIDKey,
        ordinal: message.ordinal,
      })
    )
  },
  _onShowInFinder: (message: Types.MessageAttachment) => {
    message.downloadPath && dispatch(KBFSGen.createOpenInFileUI({path: message.downloadPath}))
  },
})

const mergeProps = (stateProps, dispatchProps, ownProps) => {
  const message = ownProps.message
  const arrowColor = message.downloadPath
    ? globalColors.green
    : message.transferState === 'downloading' ? globalColors.blue : ''
  const progressLabel =
    message.transferState === 'downloading'
      ? 'Downloading'
      : message.transferState === 'uploading'
        ? 'Encrypting'
        : message.transferState === 'remoteUploading' ? 'sender uploading...' : ''
  const hasProgress = message.transferState && message.transferState !== 'remoteUploading'
  return {
    arrowColor,
    loadPreview: message.devicePreviewPath
      ? null
      : () => dispatchProps._loadPreview(message.conversationIDKey, message.ordinal),
    onDownload: !isMobile && !message.downloadPath ? () => dispatchProps._onDownload(message) : null,
    onShowInFinder: !isMobile && message.downloadPath ? () => dispatchProps._onShowInFinder(message) : null,
    progress: message.transferProgress,
    progressLabel,
    title: message.title || message.fileName,
    hasProgress,
  }
}

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(File)
