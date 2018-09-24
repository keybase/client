// @flow
import {connect, compose, type TypedState} from '../../util/container'
import {HeaderHoc} from '../../common-adapters'
import * as Constants from '../../constants/wallets'
import * as Types from '../../constants/types/wallets'
import * as StellarRPCTypes from '../../constants/types/rpc-stellar-gen'
import * as WalletsGen from '../../actions/wallets-gen'
import TransactionDetails from '.'

const mapStateToProps = (state: TypedState, ownProps) => {
  const accountID = ownProps.routeProps.get('accountID')
  const paymentID = ownProps.routeProps.get('paymentID')
  const status = ownProps.routeProps.get('status')
  return {
    _transaction:
      status === 'pending'
        ? Constants.getPendingPayment(state, accountID, paymentID)
        : Constants.getPayment(state, accountID, paymentID),
    _you: state.config.username || '',
  }
}

const mapDispatchToProps = (dispatch, {navigateUp}) => ({
  _onLoadPaymentDetail: (accountID: Types.AccountID, paymentID: StellarRPCTypes.PaymentID) =>
    dispatch(WalletsGen.createLoadPaymentDetail({accountID, paymentID})),
  navigateUp: () => dispatch(navigateUp()),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => {
  const tx = stateProps._transaction
  const yourRoleAndCounterparty = Constants.paymentToYourRoleAndCounterparty(tx)
  return {
    ...yourRoleAndCounterparty,
    amountUser: tx.worth,
    amountXLM: tx.amountDescription,
    memo: tx.note.stringValue(),
    onBack: dispatchProps.navigateUp,
    onLoadPaymentDetail: () =>
      dispatchProps._onLoadPaymentDetail(ownProps.routeProps.get('accountID'), tx.id),
    publicMemo: tx.publicMemo.stringValue(),
    status: tx.statusSimplified,
    statusDetail: tx.statusDetail,
    timestamp: new Date(tx.time),
    title: 'Transaction details',
    transactionID: tx.txID,
    you: stateProps._you,
  }
}

export default compose(connect(mapStateToProps, mapDispatchToProps, mergeProps), HeaderHoc)(
  TransactionDetails
)
