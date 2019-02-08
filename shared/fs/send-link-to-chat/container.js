// @flow
import * as I from 'immutable'
import {namedConnect} from '../../util/container'
import * as Types from '../../constants/types/fs'
import * as ChatTypes from '../../constants/types/chat2'
import * as ChatConstants from '../../constants/chat2'
import * as Constants from '../../constants/fs'
import * as FsGen from '../../actions/fs-gen'
import * as ChatGen from '../../actions/chat2-gen'
import HiddenString from '../../util/hidden-string'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import SendLinkToChat from '.'

type OwnProps = {
  routePath: I.List<string>,
}

const mapStateToProps = state => ({
  _sendLinkToChat: state.fs.sendLinkToChat,
  _username: state.config.username,
})

const mapDispatchToProps = (dispatch, ownProps) => ({
  _selectChannel: (convID: ChatTypes.ConversationIDKey) =>
    dispatch(FsGen.createSetSendLinkToChatConvID({convID})),
  _send: (conversationIDKey: ChatTypes.ConversationIDKey, text: string) => {
    dispatch(ChatGen.createMessageSend({conversationIDKey, text: new HiddenString(text)}))
    dispatch(
      RouteTreeGen.createPutActionIfOnPath({
        expectedPath: ownProps.routePath,
        otherAction: RouteTreeGen.createNavigateUp(),
      })
    )
    dispatch(
      ChatGen.createSelectConversation({
        conversationIDKey,
        reason: 'files',
      })
    )
    dispatch(ChatGen.createNavigateToThread())
  },
  onCancel: () =>
    dispatch(
      RouteTreeGen.createPutActionIfOnPath({
        expectedPath: ownProps.routePath,
        otherAction: RouteTreeGen.createNavigateUp(),
      })
    ),
})

const mergeProps = (stateProps, {onCancel, _send, _selectChannel}, ownProps) => {
  const pathTextToCopy = `${Constants.escapePath(stateProps._sendLinkToChat.path)} ` // append space

  const elems = Types.getPathElements(stateProps._sendLinkToChat.path)
  if (elems.length < 3 || elems[1] === 'public') {
    // Not inside a TLF or a public TLF. Either way, we don't know which
    // conversation to send to, so just let user copy path.
    return {
      conversation: {type: 'none'},
      onCancel,
      pathTextToCopy,
      send: null,
    }
  }

  const send = ChatConstants.isValidConversationIDKey(stateProps._sendLinkToChat.convID)
    ? () => _send(stateProps._sendLinkToChat.convID, pathTextToCopy)
    : null

  if (elems[1] !== 'team') {
    // private/public TLF. Treat it as 1:1 or group chat.
    const usernames = Constants.splitTlfIntoUsernames(elems[2])
    return {
      conversation:
        usernames.length <= 2
          ? {
              name:
                usernames.length === 1
                  ? elems[2] /* self chat */
                  : usernames.filter(u => u !== stateProps._username).join(','),
              type: 'person',
            }
          : {
              name: usernames.filter(u => u !== stateProps._username).join(','),
              type: 'group',
            },
      onCancel,
      pathTextToCopy,
      send,
    }
  }

  if (stateProps._sendLinkToChat.channels.size < 2) {
    // small team
    return {
      conversation: {
        name: elems[2],
        type: 'small-team',
      },
      onCancel,
      pathTextToCopy,
      send,
    }
  }

  // big team

  const channels = stateProps._sendLinkToChat.channels.reduce(
    (channels, channelname, convID) => [
      ...channels,
      {
        channelname,
        convID,
      },
    ],
    []
  )

  return {
    conversation: {
      channels,
      name: elems[2],
      selectChannel: convID => _selectChannel(convID),
      selectedChannel:
        stateProps._sendLinkToChat.convID === ChatConstants.noConversationIDKey
          ? null
          : {
              channelname: (
                channels.find(({convID}) => convID === stateProps._sendLinkToChat.convID) || {channelname: ''}
              ).channelname,
              convID: stateProps._sendLinkToChat.convID,
            },
      type: 'big-team',
    },
    onCancel,
    pathTextToCopy,
    send,
  }
}

export default namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'SendLinkToChat'
)(SendLinkToChat)
