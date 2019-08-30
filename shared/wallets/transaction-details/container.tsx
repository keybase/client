import * as Container from '../../util/container'
import * as Kb from '../../common-adapters'
import * as Constants from '../../constants/wallets'
import * as Types from '../../constants/types/wallets'
import * as Chat2Gen from '../../actions/chat2-gen'
import * as ProfileGen from '../../actions/profile-gen'
import * as WalletsGen from '../../actions/wallets-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import {getFullname} from '../../constants/users'
import openURL from '../../util/open-url'
import TransactionDetails from '.'
import {anyWaiting} from '../../constants/waiting'

type OwnProps = Container.RouteProps<{accountID: Types.AccountID; paymentID: Types.PaymentID}>

const mapStateToProps = (state, ownProps) => {
  const you = state.config.username || ''
  const accountID = Container.getRouteProps(ownProps, 'accountID', Types.noAccountID)
  const paymentID = Container.getRouteProps(ownProps, 'paymentID', Types.noPaymentID)
  const _transaction = Constants.getPayment(state, accountID, paymentID)
  const yourInfoAndCounterparty = Constants.paymentToYourInfoAndCounterparty(_transaction)
  // Transaction can briefly be empty when status changes
  const loading =
    anyWaiting(state, Constants.getRequestDetailsWaitingKey(paymentID)) ||
    _transaction.id === Types.noPaymentID
  return {
    _transaction,
    counterpartyMeta:
      yourInfoAndCounterparty.counterpartyType === 'keybaseUser'
        ? getFullname(
            state,
            yourInfoAndCounterparty.yourRole === 'senderOnly' ? _transaction.target : _transaction.source
          )
        : null,
    loading,
    transactionURL: _transaction.externalTxURL,
    you,
    yourInfoAndCounterparty,
  }
}

const mapDispatchToProps = (dispatch, ownProps) => ({
  navigateUp: () => dispatch(RouteTreeGen.createNavigateUp()),
  onCancelPayment: () =>
    dispatch(
      WalletsGen.createCancelPayment({
        paymentID: Container.getRouteProps(ownProps, 'paymentID', Types.noPaymentID),
        showAccount: true,
      })
    ),
  onChat: (username: string) =>
    dispatch(Chat2Gen.createPreviewConversation({participants: [username], reason: 'transaction'})),
  onLoadPaymentDetail: () =>
    dispatch(
      WalletsGen.createLoadPaymentDetail({
        accountID: Container.getRouteProps(ownProps, 'accountID', Types.noAccountID),
        paymentID: Container.getRouteProps(ownProps, 'paymentID', Types.noPaymentID),
      })
    ),
  onShowProfile: (username: string) => dispatch(ProfileGen.createShowUserProfile({username})),
})

const mergeProps = (stateProps, dispatchProps, _: OwnProps) => {
  const tx = stateProps._transaction
  if (stateProps.loading) {
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
    approxWorth: tx.worthAtSendTime,
    assetCode: tx.assetCode,
    counterpartyMeta: stateProps.counterpartyMeta,
    feeChargedDescription: tx.feeChargedDescription,
    fromAirdrop: tx.fromAirdrop,
    isAdvanced: tx.isAdvanced,
    issuerAccountID: tx.issuerAccountID,
    issuerDescription: tx.issuerDescription,
    loading: false,
    memo: tx.note.stringValue(),
    onBack: dispatchProps.navigateUp,
    onCancelPayment: tx.showCancel ? dispatchProps.onCancelPayment : null,
    onCancelPaymentWaitingKey: Constants.cancelPaymentWaitingKey(tx.id),
    onChat: dispatchProps.onChat,
    onLoadPaymentDetail: dispatchProps.onLoadPaymentDetail,
    onShowProfile: dispatchProps.onShowProfile,
    onViewTransaction: stateProps.transactionURL ? () => openURL(stateProps.transactionURL) : undefined,
    operations: tx.operations,
    pathIntermediate: tx.pathIntermediate.toArray().map(asset => asset.toObject()),
    publicMemo: tx.publicMemo.stringValue(),
    recipientAccountID: tx.targetAccountID ? Types.stringToAccountID(tx.targetAccountID) : null,
    selectableText: true,
    senderAccountID: Types.stringToAccountID(tx.sourceAccountID),
    sourceAmount: tx.sourceAmount,
    sourceAsset: tx.sourceAsset,
    sourceConvRate: tx.sourceConvRate,
    sourceIssuer: tx.sourceIssuer,
    sourceIssuerAccountID: tx.sourceIssuerAccountID,
    status: tx.statusSimplified,
    statusDetail: tx.statusDetail,
    summaryAdvanced: tx.summaryAdvanced,
    timestamp: tx.time ? new Date(tx.time) : null,
    title: 'Transaction details',
    transactionID: tx.txID,
    trustline: tx.trustline,
    you: stateProps.you,
  }
}

export default Container.compose(
  Container.connect(mapStateToProps, mapDispatchToProps, mergeProps),
  Kb.HeaderHoc
)(TransactionDetails)
