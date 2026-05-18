import {WrapperMessage, useWrapperMessageWithMessage, type Props} from '../wrapper/wrapper'
import SystemJoined from './container'

function WrapperSystemJoined(p: Props) {
  const {ordinal, isCenteredHighlight} = p
  const wrapper = useWrapperMessageWithMessage(ordinal, isCenteredHighlight)
  const {message} = wrapper.messageData

  if (message.type !== 'systemJoined') return null

  return (
    <WrapperMessage {...p} {...wrapper}>
      <SystemJoined message={message} />
    </WrapperMessage>
  )
}

export default WrapperSystemJoined
