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

const mapStateToProps = (state: TypedState, ownProps: OwnProps) => {
  console.warn('in mstp', ownProps, ownProps.paymentID)
  return {

  _transaction: Constants.getPayment(state, ownProps.accountID, ownProps.paymentID),
  _you: state.config.username,
  }
}
const mapDispatchToProps = (dispatch: Dispatch) => ({
  _onSelectTransaction: (paymentID: string, accountID: Types.AccountID) => {
    console.warn('in sel', paymentID)
    dispatch(navigateAppend([{
      props: {accountID, paymentID},
      selected: 'transactionDetails',
    }]))
}
})

const mergeProps = (stateProps, dispatchProps, ownProps) => {
  console.warn('ownProps', ownProps)
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
    onSelectTransaction: () => dispatchProps._onSelectTransaction(ownProps.paymentID, ownProps.accountID),
  }
}

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(Transaction)
