import * as C from '../../../../constants'
import * as React from 'react'
import {WrapperMessage, useCommon, type Props} from '../wrapper/wrapper'
import type PaymentMessageType from './container'

const WrapperPayment = React.memo(function WrapperPayment(p: Props) {
  const {ordinal} = p
  const common = useCommon(ordinal)
  const message = C.useChatContext(s => s.messageMap.get(ordinal))

  if (message?.type !== 'requestPayment' && message?.type !== 'sendPayment') return null

  const PaymentMessage = require('./container').default as typeof PaymentMessageType
  return (
    <WrapperMessage {...p} {...common}>
      <PaymentMessage message={message} />
    </WrapperMessage>
  )
})

export default WrapperPayment
