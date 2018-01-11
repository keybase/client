// @flow
import * as Constants from '../../../../constants/chat2'
import * as Types from '../../../../constants/types/chat2'
import ChannelPreview from '.'
import {connect, type TypedState, type Dispatch} from '../../../../util/container'

const mapStateToProps = (state: TypedState) => {
  const _selectedConversationIDKey = Constants.getSelectedConversation(state)
  const _meta = Constants.getMeta(state, _selectedConversationIDKey)
  return {
    _meta,
    _selectedConversationIDKey,
  }
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
  _onJoinChannel: (selectedConversation: Types.ConversationIDKey) => {
    // dispatch(ChatGen.createJoinConversation({conversationIDKey: selectedConversation})),
  },
  _onLeaveChannel: (selectedConversation: Types.ConversationIDKey, teamname: string) => {
    // dispatch(ChatGen.createLeaveConversation({conversationIDKey: selectedConversation}))
    // dispatch(RouteTree.navigateUp())
    // if (ownProps.previousPath) {
    // dispatch(RouteTree.navigateTo(ownProps.previousPath))
    // }
  },
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  channelname: stateProps._meta.channelname,
  onJoinChannel: () => dispatchProps._onJoinChannel(stateProps._selectedConversationIDKey),
  onLeaveChannel: () =>
    dispatchProps._onLeaveChannel(stateProps._selectedConversationIDKey, stateProps._meta.teamname),
})

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(ChannelPreview)
