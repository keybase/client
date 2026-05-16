import {WrapperMessage, useWrapperMessageWithMessage, type Props} from '@/chat/conversation/messages/wrapper/wrapper'
import type SystemLeftType from '@/chat/conversation/messages/system-left/container'

function SystemLeft(p: Props) {
  const {ordinal, isCenteredHighlight} = p
  const wrapper = useWrapperMessageWithMessage(ordinal, isCenteredHighlight)
  const {message} = wrapper.messageData

  if (message.type !== 'systemLeft') return null

  const {default: SystemLeft} = require('./container') as {default: typeof SystemLeftType}
  return (
    <WrapperMessage {...p} {...wrapper}>
      <SystemLeft />
    </WrapperMessage>
  )
}

export default SystemLeft
