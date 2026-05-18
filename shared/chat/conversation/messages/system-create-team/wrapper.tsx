import {WrapperMessage, useWrapperMessageWithMessage, type Props} from '../wrapper/wrapper'
import SystemCreateTeam from './container'

function WrapperSystemCreateTeam(p: Props) {
  const {ordinal, isCenteredHighlight} = p
  const wrapper = useWrapperMessageWithMessage(ordinal, isCenteredHighlight)
  const {message} = wrapper.messageData

  if (message.type !== 'systemCreateTeam') return null

  return (
    <WrapperMessage {...p} {...wrapper}>
      <SystemCreateTeam message={message} />
    </WrapperMessage>
  )
}

export default WrapperSystemCreateTeam
