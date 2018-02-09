// @flow
import * as Types from '../../../../../constants/types/chat2'
import * as KBFSGen from '../../../../../actions/kbfs-gen'
import * as Chat2Gen from '../../../../../actions/chat2-gen'
import * as Route from '../../../../../actions/route-tree'
import {connect, type TypedState, type Dispatch, isMobile} from '../../../../../util/container'
import {globalColors} from '../../../../../styles'
import ImageAttachment from '.'

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
  _onClick: (message: Types.MessageAttachment) => {
    dispatch(
      Chat2Gen.createAttachmentNeedsUpdating({
        conversationIDKey: message.conversationIDKey,
        isPreview: false,
        ordinal: message.ordinal,
      })
    )
    dispatch(
      Route.navigateAppend([
        {
          props: {conversationIDKey: message.conversationIDKey, ordinal: message.ordinal},
          selected: 'attachment',
        },
      ])
    )
  },
  _onShowInFinder: (message: Types.MessageAttachment) => {
    message.downloadPath && dispatch(KBFSGen.createOpenInFileUI({path: message.downloadPath}))
  },
})

const mergeProps = (stateProps, dispatchProps, ownProps) => {
  const {message} = ownProps
  const arrowColor = message.downloadPath
    ? globalColors.green
    : message.transferState === 'downloading' ? globalColors.blue : null
  const progressLabel =
    message.transferState === 'downloading'
      ? 'Downloading'
      : message.transferState === 'uploading' ? 'Encrypting' : null
  return {
    arrowColor,
    height: message.previewHeight,
    isPreviewLoaded: !!message.devicePreviewPath,
    loadPreview:
      message.devicePreviewPath || !message.fileName // already have preview or is this a placeholder?
        ? undefined
        : () => dispatchProps._loadPreview(ownProps.message.conversationIDKey, ownProps.message.ordinal),
    message: ownProps.message,
    onClick: () => dispatchProps._onClick(ownProps.message),
    onShowInFinder:
      !isMobile && ownProps.message.downloadPath
        ? () => dispatchProps._onShowInFinder(ownProps.message)
        : undefined,
    path: message.devicePreviewPath,
    progress: message.transferProgress,
    progressLabel,
    title:
      message.title ||
      message.fileName /* +      ' ordinal:' +      Types.ordinalToNumber(message.ordinal) +      ' id: ' +      message.id */,
    width: message.previewWidth,
  }
}

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(ImageAttachment)
