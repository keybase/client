// @flow
import {connect, type TypedState} from '../../util/container'
import * as Constants from '../../constants/wallets'
import * as Types from '../../constants/types/wallets'
import * as WalletsGen from '../../actions/wallets-gen'
import TransactionDetails from '.'

const mapStateToProps = (state: TypedState, ownProps) => {
  console.warn('ownProps are', ownProps)
  const accountID = ownProps.routeProps.get('accountID')
  const paymentID = ownProps.routeProps.get('paymentID')
  console.warn(state, accountID, paymentID)
  return {
    _transaction: Constants.getPayment(state, accountID, paymentID),
    _you: state.config.username,
  }
}

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp}) => ({
  _onLoadPaymentDetail: (accountID: Types.AccountID, paymentID: string) =>
    dispatch(WalletsGen.createLoadPaymentDetail({accountID, paymentID})),
  navigateUp: () => dispatch(navigateUp()),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => {
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
    onLoadPaymentDetail: () =>
      dispatchProps._onLoadPaymentDetail(ownProps.routeProps.get('accountID'), tx.id),
    publicMemo: tx.publicMemo,
    publicMemoType: tx.publicMemoType,
    transactionID: tx.txID,
  }
}

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(TransactionDetails)
