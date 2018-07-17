// @flow
import {connect, type TypedState} from '../../util/container'
import * as Constants from '../../constants/wallets'
import * as Types from '../../constants/types/wallets'
import Transaction from '.'
import {navigateAppend} from '../../actions/route-tree'

export type OwnProps = {
  accountID: Types.AccountID,
  paymentID: string,
}

const mapStateToProps = (state: TypedState, ownProps: OwnProps) => ({
  _transaction: Constants.getPayment(state, ownProps.accountID, ownProps.paymentID),
  _you: state.config.username,
})

const mapDispatchToProps = (dispatch: Dispatch) => ({
  _onSelectTransaction: (paymentID: string, accountID: Types.AccountID) =>
    dispatch(
      navigateAppend([
        {
          props: {accountID, paymentID},
          selected: 'transactionDetails',
        },
      ])
    ),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => {
  const tx = stateProps._transaction
  const yourRole = Constants.paymentToYourRole(tx, stateProps._you || '')
  const counterpartyType = Constants.paymentToCounterpartyType(tx)
  return {
    amountUser: tx.worth,
    amountXLM: tx.amountDescription,
    counterparty: yourRole === 'sender' ? tx.target : tx.source,
    counterpartyType,
    delta: tx.delta,
    large: counterpartyType !== 'wallet',
    memo: tx.note,
    onSelectTransaction: () => dispatchProps._onSelectTransaction(ownProps.paymentID, ownProps.accountID),
    timestamp: tx.time,
    yourRole,
  }
}

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(Transaction)
