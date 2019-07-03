import * as ChatGen from '../../../actions/chat2-gen'
import * as FsGen from '../../../actions/fs-gen'
import * as Types from '../../../constants/types/fs'
import {RouteProps} from '../../../route-tree/render-route'
import {namedConnect} from '../../../util/container'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import SendAttachmentToChat from '.'

type OwnProps = RouteProps<{}, {}>

const mapStateToProps = state => ({
  _sendAttachmentToChat: state.fs.sendAttachmentToChat,
})

const mapDispatchToProps = (dispatch, ownProps) => ({
  _send: (conversationIDKey, path, title) => {
    dispatch(
      ChatGen.createAttachmentsUpload({
        conversationIDKey,
        paths: [
          {
            outboxID: null,
            path: Types.pathToString(path),
          },
        ],
        titles: [title],
      })
    )
    dispatch(RouteTreeGen.createClearModals())
    dispatch(
      ChatGen.createSelectConversation({
        conversationIDKey,
        reason: 'files',
      })
    )
    dispatch(ChatGen.createNavigateToThread())
    dispatch(FsGen.createSentAttachmentToChat())
  },
  onCancel: () => dispatch(RouteTreeGen.createClearModals()),
  onSetTitle: (title: string) => dispatch(FsGen.createSetSendAttachmentToChatTitle({title})),
})

const mergeProps = (stateProps, dispatchProps, ownPropps) => ({
  onCancel: dispatchProps.onCancel,
  onSetTitle: dispatchProps.onSetTitle,
  path: stateProps._sendAttachmentToChat.path,
  send: () =>
    dispatchProps._send(
      stateProps._sendAttachmentToChat.convID,
      stateProps._sendAttachmentToChat.path,
      stateProps._sendAttachmentToChat.title
    ),
  sendAttachmentToChatState: stateProps._sendAttachmentToChat.state,
  title: stateProps._sendAttachmentToChat.title,
})

export default namedConnect(mapStateToProps, mapDispatchToProps, mergeProps, 'SendAttachmentToChat')(
  SendAttachmentToChat
)
