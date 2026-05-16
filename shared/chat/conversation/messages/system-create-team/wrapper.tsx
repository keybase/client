import {WrapperMessage, useWrapperMessageWithMessage, type Props} from '@/chat/conversation/messages/wrapper/wrapper'
import type SystemCreateTeamType from '@/chat/conversation/messages/system-create-team/container'

function SystemCreateTeam(p: Props) {
  const {ordinal, isCenteredHighlight} = p
  const wrapper = useWrapperMessageWithMessage(ordinal, isCenteredHighlight)
  const {message} = wrapper.messageData

  if (message.type !== 'systemCreateTeam') return null

  const {default: SystemCreateTeam} = require('./container') as {default: typeof SystemCreateTeamType}
  return (
    <WrapperMessage {...p} {...wrapper}>
      <SystemCreateTeam message={message} />
    </WrapperMessage>
  )
}

export default SystemCreateTeam
