import {WrapperMessage, useWrapperMessageWithMessage, type Props} from '../wrapper/wrapper'
import SystemLeft from './container'

function WrapperSystemLeft(p: Props) {
  const {ordinal, isCenteredHighlight} = p
  const wrapper = useWrapperMessageWithMessage(ordinal, isCenteredHighlight)
  const {message} = wrapper.messageData

  if (message.type !== 'systemLeft') return null

  return (
    <WrapperMessage {...p} {...wrapper}>
      <SystemLeft />
    </WrapperMessage>
  )
}

export default WrapperSystemLeft
