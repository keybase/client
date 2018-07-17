// @flow
import {connect, compose, type TypedState} from '../../util/container'
import {HeaderHoc} from '../../common-adapters'
import * as Constants from '../../constants/wallets'
import * as Types from '../../constants/types/wallets'
import * as StellarRPCTypes from '../../constants/types/rpc-stellar-gen'
import * as WalletsGen from '../../actions/wallets-gen'
import TransactionDetails from '.'

const mapStateToProps = (state: TypedState, ownProps) => ({
  _transaction: Constants.getPayment(
    state,
    ownProps.routeProps.get('accountID'),
    ownProps.routeProps.get('paymentID')
  ),
  _you: state.config.username,
})

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp}) => ({
  _onLoadPaymentDetail: (accountID: Types.AccountID, paymentID: StellarRPCTypes.PaymentID) =>
    dispatch(WalletsGen.createLoadPaymentDetail({accountID, paymentID})),
  navigateUp: () => dispatch(navigateUp()),
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
    memo: tx.note,
    onBack: () => dispatchProps.navigateUp(),
    onLoadPaymentDetail: () =>
      dispatchProps._onLoadPaymentDetail(ownProps.routeProps.get('accountID'), tx.id),
    publicMemo: tx.publicMemo,
    publicMemoType: tx.publicMemoType,
    timestamp: tx.time,
    title: 'Transaction Details',
    transactionID: tx.txID,
    yourRole,
  }
}

export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  HeaderHoc,
)(TransactionDetails)
