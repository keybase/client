// @flow
import * as Types from '../../../constants/types/chat2'
// import * as ChatGen from '../../../actions/chat-gen'
// import * as KBFSGen from '../../../actions/kbfs-gen'
import RenderAttachmentPopup from './'
import {compose, withStateHandlers, connect, type TypedState} from '../../../util/container'
// import {lookupMessageProps} from '../../shared'
import {type RouteProps} from '../../../route-tree/render-route'

type OwnProps = RouteProps<{message: Types.MessageAttachment}, {}>

const mapStateToProps = (state: TypedState) => {
  return {
    // you: state.config.username,
  }
}

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp, navigateAppend}) => ({
  _onShowMenu: (message: Types.MessageAttachment, targetRect: ?ClientRect) =>
    dispatch(
      navigateAppend([{props: {message, position: 'bottom left', targetRect}, selected: 'messageAction'}])
    ),
  // deleteMessage: message => dispatch(ChatGen.createDeleteMessage({message})),
  onClose: () => dispatch(navigateUp()),
  // onDownloadAttachment: (message: Types.AttachmentMessage) => {
  // if (!message.messageID || !message.filename) {
  // throw new Error('Cannot download attachment with missing messageID or filename')
  // }
  // dispatch(ChatGen.createSaveAttachment({messageKey: message.key}))
  // },
  // onOpenInFileUI: (path: string) => dispatch(KBFSGen.createOpenInFileUI({path})),
})

const mergeProps = (stateProps, dispatchProps, ownProps: OwnProps) => {
  // const {message, localMessageState} = stateProps
  const message = ownProps.routeProps.get('message')
  return {
    deviceFilePath: message.deviceFilePath,
    devicePreviewPath: message.devicePreviewPath,
    onClose: dispatchProps.onClose,
    onDownloadAttachment: null, // TODO
    onShowMenu: (targetRect: ?ClientRect) => dispatchProps._onShowMenu(message, targetRect),
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
