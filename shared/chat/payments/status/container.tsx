import * as Types from '../../../constants/types/chat2'
import * as WalletTypes from '../../../constants/types/wallets'
import {namedConnect} from '../../../util/container'
import PaymentStatus, {Props} from '.'

type OwnProps = {
  allowFontScaling?: boolean | null
  error?: string | null
  message: Types.MessageText
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

export default namedConnect(
  (state, ownProps: OwnProps) => {
    const {error, paymentID, message, text} = ownProps
    const paymentInfo = paymentID ? state.chat2.paymentStatusMap.get(paymentID) || null : null
    const status = error
      ? 'error' // Auto generated from flowToTs. Please clean me!
      : (paymentInfo === null || paymentInfo === undefined ? undefined : paymentInfo.status) || 'pending'
    return {
      allowFontScaling: ownProps.allowFontScaling,
      allowPopup:
        status === 'completed' ||
        status === 'pending' ||
        status === 'claimable' ||
        message.author === state.config.username,
      errorDetail:
        error || (paymentInfo === null || paymentInfo === undefined ? undefined : paymentInfo.statusDetail), // Auto generated from flowToTs. Please clean me!
      isSendError: !!error,
      message,
      paymentID,
      status: reduceStatus(status),
      text,
    }
  },
  () => ({}),
  (s, d, _: OwnProps) => ({...s, ...d}),
  'PaymentStatus'
)(PaymentStatus)
