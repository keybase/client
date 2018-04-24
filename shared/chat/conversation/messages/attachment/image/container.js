// @flow
import * as Types from '../../../../../constants/types/chat2'
import * as KBFSGen from '../../../../../actions/kbfs-gen'
import * as Chat2Gen from '../../../../../actions/chat2-gen'
import * as Route from '../../../../../actions/route-tree'
import {connect, type TypedState, type Dispatch, isMobile} from '../../../../../util/container'
import {globalColors} from '../../../../../styles'
import ImageAttachment from '.'
import {imgMaxWidth} from './image-render'

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
          selected: 'attachmentFullscreen',
        },
      ])
    )
  },
  _onShowInFinder: (message: Types.MessageAttachment) => {
    message.downloadPath && dispatch(KBFSGen.createOpenInFileUI({path: message.downloadPath}))
  },
  _onShowMenu: (targetRect: ?ClientRect, message: Types.Message) =>
    dispatch(
      Route.navigateAppend([
        {
          props: {message, position: 'bottom left', targetRect},
          selected: 'messageAction',
        },
      ])
    ),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => {
  const {message} = ownProps
  const arrowColor = message.downloadPath
    ? globalColors.green
    : message.transferState === 'downloading' ? globalColors.blue : null
  const progressLabel =
    message.transferState === 'downloading'
      ? 'Downloading'
      : message.transferState === 'uploading'
        ? 'Encrypting'
        : message.transferState === 'remoteUploading' ? 'sender uploading' : null
  const hasProgress = message.transferState && message.transferState !== 'remoteUploading'
  return {
    arrowColor,
    height: message.previewHeight,
    isPreviewLoaded: !!message.devicePreviewPath,
    loadPreview:
      message.devicePreviewPath || !message.fileName // already have preview or is this a placeholder?
        ? null
        : () => dispatchProps._loadPreview(message.conversationIDKey, message.ordinal),
    message,
    onClick: () => dispatchProps._onClick(message),
    onShowInFinder:
      !isMobile && message.downloadPath
        ? e => {
            e.preventDefault()
            e.stopPropagation()
            dispatchProps._onShowInFinder(message)
          }
        : null,
    onShowMenu: () => dispatchProps._onShowMenu(null, message),
    path: message.devicePreviewPath,
    progress: message.transferProgress,
    progressLabel,
    title: message.title || message.fileName,
    width: Math.min(message.previewWidth, imgMaxWidth()),
    hasProgress,
  }
}

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(ImageAttachment)
