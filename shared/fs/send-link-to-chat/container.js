// @flow
import * as I from 'immutable'
import {namedConnect} from '../../util/container'
import * as Types from '../../constants/types/fs'
import * as ChatTypes from '../../constants/types/chat2'
import * as ChatConstants from '../../constants/chat2'
import * as Constants from '../../constants/fs'
import * as FsGen from '../../actions/fs-gen'
import * as ChatGen from '../../actions/chat2-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import flags from '../../util/feature-flags'
import SendLinkToChat from '.'

type OwnProps = {
  routePath: I.List<string>,
}

const mapStateToProps = state => ({
  _sendLinkToChat: state.fs.sendLinkToChat,
  _username: state.config.username,
})

const mapDispatchToProps = (dispatch, ownProps) => ({
  _onSent: (conversationIDKey: ChatTypes.ConversationIDKey) => {
    dispatch(
      flags.useNewRouter
        ? RouteTreeGen.createClearModals()
        : RouteTreeGen.createPutActionIfOnPath({
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
  _selectChannel: (convID: ChatTypes.ConversationIDKey) =>
    dispatch(FsGen.createSetSendLinkToChatConvID({convID})),
  _send: (conversationIDKey: ChatTypes.ConversationIDKey, text: string) =>
    dispatch(FsGen.createTriggerSendLinkToChat()),
  onCancel: () =>
    dispatch(
      flags.useNewRouter
        ? RouteTreeGen.createClearModals()
        : RouteTreeGen.createPutActionIfOnPath({
            expectedPath: ownProps.routePath,
            otherAction: RouteTreeGen.createNavigateUp(),
          })
    ),
})

const mergeProps = (stateProps, {onCancel, _onSent, _send, _selectChannel}, ownProps) => {
  const pathTextToCopy = `${Constants.escapePath(stateProps._sendLinkToChat.path)} ` // append space
  const send = () => _send(stateProps._sendLinkToChat.convID, pathTextToCopy)
  const onSent = () => _onSent(stateProps._sendLinkToChat.convID)
  const sendLinkToChatState = stateProps._sendLinkToChat.state

  const elems = Types.getPathElements(stateProps._sendLinkToChat.path)
  if (elems.length < 3 || elems[1] === 'public') {
    // Not inside a TLF or a public TLF. Either way, we don't know which
    // conversation to send to, so just let user copy path.
    return {
      conversation: {type: 'none'},
      onCancel,
      onSent,
      pathTextToCopy,
      send,
      sendLinkToChatState,
    }
  }

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
      onSent,
      pathTextToCopy,
      send,
      sendLinkToChatState,
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
      onSent,
      pathTextToCopy,
      send,
      sendLinkToChatState,
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
      selectedChannel: ChatConstants.isValidConversationIDKey(stateProps._sendLinkToChat.convID)
        ? {
            channelname: (
              channels.find(({convID}) => convID === stateProps._sendLinkToChat.convID) || {channelname: ''}
            ).channelname,
            convID: stateProps._sendLinkToChat.convID,
          }
        : null,
      type: 'big-team',
    },
    onCancel,
    onSent,
    pathTextToCopy,
    send,
    sendLinkToChatState,
  }
}

export default namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'SendLinkToChat'
)(SendLinkToChat)
