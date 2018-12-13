// @flow
import React from 'react'
import * as RPCChatTypes from '../../constants/types/rpc-chat-gen'
import PaymentStatus from '../../chat/payments/status/container'

export type Props = {
  json: string,
  onClick?: () => void,
  allowFontScaling?: ?boolean,
}

const ServiceDecoration = (props: Props) => {
  // Parse JSON to get the type of the decoration
  const parsed = JSON.parse(props.json)
  switch (parsed.typ) {
    case RPCChatTypes.chatUiUITextDecorationTyp.payment:
      let paymentID
      let error
      switch (parsed.payment.result.resultTyp) {
        case RPCChatTypes.localTextPaymentResultTyp.sent:
          paymentID = parsed.payment.result.sent
          break
        case RPCChatTypes.localTextPaymentResultTyp.error:
          error = parsed.payment.result.error
          break
      }
      return (
        <PaymentStatus
          paymentID={paymentID}
          error={error}
          text={parsed.payment.paymentText}
          allowFontScaling={props.allowFontScaling}
        />
      )
    default:
      return null
  }
}

export default ServiceDecoration
