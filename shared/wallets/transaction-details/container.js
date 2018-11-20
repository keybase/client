// @flow
import {connect, compose, type RouteProps} from '../../util/container'
import {HeaderHoc} from '../../common-adapters'
import * as Constants from '../../constants/wallets'
import * as Types from '../../constants/types/wallets'
import * as Chat2Gen from '../../actions/chat2-gen'
import * as ProfileGen from '../../actions/profile-gen'
import * as WalletsGen from '../../actions/wallets-gen'
import {getFullname} from '../../constants/users'
import TransactionDetails from '.'

type OwnProps = RouteProps<{accountID: Types.AccountID, paymentID: Types.PaymentID}, {}>

const mapStateToProps = (state, ownProps) => {
  const you = state.config.username || ''
  const accountID = ownProps.routeProps.get('accountID')
  const paymentID = ownProps.routeProps.get('paymentID')
  const _transaction = Constants.getPayment(state, accountID, paymentID)
  const yourInfoAndCounterparty = Constants.paymentToYourInfoAndCounterparty(_transaction)
  return {
    _transaction,
    counterpartyMeta:
      yourInfoAndCounterparty.counterpartyType === 'keybaseUser'
        ? getFullname(
            state,
            yourInfoAndCounterparty.yourRole === 'senderOnly' ? _transaction.target : _transaction.source
          )
        : null,
    you,
    yourInfoAndCounterparty,
  }
}

const mapDispatchToProps = (dispatch, {navigateUp, routeProps}) => ({
  navigateUp: () => dispatch(navigateUp()),
  onCancelPayment: () =>
    dispatch(WalletsGen.createCancelPayment({paymentID: routeProps.get('paymentID'), showAccount: true})),
  onLoadPaymentDetail: () =>
    dispatch(
      WalletsGen.createLoadPaymentDetail({
        accountID: routeProps.get('accountID'),
        paymentID: routeProps.get('paymentID'),
      })
    ),
  onChat: (username: string) =>
    dispatch(Chat2Gen.createPreviewConversation({participants: [username], reason: 'transaction'})),
  onShowProfile: (username: string) => dispatch(ProfileGen.createShowUserProfile({username})),
})

const mergeProps = (stateProps, dispatchProps) => {
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
    ...stateProps.yourInfoAndCounterparty,
    amountUser: tx.worth,
    amountXLM: tx.amountDescription,
    counterpartyMeta: stateProps.counterpartyMeta,
    loading: false,
    memo: tx.note.stringValue(),
    onBack: dispatchProps.navigateUp,
    onCancelPayment: tx.statusSimplified === 'cancelable' ? dispatchProps.onCancelPayment : null,
    onCancelPaymentWaitingKey: Constants.cancelPaymentWaitingKey(tx.id),
    onChat: dispatchProps.onChat,
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
  }
}

export default compose(
  connect<OwnProps, _, _, _, _>(
    mapStateToProps,
    mapDispatchToProps,
    mergeProps
  ),
  HeaderHoc
)(TransactionDetails)
