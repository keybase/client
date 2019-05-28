// @flow
import * as ChatGen from '../../../actions/chat2-gen'
import * as FsGen from '../../../actions/fs-gen'
import * as Types from '../../../constants/types/fs'
import {type RouteProps} from '../../../route-tree/render-route'
import {namedConnect} from '../../../util/container'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import SendAttachmentToChat from '.'

type OwnProps = RouteProps<{}, {}>

const mapStateToProps = state => ({
  _sendAttachmentToChat: state.fs.sendAttachmentToChat,
})

const mapDispatchToProps = (dispatch, ownProps) => ({
  _send: (conversationIDKey, path) => {
    dispatch(
      ChatGen.createAttachmentsUpload({
        conversationIDKey,
        paths: [
          {
            outboxID: null,
            path: Types.pathToString(path),
          },
        ],
        titles: [Types.getPathName(path)],
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
})

const mergeProps = (stateProps, dispatchProps, ownPropps) => ({
  onCancel: dispatchProps.onCancel,
  path: stateProps._sendAttachmentToChat.path,
  send: () =>
    dispatchProps._send(stateProps._sendAttachmentToChat.convID, stateProps._sendAttachmentToChat.path),
  sendAttachmentToChatState: stateProps._sendAttachmentToChat.state,
})

export default namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'SendAttachmentToChat'
)(SendAttachmentToChat)
