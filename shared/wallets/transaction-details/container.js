// @flow
import {connect, compose, type TypedState} from '../../util/container'
import {HeaderHoc} from '../../common-adapters'
import * as Constants from '../../constants/wallets'
import * as Types from '../../constants/types/wallets'
import * as StellarRPCTypes from '../../constants/types/rpc-stellar-gen'
import * as WalletsGen from '../../actions/wallets-gen'
import {getFullname} from '../../constants/users'
import TransactionDetails from '.'

const mapStateToProps = (state: TypedState, ownProps) => {
  const you = state.config.username || ''
  const accountID = ownProps.routeProps.get('accountID')
  const paymentID = ownProps.routeProps.get('paymentID')
  const status = ownProps.routeProps.get('status')
  const _transaction =
    status === 'pending'
      ? Constants.getPendingPayment(state, accountID, paymentID)
      : Constants.getPayment(state, accountID, paymentID)
  const yourRole = Constants.paymentToYourRole(_transaction, you)
  const counterpartyType = Constants.paymentToCounterpartyType(_transaction)
  return {
    _transaction,
    counterpartyMeta:
      counterpartyType === 'keybaseUser'
        ? getFullname(state, yourRole === 'sender' ? _transaction.target : _transaction.source)
        : null,
    counterpartyType,
    you,
    yourRole,
  }
}

const mapDispatchToProps = (dispatch, {navigateUp}) => ({
  _onLoadPaymentDetail: (accountID: Types.AccountID, paymentID: StellarRPCTypes.PaymentID) =>
    dispatch(WalletsGen.createLoadPaymentDetail({accountID, paymentID})),
  navigateUp: () => dispatch(navigateUp()),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => {
  const tx = stateProps._transaction
  const {yourRole, counterpartyType} = stateProps
  return {
    amountUser: tx.worth,
    amountXLM: tx.amountDescription,
    counterparty: yourRole === 'sender' ? tx.target : tx.source,
    counterpartyMeta: stateProps.counterpartyMeta,
    counterpartyType,
    delta: tx.delta,
    memo: tx.note.stringValue(),
    onBack: dispatchProps.navigateUp,
    onLoadPaymentDetail: () =>
      dispatchProps._onLoadPaymentDetail(ownProps.routeProps.get('accountID'), tx.id),
    publicMemo: tx.publicMemo.stringValue(),
    recipientAccountID: tx.targetAccountID ? Types.stringToAccountID(tx.targetAccountID) : null,
    senderAccountID: Types.stringToAccountID(tx.sourceAccountID),
    status: tx.statusSimplified,
    statusDetail: tx.statusDetail,
    timestamp: new Date(tx.time),
    title: 'Transaction details',
    transactionID: tx.txID,
    yourRole,
    you: stateProps.you,
  }
}

export default compose(connect(mapStateToProps, mapDispatchToProps, mergeProps), HeaderHoc)(
  TransactionDetails
)
