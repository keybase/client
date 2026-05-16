import {WrapperMessage, useWrapperMessageWithMessage, type Props} from '@/chat/conversation/messages/wrapper/wrapper'
import type SystemInviteAcceptedType from '@/chat/conversation/messages/system-invite-accepted/container'

function WrapperSystemInvite(p: Props) {
  const {ordinal, isCenteredHighlight} = p
  const wrapper = useWrapperMessageWithMessage(ordinal, isCenteredHighlight)
  const {message} = wrapper.messageData

  if (message.type !== 'systemInviteAccepted') return null

  const {default: SystemInviteAccepted} = require('./container') as {default: typeof SystemInviteAcceptedType}
  return (
    <WrapperMessage {...p} {...wrapper}>
      <SystemInviteAccepted key="systemInviteAccepted" message={message} />
    </WrapperMessage>
  )
}

export default WrapperSystemInvite
