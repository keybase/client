import {WrapperMessage, useWrapperMessageWithMessage, type Props} from '../wrapper/wrapper'
import SystemText from './container'

function WrapperSystemText(p: Props) {
  const {ordinal, isCenteredHighlight} = p
  const wrapper = useWrapperMessageWithMessage(ordinal, isCenteredHighlight)
  const {message} = wrapper.messageData

  if (message.type !== 'systemText') return null

  return (
    <WrapperMessage {...p} {...wrapper}>
      <SystemText text={message.text.stringValue()} />
    </WrapperMessage>
  )
}

export default WrapperSystemText
