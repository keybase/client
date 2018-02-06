// @flow
import * as Types from '../../../constants/types/chat2'
import * as More from '../../../constants/types/more'
import * as Constants from '../../../constants/chat2'
import * as Chat2Gen from '../../../actions/chat2-gen'
import * as KBFSGen from '../../../actions/kbfs-gen'
import RenderAttachmentPopup from './'
import {compose, withStateHandlers, connect, type TypedState, type Dispatch} from '../../../util/container'
import {type RouteProps} from '../../../route-tree/render-route'

type OwnProps = RouteProps<{conversationIDKey: Types.ConversationIDKey, ordinal: Types.Ordinal}, {}>

const blankMessage = Constants.makeMessageAttachment({})

const mapStateToProps = (state: TypedState, ownProps: OwnProps) => {
  const conversationIDKey = ownProps.routeProps.get('conversationIDKey')
  const ordinal = ownProps.routeProps.get('ordinal')
  const message = Constants.getMessageMap(state, conversationIDKey).get(ordinal, blankMessage)
  return {
    _message: message.type === 'attachment' ? message : blankMessage,
  }
}

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp, navigateAppend}: OwnProps) => ({
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
  _onShowMenu: (message: Types.MessageAttachment, targetRect: ?ClientRect) => {
    dispatch(
      navigateAppend([
        {
          props: {message, position: 'bottom left', targetRect, navUpOnDelete: true},
          selected: 'messageAction',
        },
      ])
    )
  },
  onClose: () => {
    dispatch(navigateUp())
  },
})

const mergeProps = (
  stateProps,
  dispatchProps: More.ReturnType<typeof mapDispatchToProps>,
  ownProps: OwnProps
) => {
  const message = stateProps._message
  return {
    onClose: dispatchProps.onClose,
    onDownloadAttachment: message.downloadPath
      ? undefined
      : () => dispatchProps._onDownloadAttachment(message),
    onShowInFinder: message.downloadPath ? () => dispatchProps._onShowInFinder(message) : undefined,
    onShowMenu: (targetRect: ?ClientRect) => dispatchProps._onShowMenu(message, targetRect),
    path: message.deviceFilePath || message.devicePreviewPath,
    progress: message.transferProgress,
    progressLabel: message.deviceFilePath ? undefined : 'Loading',
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
)(RenderAttachmentPopup)
