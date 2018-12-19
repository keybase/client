// @flow
import React from 'react'
import * as Types from '../../constants/types/chat2'
import * as WalletTypes from '../../constants/types/wallets'
import * as RPCChatTypes from '../../constants/types/rpc-chat-gen'
import PaymentStatus from '../../chat/payments/status/container'

export type Props = {
  json: string,
  onClick?: () => void,
  allowFontScaling?: ?boolean,
  message: Types.MessageText,
}

const ServiceDecoration = (props: Props) => {
  // Parse JSON to get the type of the decoration
  let parsed: RPCChatTypes.UITextDecoration
  try {
    parsed = JSON.parse(props.json)
  } catch (e) {
    return null
  }
  if (parsed.typ === RPCChatTypes.chatUiUITextDecorationTyp.payment && parsed.payment) {
    let paymentID: WalletTypes.PaymentID
    let error
    if (
      parsed.payment.result.resultTyp === RPCChatTypes.localTextPaymentResultTyp.sent &&
      parsed.payment.result.sent
    ) {
      paymentID = WalletTypes.rpcPaymentIDToPaymentID(parsed.payment.result.sent)
    } else if (
      parsed.payment.result.resultTyp === RPCChatTypes.localTextPaymentResultTyp.error &&
      parsed.payment.result.error
    ) {
      error = parsed.payment.result.error
    } else {
      error = 'unknown text decoration'
    }
    return (
      <PaymentStatus
        paymentID={paymentID}
        error={error}
        text={parsed.payment.paymentText}
        allowFontScaling={props.allowFontScaling}
        message={props.message}
      />
    )
  }
  return null
}

export default ServiceDecoration
