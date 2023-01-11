import * as Container from '../../../util/container'
import * as React from 'react'
import PaymentStatus, {type Props} from '.'
import type * as WalletTypes from '../../../constants/types/wallets'
import {ConvoIDContext, OrdinalContext} from '../../conversation/messages/ids-context'

type OwnProps = {
  allowFontScaling?: boolean | null
  error?: string | null
  paymentID?: WalletTypes.PaymentID
  text: string
}

type Status = Props['status']
const reduceStatus = (status: string): Status => {
  switch (status) {
    case 'claimable':
      return 'claimable'
    case 'completed':
      return 'completed'
    case 'pending':
    case 'unknown':
      return 'pending'
    case 'error':
    case 'canceled':
    case 'none':
      return 'error'
    default:
      return 'pending'
  }
}

const PaymentStatusContainer = React.memo(function PaymentStatusContainer(p: OwnProps) {
  const {error, paymentID, text, allowFontScaling} = p
  const conversationIDKey = React.useContext(ConvoIDContext)
  const ordinal = React.useContext(OrdinalContext)
  const paymentInfo = Container.useSelector(state =>
    paymentID ? state.chat2.paymentStatusMap.get(paymentID) || null : null
  )
  const status = error ? 'error' : paymentInfo?.status ?? 'pending'

  const allowPopup = Container.useSelector(state => {
    const you = state.config.username
    const author = state.chat2.messageMap.get(conversationIDKey)?.get(ordinal)?.author
    return status === 'completed' || status === 'pending' || status === 'claimable' || author === you
  })

  // TODO remove
  const message = Container.useSelector(state => {
    return state.chat2.messageMap.get(conversationIDKey)?.get(ordinal)
  })

  if (message?.type !== 'text') return null

  const props = {
    allowFontScaling,
    allowPopup,
    errorDetail: error || paymentInfo?.statusDetail,
    isSendError: !!error,
    message,
    paymentID,
    status: reduceStatus(status),
    text,
  }
  return <PaymentStatus {...props} />
})
export default PaymentStatusContainer
