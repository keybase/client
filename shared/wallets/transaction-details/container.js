// @flow
import {connect, compose, type TypedState} from '../../util/container'
import {HeaderHoc} from '../../common-adapters'
import * as Constants from '../../constants/wallets'
import * as Types from '../../constants/types/wallets'
import * as StellarRPCTypes from '../../constants/types/rpc-stellar-gen'
import * as ProfileGen from '../../actions/profile-gen'
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
  const yourRoleAndCounterparty = Constants.paymentToYourRoleAndCounterparty(_transaction)
  return {
    _transaction,
    counterpartyMeta:
      yourRoleAndCounterparty.counterpartyType === 'keybaseUser'
        ? getFullname(
            state,
            yourRoleAndCounterparty.yourRole === 'senderOnly' ? _transaction.target : _transaction.source
          )
        : null,
    you,
    yourRoleAndCounterparty,
  }
}

const mapDispatchToProps = (dispatch, {navigateUp}) => ({
  _onLoadPaymentDetail: (accountID: Types.AccountID, paymentID: StellarRPCTypes.PaymentID) =>
    dispatch(WalletsGen.createLoadPaymentDetail({accountID, paymentID})),
  navigateUp: () => dispatch(navigateUp()),
  onShowProfile: (username: string) => dispatch(ProfileGen.createShowUserProfile({username})),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => {
  const tx = stateProps._transaction
  return {
    ...stateProps.yourRoleAndCounterparty,
    amountUser: tx.worth,
    amountXLM: tx.amountDescription,
    counterpartyMeta: stateProps.counterpartyMeta,
    memo: tx.note.stringValue(),
    onBack: dispatchProps.navigateUp,
    onLoadPaymentDetail: () =>
      dispatchProps._onLoadPaymentDetail(ownProps.routeProps.get('accountID'), tx.id),
    onShowProfile: dispatchProps.onShowProfile,
    publicMemo: tx.publicMemo.stringValue(),
    recipientAccountID: tx.targetAccountID ? Types.stringToAccountID(tx.targetAccountID) : null,
    selectableText: true,
    senderAccountID: Types.stringToAccountID(tx.sourceAccountID),
    status: tx.statusSimplified,
    statusDetail: tx.statusDetail,
    timestamp: tx.time ? new Date(tx.time) : null,
    title: 'Transaction details',
    transactionID: tx.txID,
    you: stateProps.you,
  }
}

export default compose(
  connect(
    mapStateToProps,
    mapDispatchToProps,
    mergeProps
  ),
  HeaderHoc
)(TransactionDetails)
