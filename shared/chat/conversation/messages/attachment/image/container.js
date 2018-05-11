// @flow
import * as Types from '../../../../../constants/types/chat2'
import * as KBFSGen from '../../../../../actions/kbfs-gen'
import * as Route from '../../../../../actions/route-tree'
import {connect, type TypedState, type Dispatch, isMobile} from '../../../../../util/container'
import {globalColors} from '../../../../../styles'
import ImageAttachment from '.'
import {imgMaxWidth} from './image-render'

type OwnProps = {
  message: Types.MessageAttachment,
  toggleShowingMenu: () => void,
}

const mapStateToProps = (state: TypedState) => ({})

const mapDispatchToProps = (dispatch: Dispatch) => ({
  _onClick: (message: Types.MessageAttachment) => {
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
})

const mergeProps = (stateProps, dispatchProps, ownProps: OwnProps) => {
  const {message} = ownProps
  const arrowColor = message.downloadPath
    ? globalColors.green
    : message.transferState === 'downloading'
      ? globalColors.blue
      : null
  const progressLabel =
    message.transferState === 'downloading'
      ? 'Downloading'
      : message.transferState === 'uploading'
        ? 'Encrypting'
        : message.transferState === 'remoteUploading'
          ? 'waiting...'
          : null
  const hasProgress = message.transferState && message.transferState !== 'remoteUploading'
  return {
    arrowColor,
    height: message.previewHeight,
    message,
    onClick: () => dispatchProps._onClick(message),
    onShowInFinder:
      !isMobile && message.downloadPath
        ? (e: SyntheticEvent<*>) => {
            e.preventDefault()
            e.stopPropagation()
            dispatchProps._onShowInFinder(message)
          }
        : null,
    path: message.previewURL,
    progress: message.transferProgress,
    progressLabel,
    title: message.title || message.fileName,
    toggleShowingMenu: ownProps.toggleShowingMenu,
    width: Math.min(message.previewWidth, imgMaxWidth()),
    hasProgress,
  }
}

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(ImageAttachment)
