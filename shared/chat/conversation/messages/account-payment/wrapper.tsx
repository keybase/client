import * as Chat from '@/stores/chat2'
import * as React from 'react'
import {WrapperMessage, useCommon, type Props} from '../wrapper/wrapper'
import type PaymentMessageType from './container'

const WrapperPayment = React.memo(function WrapperPayment(p: Props) {
  const {ordinal} = p
  const common = useCommon(ordinal)
  const message = Chat.useChatContext(s => s.messageMap.get(ordinal))

  if (message?.type !== 'requestPayment' && message?.type !== 'sendPayment') return null

  const {default: PaymentMessage} = require('./container') as {default: typeof PaymentMessageType}
  return (
    <WrapperMessage {...p} {...common}>
      <PaymentMessage message={message} />
    </WrapperMessage>
  )
})

export default WrapperPayment
