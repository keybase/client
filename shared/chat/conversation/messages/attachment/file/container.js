// @flow
import * as Types from '../../../../../constants/types/chat2'
import * as KBFSGen from '../../../../../actions/kbfs-gen'
import * as Chat2Gen from '../../../../../actions/chat2-gen'
import {connect, type TypedState, type Dispatch, isMobile} from '../../../../../util/container'
import {globalColors} from '../../../../../styles'
import File from '.'

const mapStateToProps = (state: TypedState) => ({})

const mapDispatchToProps = (dispatch: Dispatch) => ({
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
      : message.transferState === 'uploading' ? 'Encrypting' : ''

  return {
    arrowColor,
    onDownload: !isMobile && !message.downloadPath ? () => dispatchProps._onDownload(message) : null,
    onShowInFinder: !isMobile && message.downloadPath ? () => dispatchProps._onShowInFinder(message) : null,
    progress: message.transferProgress,
    progressLabel,
    title: message.title || message.fileName,
  }
}

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(File)
