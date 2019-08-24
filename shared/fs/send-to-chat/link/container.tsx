import * as Container from '../../../util/container'
import * as Types from '../../../constants/types/fs'
import * as ChatTypes from '../../../constants/types/chat2'
import * as ChatConstants from '../../../constants/chat2'
import * as Constants from '../../../constants/fs'
import * as FsGen from '../../../actions/fs-gen'
import * as ChatGen from '../../../actions/chat2-gen'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import SendLinkToChat, {Channel} from '.'

type OwnProps = {}

const mapStateToProps = (state: Container.TypedState) => ({
  _sendLinkToChat: state.fs.sendLinkToChat,
  _username: state.config.username,
})

const mapDispatchToProps = (dispatch: Container.TypedDispatch) => ({
  _onSent: (conversationIDKey: ChatTypes.ConversationIDKey) => {
    dispatch(RouteTreeGen.createClearModals())
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
  onCancel: () => dispatch(RouteTreeGen.createClearModals()),
  send: () => dispatch(FsGen.createTriggerSendLinkToChat()),
})

export default Container.namedConnect(
  mapStateToProps,
  mapDispatchToProps,
  (stateProps, {onCancel, _onSent, send, _selectChannel}, _: OwnProps) => {
    const pathTextToCopy = `${Constants.escapePath(stateProps._sendLinkToChat.path)} ` // append space
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
      } as const
    }

    if (elems[1] !== 'team') {
      // private/public TLF. Treat it as 1:1 or group chat.
      const usernames = Constants.splitTlfIntoUsernames(elems[2])
      return {
        conversation:
          usernames.length <= 2
            ? ({
                name:
                  usernames.length === 1
                    ? elems[2] /* self chat */
                    : usernames.filter(u => u !== stateProps._username).join(','),
                type: 'person',
              } as const)
            : ({
                name: usernames.filter(u => u !== stateProps._username).join(','),
                type: 'group',
              } as const),
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
        conversation: {name: elems[2], type: 'small-team'},
        onCancel,
        onSent,
        pathTextToCopy,
        send,
        sendLinkToChatState,
      } as const
    }

    // big team
    const channels = stateProps._sendLinkToChat.channels
      .reduce<Array<Channel>>((channels, channelname, convID) => [...channels, {channelname, convID}], [])
      .sort((a, b) => a.channelname.localeCompare(b.channelname, undefined, {sensitivity: 'base'}))

    return {
      conversation: {
        channels,
        name: elems[2],
        selectChannel: (convID: ChatTypes.ConversationIDKey) => _selectChannel(convID),
        selectedChannel: ChatConstants.isValidConversationIDKey(stateProps._sendLinkToChat.convID)
          ? {
              channelname: (
                channels.find(({convID}) => convID === stateProps._sendLinkToChat.convID) || {channelname: ''}
              ).channelname,
              convID: stateProps._sendLinkToChat.convID,
            }
          : null,
        type: 'big-team',
      } as const,
      onCancel,
      onSent,
      pathTextToCopy,
      send,
      sendLinkToChatState,
    }
  },
  'SendLinkToChat'
)(SendLinkToChat)
