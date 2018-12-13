// @flow
import * as Types from '../../../constants/types/chat2'
import * as WalletTypes from '../../../constants/types/wallets'
import * as Chat2Gen from '../../../actions/chat2-gen'
import {namedConnect} from '../../../util/container'
import PaymentStatus from '.'

type OwnProps = {|
  conversationIDKey: Types.ConversationIDKey,
  messageID: Types.MessageID,
  paymentID: WalletTypes.PaymentID,
  text: string,
|}

const mapStateToProps = (state, ownProps: OwnProps) => {
  const {conversationIDKey, messageID, paymentID, text} = ownProps
  const paymentInfo = state.chat2.paymentStatusMap.getIn([conversationIDKey, messageID, paymentID])
  return {
    status: paymentInfo.status,
    text,
  }
}

export default namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  (d, o) => {},
  (s, d, o) => ({...o, ...s, ...d}),
  'PaymentStatus'
)(PaymentStatus)
