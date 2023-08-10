import * as Constants from '../../../../constants/chat2'
import ChannelPreview from '.'

export default () => {
  const meta = Constants.useContext(s => s.meta)
  const onJoinChannel = Constants.useContext(s => s.dispatch.joinConversation)
  const onLeaveChannel = Constants.useContext(s => s.dispatch.leaveConversation)
  const {channelname} = meta
  const props = {
    channelname,
    onJoinChannel,
    onLeaveChannel,
  }
  return <ChannelPreview {...props} />
}
