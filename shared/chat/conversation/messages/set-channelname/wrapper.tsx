import {WrapperMessage, useWrapperMessageWithMessage, type Props} from '@/chat/conversation/messages/wrapper/wrapper'
import type SetChannelnameType from '@/chat/conversation/messages/set-channelname/container'

function WrapperSetChannelname(p: Props) {
  const {ordinal, isCenteredHighlight} = p
  const wrapper = useWrapperMessageWithMessage(ordinal, isCenteredHighlight)
  const {message} = wrapper.messageData

  if (message.type !== 'setChannelname') return null
  if (message.newChannelname === 'general') return null

  const {default: SetChannelnameComponent} = require('./container') as {default: typeof SetChannelnameType}
  return (
    <WrapperMessage {...p} {...wrapper}>
      <SetChannelnameComponent message={message} />
    </WrapperMessage>
  )
}

export default WrapperSetChannelname
