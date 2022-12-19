import * as Chat2Gen from '../../../../actions/chat2-gen'
import * as Constants from '../../../../constants/chat2'
import type * as Types from '../../../../constants/types/chat2'
import * as Container from '../../../../util/container'
import ChannelPreview from '.'

type OwnProps = {
  conversationIDKey: Types.ConversationIDKey
}

export default Container.connect(
  (state, {conversationIDKey}: OwnProps) => {
    const _meta = Constants.getMeta(state, conversationIDKey)
    return {
      _conversationIDKey: conversationIDKey,
      _meta,
    }
  },
  dispatch => ({
    _onJoinChannel: (conversationIDKey: Types.ConversationIDKey) =>
      dispatch(Chat2Gen.createJoinConversation({conversationIDKey})),
    _onLeaveChannel: (conversationIDKey: Types.ConversationIDKey) =>
      dispatch(Chat2Gen.createLeaveConversation({conversationIDKey})),
  }),
  (stateProps, dispatchProps, _: OwnProps) => ({
    channelname: stateProps._meta.channelname,
    onJoinChannel: () => dispatchProps._onJoinChannel(stateProps._conversationIDKey),
    onLeaveChannel: () => dispatchProps._onLeaveChannel(stateProps._conversationIDKey),
  })
)(ChannelPreview)
