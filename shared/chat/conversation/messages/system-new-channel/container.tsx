import * as Container from '../../../../util/container'
import * as Constants from '../../../../constants/chat2'
import * as Types from '../../../../constants/types/chat2'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import * as RouteTreeGen from '../../../../actions/route-tree-gen'
import SystemNewChannel from '.'

type OwnProps = {
  message: Types.MessageSystemNewChannel
}

const Connected = Container.connect(
  (state, ownProps: OwnProps) => {
    const {channelname} = Constants.getMeta(state, ownProps.message.createdConvID)
    return {
      channelname,
      creator: ownProps.message.creator,
      you: state.config.username,
    }
  },
  (dispatch, ownProps: OwnProps) => ({
    _onViewChannel: (conversationIDKey: Types.ConversationIDKey) => {
      dispatch(RouteTreeGen.createNavigateUp())
      dispatch(Chat2Gen.createPreviewConversation({conversationIDKey, reason: 'messageLink'}))
    },
  }),
  (stateProps, dispatchProps, ownProps: OwnProps) => ({
    channelname: stateProps.channelname,
    creator: stateProps.creator,
    onViewChannel: () => dispatchProps._onViewChannel(ownProps.message.createdConvID),
    you: stateProps.you,
  })
)(SystemNewChannel)
export default Connected
