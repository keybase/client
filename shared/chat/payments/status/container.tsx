import * as ConfigConstants from '../../../constants/config'
import * as Constants from '../../../constants/chat2'
import * as React from 'react'
import PaymentStatus, {type Props} from '.'
import type * as WalletTypes from '../../../constants/types/wallets'
import {OrdinalContext} from '../../conversation/messages/ids-context'

type OwnProps = {
  allowFontScaling?: boolean
  error?: string
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
  const ordinal = React.useContext(OrdinalContext)
  const paymentInfo = Constants.useState(s => (paymentID ? s.paymentStatusMap.get(paymentID) : undefined))
  const status = error ? 'error' : paymentInfo?.status ?? 'pending'

  const you = ConfigConstants.useCurrentUserState(s => s.username)
  // TODO remove
  const message = Constants.useContext(s => s.messageMap.get(ordinal))
  const author = message?.author
  const allowPopup =
    status === 'completed' || status === 'pending' || status === 'claimable' || author === you
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
