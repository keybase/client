import * as Chat2Gen from '../../../../actions/chat2-gen'
import * as Constants from '../../../../constants/chat2'
import type * as Types from '../../../../constants/types/chat2'
import * as Container from '../../../../util/container'
import ChannelPreview from '.'

type OwnProps = {
  conversationIDKey: Types.ConversationIDKey
}

export default (ownProps: OwnProps) => {
  const {conversationIDKey} = ownProps
  const meta = Container.useSelector(state => Constants.getMeta(state, conversationIDKey))
  const {channelname} = meta
  const dispatch = Container.useDispatch()
  const onJoinChannel = () => {
    dispatch(Chat2Gen.createJoinConversation({conversationIDKey}))
  }
  const onLeaveChannel = () => {
    dispatch(Chat2Gen.createLeaveConversation({conversationIDKey}))
  }
  const props = {
    channelname,
    onJoinChannel,
    onLeaveChannel,
  }
  return <ChannelPreview {...props} />
}
