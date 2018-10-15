// @flow
import {connect, compose} from '../../util/container'
import {HeaderHoc} from '../../common-adapters'
import * as Constants from '../../constants/wallets'
import * as Types from '../../constants/types/wallets'
import * as ProfileGen from '../../actions/profile-gen'
import * as WalletsGen from '../../actions/wallets-gen'
import {getFullname} from '../../constants/users'
import TransactionDetails from '.'

const mapStateToProps = (state, ownProps) => {
  const you = state.config.username || ''
  const accountID = ownProps.routeProps.get('accountID')
  const paymentID = ownProps.routeProps.get('paymentID')
  const _transaction = Constants.getPayment(state, accountID, paymentID)
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

const mapDispatchToProps = (dispatch, {navigateUp, routeProps}) => ({
  navigateUp: () => dispatch(navigateUp()),
  onCancelPayment: () => dispatch(WalletsGen.createCancelPayment({paymentID: routeProps.get('paymentID')})),
  onLoadPaymentDetail: () =>
    dispatch(
      WalletsGen.createLoadPaymentDetail({
        accountID: routeProps.get('accountID'),
        paymentID: routeProps.get('paymentID'),
      })
    ),
  onShowProfile: (username: string) => dispatch(ProfileGen.createShowUserProfile({username})),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => {
  const tx = stateProps._transaction
  if (!tx.txID || !tx.sourceAccountID) {
    return {
      loading: true,
      onBack: dispatchProps.navigateUp,
      onLoadPaymentDetail: dispatchProps.onLoadPaymentDetail,
      title: 'Transaction details',
    }
  }
  return {
    ...stateProps.yourRoleAndCounterparty,
    amountUser: tx.worth,
    amountXLM: tx.amountDescription,
    counterpartyMeta: stateProps.counterpartyMeta,
    loading: false,
    memo: tx.note.stringValue(),
    onBack: dispatchProps.navigateUp,
    onCancelPayment: tx.statusSimplified === 'cancelable' ? dispatchProps.onCancelPayment : null,
    onCancelPaymentWaitingKey: Constants.cancelPaymentWaitingKey(tx.id),
    onLoadPaymentDetail: dispatchProps.onLoadPaymentDetail,
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
    yourAccountName: tx.sourceType === 'ownaccount' ? tx.source : '',
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
