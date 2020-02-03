import * as ChatGen from '../../../actions/chat2-gen'
import * as FsGen from '../../../actions/fs-gen'
import * as ChatTypes from '../../../constants/types/chat2'
import * as Types from '../../../constants/types/fs'
import * as Container from '../../../util/container'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import SendAttachmentToChat from '.'

// send can override, we do this for android share
type OwnProps = Container.RouteProps<{url: string}>

const mapDispatchToProps = (dispatch: Container.TypedDispatch) => ({
  _send: (conversationIDKey: ChatTypes.ConversationIDKey, path: Types.Path, title: string) => {
    dispatch(
      ChatGen.createAttachmentsUpload({
        conversationIDKey,
        paths: [{outboxID: null, path: Types.pathToString(path)}],
        titles: [title],
      })
    )
    dispatch(RouteTreeGen.createClearModals())
    dispatch(ChatGen.createSelectConversation({conversationIDKey, reason: 'files'}))
    dispatch(ChatGen.createNavigateToThread())
    dispatch(FsGen.createSentAttachmentToChat())
  },
  onCancel: () => dispatch(RouteTreeGen.createClearModals()),
  onSetTitle: (title: string) => dispatch(FsGen.createSetSendAttachmentToChatTitle({title})),
})

export default Container.namedConnect(
  (state: Container.TypedState) => ({_sendAttachmentToChat: state.fs.sendAttachmentToChat}),
  mapDispatchToProps,
  (stateProps, dispatchProps, ownProps: OwnProps) => {
    const {onCancel, onSetTitle} = dispatchProps
    const {_sendAttachmentToChat} = stateProps
    const url = Container.getRouteProps(ownProps, 'url', undefined)

    return {
      onCancel,
      onSetTitle,
      path: _sendAttachmentToChat.path,
      send: () =>
        dispatchProps._send(
          stateProps._sendAttachmentToChat.convID,
          url ?? stateProps._sendAttachmentToChat.path,
          stateProps._sendAttachmentToChat.title
        ),
      sendAttachmentToChatState: stateProps._sendAttachmentToChat.state,
      title: stateProps._sendAttachmentToChat.title,
    }
  },
  'SendAttachmentToChat'
)(SendAttachmentToChat)
