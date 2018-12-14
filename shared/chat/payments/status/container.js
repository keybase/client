// @flow
import * as Types from '../../../constants/types/chat2'
import * as WalletTypes from '../../../constants/types/wallets'
import {namedConnect} from '../../../util/container'
import PaymentStatus from '.'

type OwnProps = {|
  allowFontScaling?: ?boolean,
  error?: ?string,
  message: Types.Message,
  paymentID?: ?WalletTypes.PaymentID,
  text: string,
|}

const reduceStatus = status => {
  switch (status) {
    case 'completed':
      return 'completed'
    case 'pending':
    case 'claimable':
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

const mapStateToProps = (state, ownProps: OwnProps) => {
  const {error, paymentID, message, text} = ownProps
  const status =
    paymentID && !error
      ? state.chat2.getIn(['paymentStatusMap', paymentID], null)?.status || 'pending'
      : 'error'
  return {
    allowFontScaling: ownProps.allowFontScaling,
    message,
    paymentID,
    status: reduceStatus(status),
    text,
  }
}

export default namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  (d, o) => ({}),
  (s, d, o) => ({...o, ...s, ...d}),
  'PaymentStatus'
)(PaymentStatus)
