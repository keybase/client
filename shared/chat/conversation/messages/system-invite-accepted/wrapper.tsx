import {WrapperMessage, useWrapperMessageWithMessage, type Props} from '../wrapper/wrapper'
import SystemInviteAccepted from './container'

function WrapperSystemInvite(p: Props) {
  const {ordinal, isCenteredHighlight} = p
  const wrapper = useWrapperMessageWithMessage(ordinal, isCenteredHighlight)
  const {message} = wrapper.messageData

  if (message.type !== 'systemInviteAccepted') return null

  return (
    <WrapperMessage {...p} {...wrapper}>
      <SystemInviteAccepted key="systemInviteAccepted" message={message} />
    </WrapperMessage>
  )
}

export default WrapperSystemInvite
