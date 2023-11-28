import * as C from '@/constants'
import ChannelPreview from '.'

const Container = () => {
  const meta = C.useChatContext(s => s.meta)
  const onJoinChannel = C.useChatContext(s => s.dispatch.joinConversation)
  const onLeaveChannel = C.useChatContext(s => s.dispatch.leaveConversation)
  const {channelname} = meta
  const props = {
    channelname,
    onJoinChannel,
    onLeaveChannel,
  }
  return <ChannelPreview {...props} />
}
export default Container
