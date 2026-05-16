import {WrapperMessage, useWrapperMessageWithMessage, type Props} from '@/chat/conversation/messages/wrapper/wrapper'
import type SystemNewChannelType from '@/chat/conversation/messages/system-new-channel/container'

function SystemNewChannel(p: Props) {
  const {ordinal, isCenteredHighlight} = p
  const wrapper = useWrapperMessageWithMessage(ordinal, isCenteredHighlight)
  const {message} = wrapper.messageData

  if (message.type !== 'systemNewChannel') return null

  const {default: SystemNewChannel} = require('./container') as {default: typeof SystemNewChannelType}
  return (
    <WrapperMessage {...p} {...wrapper}>
      <SystemNewChannel message={message} />
    </WrapperMessage>
  )
}

export default SystemNewChannel
