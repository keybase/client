import * as React from 'react'
import * as Constants from '../../../../constants/chat2'
import * as Container from '../../../../util/container'
import {ConvoIDContext} from '../ids-context'
import {WrapperMessage, useCommon, type Props} from '../wrapper/wrapper'
import type PaymentMessageType from './container'

const WrapperPayment = React.memo(function WrapperPayment(p: Props) {
  const {ordinal} = p
  const conversationIDKey = React.useContext(ConvoIDContext)
  const common = useCommon(ordinal)
  const message = Container.useSelector(state => Constants.getMessage(state, conversationIDKey, ordinal))

  if (message?.type !== 'requestPayment' && message?.type !== 'sendPayment') return null

  const PaymentMessage = require('./container').default as typeof PaymentMessageType
  return (
    <WrapperMessage {...p} {...common}>
      <PaymentMessage message={message} />
    </WrapperMessage>
  )
})

export default WrapperPayment
