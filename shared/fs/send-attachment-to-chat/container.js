// @flow
import * as ChatGen from '../../actions/chat2-gen'
import * as ChatConstants from '../../constants/chat2'
import * as Types from '../../constants/types/fs'
import {type RouteProps} from '../../route-tree/render-route'
import {namedConnect} from '../../util/container'
import SendAttachmentToChat from '.'

type OwnProps = RouteProps<{}, {}>

const mapStateToProps = state => ({
  _sendAttachmentToChat: state.fs.sendAttachmentToChat,
})

const mapDispatchToProps = (dispatch, ownProps) => ({
  _onSend: (conversationIDKey, path) => {
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
    dispatch(ownProps.navigateUp())
    dispatch(
      ChatGen.createSelectConversation({
        conversationIDKey,
        reason: 'files',
      })
    )
    dispatch(ChatGen.createNavigateToThread())
  },
  onCancel: () => dispatch(ownProps.navigateUp()),
})

const mergeProps = (stateProps, dispatchProps, ownPropps) => ({
  onCancel: dispatchProps.onCancel,
  onSend:
    stateProps._sendAttachmentToChat.convID === ChatConstants.noConversationIDKey
      ? null
      : () =>
          dispatchProps._onSend(
            stateProps._sendAttachmentToChat.convID,
            stateProps._sendAttachmentToChat.path
          ),
  path: stateProps._sendAttachmentToChat.path,
})

export default namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'SendAttachmentToChat'
)(SendAttachmentToChat)
