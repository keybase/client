import {WrapperMessage, useWrapperMessageWithMessage, type Props} from '../wrapper/wrapper'
import type PinType from '.'

function WrapperPin(p: Props) {
  const {ordinal, isCenteredHighlight} = p
  const wrapper = useWrapperMessageWithMessage(ordinal, isCenteredHighlight)
  const {message} = wrapper.messageData

  if (message.type !== 'pin') return null

  const {default: PinComponent} = require('.') as {default: typeof PinType}
  return (
    <WrapperMessage {...p} {...wrapper}>
      <PinComponent messageID={message.pinnedMessageID} />
    </WrapperMessage>
  )
}

export default WrapperPin
