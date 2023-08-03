import * as React from 'react'
import * as Constants from '../../../../constants/chat2'
import {WrapperMessage, useCommon, type Props} from '../wrapper/wrapper'
import type PaymentMessageType from './container'

const WrapperPayment = React.memo(function WrapperPayment(p: Props) {
  const {ordinal} = p
  const common = useCommon(ordinal)
  const message = Constants.useContext(s => s.messageMap.get(ordinal))

  if (message?.type !== 'requestPayment' && message?.type !== 'sendPayment') return null

  const PaymentMessage = require('./container').default as typeof PaymentMessageType
  return (
    <WrapperMessage {...p} {...common}>
      <PaymentMessage message={message} />
    </WrapperMessage>
  )
})

export default WrapperPayment
