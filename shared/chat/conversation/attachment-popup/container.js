// @noflow
// import * as Types from '../../../constants/types/chat'
// import * as ChatGen from '../../../actions/chat-gen'
// import * as KBFSGen from '../../../actions/kbfs-gen'
// import RenderAttachmentPopup from './'
// import {compose, withState, withProps, connect, type TypedState} from '../../../util/container'
// import {lookupMessageProps} from '../../shared'
// import {type RouteProps} from '../../../route-tree/render-route'

// type AttachmentPopupRouteProps = RouteProps<
// {
// messageKey: Types.MessageKey,
// },
// {}
// >
// type OwnProps = AttachmentPopupRouteProps & {
// isZoomed: boolean,
// detailsPopupShowing: boolean,
// onToggleZoom: () => void,
// onOpenDetailsPopup: () => void,
// onCloseDetailsPopup: () => void,
// }

// const mapStateToProps = (state: TypedState, {routeProps, ...ownProps}: OwnProps) => {
// const messageKey = routeProps.get('messageKey')

// return {
// ...lookupMessageProps(state, messageKey),
// ...ownProps,
// you: state.config.username,
// }
// }

// const mapDispatchToProps = (dispatch: Dispatch, {navigateUp, navigateAppend}) => ({
// _onMessageAction: (message: Types.ServerMessage) =>
// dispatch(navigateAppend([{props: {message}, selected: 'messageAction'}])),
// deleteMessage: message => dispatch(ChatGen.createDeleteMessage({message})),
// onClose: () => dispatch(navigateUp()),
// onDownloadAttachment: (message: Types.AttachmentMessage) => {
// if (!message.messageID || !message.filename) {
// throw new Error('Cannot download attachment with missing messageID or filename')
// }
// dispatch(ChatGen.createSaveAttachment({messageKey: message.key}))
// },
// onOpenInFileUI: (path: string) => dispatch(KBFSGen.createOpenInFileUI({path})),
// })

// const mergeProps = (stateProps, dispatchProps) => {
// const {message, localMessageState} = stateProps
// return {
// ...stateProps,
// ...dispatchProps,
// onDeleteMessage: () => {
// dispatchProps.deleteMessage(message)
// dispatchProps.onClose()
// },
// onMessageAction: () => dispatchProps._onMessageAction(message),
// onDownloadAttachment: () => dispatchProps.onDownloadAttachment(message),
// onOpenInFileUI: () => dispatchProps.onOpenInFileUI(localMessageState.savedPath),
// }
// }

// export default compose(
// withState('isZoomed', 'setZoomed', false),
// withState('detailsPopupShowing', 'setDetailsPopupShowing', false),
// withProps(({setZoomed, setDetailsPopupShowing}) => ({
// onToggleZoom: () => setZoomed(zoomed => !zoomed),
// onOpenDetailsPopup: () => setDetailsPopupShowing(true),
// onCloseDetailsPopup: () => setDetailsPopupShowing(false),
// })),
// connect(mapStateToProps, mapDispatchToProps, mergeProps)
// )(RenderAttachmentPopup)
