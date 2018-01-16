// @flow
// import * as Types from '../../../../constants/types/chat'
// import * as ChatGen from '../../../../actions/chat-gen'
// import * as KBFSGen from '../../../../actions/kbfs-gen'
import Attachment from '.'
// import shallowEqual from 'shallowequal'
// import {List} from 'immutable'
// import {chatTab} from '../../../../constants/tabs'
import {compose, lifecycle, connect, type TypedState, type Dispatch} from '../../../../util/container'
// import {getPath} from '../../../../route-tree'
// import {lookupMessageProps} from '../../../shared'
// import {type OwnProps} from './container'

const mapStateToProps = (state: TypedState) => {
  return {}
  // return {
  // ...lookupMessageProps(state, messageKey),
  // // We derive the route path instead of having it passed in. We have to ensure its the path of this chat view and not any children so
  // // lets just extract the root path. This makes sure the openInPopup doesn't try and push multiple attachment views if you click quickly
  // routePath: getPath(state.routeTree.routeState, [chatTab]).slice(0, 2),
  // }
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
  // _onDownloadAttachment: messageKey => {
  // messageKey && dispatch(ChatGen.createSaveAttachment({messageKey}))
  // },
  // _onEnsurePreviewLoaded: (messageKey: Types.MessageKey) =>
  // dispatch(ChatGen.createLoadAttachmentPreview({messageKey})),
  // _onOpenInFileUI: (path: string) => dispatch(KBFSGen.createOpenInFileUI({path})),
  // _onOpenInPopup: (message: Types.AttachmentMessage, routePath: List<string>) =>
  // dispatch(ChatGen.createOpenAttachmentPopup({message, currentPath: routePath})),
})

const mergeProps = (stateProps, dispatchProps) => ({
  // ...stateProps,
  // ...dispatchProps,
  // measure,
  // onAction,
  // onEnsurePreviewLoaded: () => {
  // const {message, localMessageState} = stateProps
  // if (message && message.filename && !localMessageState.previewPath) {
  // setImmediate(() => dispatchProps._onEnsurePreviewLoaded(message.key))
  // }
  // },
  // onDownloadAttachment: () => {
  // dispatchProps._onDownloadAttachment(stateProps.message.key)
  // },
  // onOpenInFileUI: () => {
  // dispatchProps._onOpenInFileUI(stateProps.localMessageState.savedPath)
  // },
  // onOpenInPopup: () => {
  // dispatchProps._onOpenInPopup(stateProps.message, stateProps.routePath)
  // },
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  lifecycle({
    // componentDidMount: function() {
    // this.props.onEnsurePreviewLoaded()
    // },
    // componentDidUpdate: function(prevProps: Props) {
    // if (
    // this.props.measure &&
    // (this.props.message.failureDescription !== prevProps.message.failureDescription ||
    // this.props.localMessageState.previewPath !== prevProps.localMessageState.previewPath ||
    // !shallowEqual(this.props.message.previewSize !== prevProps.message.previewSize))
    // ) {
    // this.props.measure()
    // }
    // if (this.props.message.filename !== prevProps.message.filename) {
    // this.props.onEnsurePreviewLoaded()
    // }
    // },
  })
)(Attachment)
