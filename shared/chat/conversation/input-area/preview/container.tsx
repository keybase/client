import * as Chat2Gen from '../../../../actions/chat2-gen'
import * as Constants from '../../../../constants/chat2'
import * as Types from '../../../../constants/types/chat2'
import ChannelPreview from '.'
import {connect} from '../../../../util/container'

type OwnProps = {
  conversationIDKey: Types.ConversationIDKey
}

const mapStateToProps = (state, {conversationIDKey}) => {
  const _meta = Constants.getMeta(state, conversationIDKey)
  return {
    _conversationIDKey: conversationIDKey,
    _meta,
  }
}

const mapDispatchToProps = dispatch => ({
  _onJoinChannel: (conversationIDKey: Types.ConversationIDKey) =>
    dispatch(Chat2Gen.createJoinConversation({conversationIDKey})),
  _onLeaveChannel: (conversationIDKey: Types.ConversationIDKey) =>
    dispatch(Chat2Gen.createLeaveConversation({conversationIDKey})),
})

const mergeProps = (stateProps, dispatchProps, _: OwnProps) => ({
  channelname: stateProps._meta.channelname,
  onJoinChannel: () => dispatchProps._onJoinChannel(stateProps._conversationIDKey),
  onLeaveChannel: () => dispatchProps._onLeaveChannel(stateProps._conversationIDKey),
})

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(ChannelPreview)
