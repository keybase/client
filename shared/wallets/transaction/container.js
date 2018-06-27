// @flow
import {connect, type TypedState} from '../../util/container'
import * as Constants from '../../constants/wallets'
import * as Types from '../../constants/types/wallets'
import Transaction from '.'

export type OwnProps = {
  accountID: Types.AccountID,
  paymentID: string,
}

const mapStateToProps = (state: TypedState, ownProps: OwnProps) => {
  const payment = Constants.getPayment(state, ownProps.accountID, ownProps.paymentID)
  const you = state.config.username
  const yourRole = payment.source === you ? 'sender' : 'receiver'
  return {
    timestamp: payment.time,
    yourRole,
    counterparty: yourRole === 'sender' ? payment.target : payment.source,
    counterpartyType:
      yourRole === 'sender'
        ? Constants.paymentTypeToPartyType[payment.targetType]
        : Constants.paymentTypeToPartyType[payment.sourceType],
    amountUser: payment.worth,
    amountXLM: payment.amountDescription,
    memo: payment.note,
    large: false,
  }
}

export default connect(mapStateToProps)(Transaction)
