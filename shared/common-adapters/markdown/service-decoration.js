// @flow
import React from 'react'
import * as Types from '../../constants/types/chat2'
import * as RPCChatTypes from '../../constants/types/rpc-chat-gen'
import PaymentStatus from '../../chat/payments/status'

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
      return <PaymentStatus status="success" text="+1XLM@mikem" />
    default:
      return null
  }
}

export default ServiceDecoration
