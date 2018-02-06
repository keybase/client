// @flow
import * as Types from '../../../constants/types/chat2'
import * as More from '../../../constants/types/more'
import * as Constants from '../../../constants/chat2'
import * as Chat2Gen from '../../../actions/chat2-gen'
import * as KBFSGen from '../../../actions/kbfs-gen'
import RenderAttachmentPopup from './'
import {compose, withStateHandlers, connect, type TypedState, type Dispatch} from '../../../util/container'
// import {lookupMessageProps} from '../../shared'
import {type RouteProps} from '../../../route-tree/render-route'

type OwnProps = RouteProps<{conversationIDKey: Types.ConversationIDKey, ordinal: Types.Ordinal}, {}>

const blankMessage = Constants.makeMessageAttachment({})

const mapStateToProps = (state: TypedState, ownProps: OwnProps) => {
  const conversationIDKey = ownProps.routeProps.get('conversationIDKey')
  const ordinal = ownProps.routeProps.get('ordinal')
  const message = Constants.getMessageMap(state, conversationIDKey).get(ordinal, blankMessage)
  return {
    _message: message.type === 'attachment' ? message : blankMessage,
    // you: state.config.username,
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
      navigateAppend([{props: {message, position: 'bottom left', targetRect}, selected: 'messageAction'}])
    )
  },
  // deleteMessage: message => dispatch(ChatGen.createDeleteMessage({message})),
  // if (!message.messageID || !message.filename) {
  // throw new Error('Cannot download attachment with missing messageID or filename')
  // }
  // dispatch(ChatGen.createSaveAttachment({messageKey: message.key}))
  // },
  onClose: () => {
    dispatch(navigateUp())
  },
})

const mergeProps = (
  stateProps,
  dispatchProps: More.ReturnType<typeof mapDispatchToProps>,
  ownProps: OwnProps
) => {
  // const {message, localMessageState} = stateProps
  const message = stateProps._message
  return {
    isLoadidng: !message.deviceFilePath,
    onClose: dispatchProps.onClose,
    onDownloadAttachment: message.downloadPath ? null : () => dispatchProps._onDownloadAttachment(message),
    onShowInFinder: message.downloadPath ? () => dispatchProps._onShowInFinder(message) : null,
    onShowMenu: (targetRect: ?ClientRect) => dispatchProps._onShowMenu(message, targetRect),
    path: message.deviceFilePath || message.devicePreviewPath,
    title: message.title,
    // ...stateProps,
    // ...dispatchProps,
    // onDeleteMessage: () => {
    // dispatchProps.deleteMessage(message)
    // dispatchProps.onClose()
    // },
    // onMessageAction: () => dispatchProps._onMessageAction(message),
    // onDownloadAttachment: () => dispatchProps.onDownloadAttachment(message),
    // onOpenInFileUI: () => dispatchProps.onOpenInFileUI(localMessageState.savedPath),
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
