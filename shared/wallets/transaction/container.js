// @flow
import {connect, type TypedState} from '../../util/container'
import * as Constants from '../../constants/wallets'
import * as Types from '../../constants/types/wallets'
import Transaction from '.'

export type OwnProps = {
  accountID: Types.AccountID,
  paymentID: string,
}

const mapStateToProps = (state: TypedState, ownProps: OwnProps) => ({
  _transaction: Constants.getPayment(state, ownProps.accountID, ownProps.paymentID),
  _you: state.config.username,
})

const mergeProps = stateProps => {
  const tx = stateProps._transaction
  const yourRole = Constants.paymentToYourRole(tx, stateProps._you || '')
  const counterpartyType = Constants.paymentToCounterpartyType(tx)
  return {
    timestamp: tx.time,
    delta: tx.delta,
    yourRole,
    counterparty: yourRole === 'sender' ? tx.target : tx.source,
    counterpartyType,
    amountUser: tx.worth,
    amountXLM: tx.amountDescription,
    memo: tx.note,
    large: counterpartyType !== 'wallet',
  }
}

export default connect(mapStateToProps, () => ({}), mergeProps)(Transaction)
