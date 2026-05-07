import {WrapperMessage, useWrapperMessageWithMessage, type Props} from '../wrapper/wrapper'
import type PaymentMessageType from './container'

function WrapperPayment(p: Props) {
  const {ordinal, isCenteredHighlight} = p
  const wrapper = useWrapperMessageWithMessage(ordinal, isCenteredHighlight)
  const {message} = wrapper.messageData

  if (message.type !== 'requestPayment' && message.type !== 'sendPayment') return null

  const {default: PaymentMessage} = require('./container') as {default: typeof PaymentMessageType}
  return (
    <WrapperMessage {...p} {...wrapper}>
      <PaymentMessage message={message} />
    </WrapperMessage>
  )
}

export default WrapperPayment
