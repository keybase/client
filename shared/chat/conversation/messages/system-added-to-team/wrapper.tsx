import {WrapperMessage, useWrapperMessageWithMessage, type Props} from '@/chat/conversation/messages/wrapper/wrapper'
import type SystemAddedToTeamType from '@/chat/conversation/messages/system-added-to-team/container'

function SystemAddedToTeam(p: Props) {
  const {ordinal, isCenteredHighlight} = p
  const wrapper = useWrapperMessageWithMessage(ordinal, isCenteredHighlight)
  const {message} = wrapper.messageData

  if (message.type !== 'systemAddedToTeam') return null

  const {default: SystemAddedToTeam} = require('./container') as {default: typeof SystemAddedToTeamType}
  return (
    <WrapperMessage {...p} {...wrapper}>
      <SystemAddedToTeam message={message} />
    </WrapperMessage>
  )
}

export default SystemAddedToTeam
