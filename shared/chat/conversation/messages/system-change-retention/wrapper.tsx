import {WrapperMessage, useWrapperMessageWithMessage, type Props} from '@/chat/conversation/messages/wrapper/wrapper'
import type SystemChangeRetentionType from '@/chat/conversation/messages/system-change-retention/container'

function SystemChangeRetention(p: Props) {
  const {ordinal, isCenteredHighlight} = p
  const wrapper = useWrapperMessageWithMessage(ordinal, isCenteredHighlight)
  const {message} = wrapper.messageData

  if (message.type !== 'systemChangeRetention') return null

  const {default: SystemChangeRetention} = require('./container') as {
    default: typeof SystemChangeRetentionType
  }
  return (
    <WrapperMessage {...p} {...wrapper}>
      <SystemChangeRetention message={message} />
    </WrapperMessage>
  )
}

export default SystemChangeRetention
