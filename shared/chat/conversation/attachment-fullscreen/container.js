// @flow
import * as Types from '../../../constants/types/chat2'
import * as Constants from '../../../constants/chat2'
import * as Chat2Gen from '../../../actions/chat2-gen'
import * as KBFSGen from '../../../actions/kbfs-gen'
import Fullscreen from './'
import {compose, withStateHandlers, connect, type TypedState} from '../../../util/container'
import {type RouteProps} from '../../../route-tree/render-route'

type OwnProps = RouteProps<{conversationIDKey: Types.ConversationIDKey, ordinal: Types.Ordinal}, {}>

const blankMessage = Constants.makeMessageAttachment({})

const mapStateToProps = (state: TypedState, ownProps: OwnProps) => {
  const conversationIDKey = ownProps.routeProps.get('conversationIDKey')
  const ordinal = ownProps.routeProps.get('ordinal')
  const message = Constants.getMessage(state, conversationIDKey, ordinal) || blankMessage
  return {
    message: message.type === 'attachment' ? message : blankMessage,
  }
}

const mapDispatchToProps = (dispatch, {navigateUp, navigateAppend}: OwnProps) => ({
  _onDownloadAttachment: (message: Types.MessageAttachment) => {
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
  onClose: () => {
    dispatch(navigateUp())
  },
})

const mergeProps = (stateProps, dispatchProps, ownProps: OwnProps) => {
  const message = stateProps.message
  return {
    message,
    onClose: dispatchProps.onClose,
    onDownloadAttachment: message.downloadPath
      ? undefined
      : () => dispatchProps._onDownloadAttachment(message),
    onShowInFinder: message.downloadPath ? () => dispatchProps._onShowInFinder(message) : undefined,
    path: message.fileURL || message.previewURL,
    progress: message.transferProgress,
    progressLabel: message.fileURL ? undefined : 'Loading',
    title: message.title,
  }
}

export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  withStateHandlers(
    {isZoomed: false},
    {
      onToggleZoom: ({isZoomed}) => () => ({isZoomed: !isZoomed}),
    }
  )
)(Fullscreen)
