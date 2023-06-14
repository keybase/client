import * as Container from '../../util/container'
import * as Constants from '../../constants/wallets'
import * as Types from '../../constants/types/wallets'
import * as ConfigConstants from '../../constants/config'
import * as Chat2Gen from '../../actions/chat2-gen'
import * as ProfileGen from '../../actions/profile-gen'
import * as WalletsGen from '../../actions/wallets-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import {getFullname} from '../../constants/users'
import openURL from '../../util/open-url'
import TransactionDetails, {type NotLoadingProps} from '.'

type OwnProps = {
  accountID: Types.AccountID
  paymentID: Types.PaymentID
}

export default (ownProps: OwnProps) => {
  const you = ConfigConstants.useConfigState(s => s.username)
  const accountID = ownProps.accountID ?? Types.noAccountID
  const paymentID = ownProps.paymentID ?? Types.noPaymentID
  const _transaction = Container.useSelector(state => Constants.getPayment(state, accountID, paymentID))
  const yourInfoAndCounterparty = Constants.paymentToYourInfoAndCounterparty(_transaction)
  // Transaction can briefly be empty when status changes
  const waiting = Container.useAnyWaiting(Constants.getRequestDetailsWaitingKey(paymentID))
  const loading = waiting || _transaction.id === Types.noPaymentID

  const counterpartyMeta = Container.useSelector(state =>
    yourInfoAndCounterparty.counterpartyType === 'keybaseUser'
      ? getFullname(
          state,
          yourInfoAndCounterparty.yourRole === 'senderOnly' ? _transaction.target : _transaction.source
        )
      : null
  )
  const transactionURL = _transaction.externalTxURL

  const dispatch = Container.useDispatch()
  const navigateUp = () => {
    dispatch(RouteTreeGen.createNavigateUp())
  }
  const onCancelPayment = () => {
    dispatch(WalletsGen.createCancelPayment({paymentID, showAccount: true}))
  }
  const onChat = (username: string) => {
    dispatch(Chat2Gen.createPreviewConversation({participants: [username], reason: 'transaction'}))
  }
  const onLoadPaymentDetail = () => {
    dispatch(WalletsGen.createLoadPaymentDetail({accountID, paymentID}))
  }
  const onShowProfile = (username: string) => {
    dispatch(ProfileGen.createShowUserProfile({username}))
  }
  const tx = _transaction
  if (loading) {
    const props = {
      loading: true,
      onBack: navigateUp,
      onLoadPaymentDetail: onLoadPaymentDetail,
    } as any as NotLoadingProps // TODO actually split this container so it doesn't do this. makes it much harder to type
    return <TransactionDetails {...props} />
  }
  const props = {
    ...yourInfoAndCounterparty,
    amountUser: tx.worth,
    amountXLM: tx.amountDescription,
    approxWorth: tx.worthAtSendTime,
    assetCode: tx.assetCode,
    counterpartyMeta: counterpartyMeta ?? undefined,
    feeChargedDescription: tx.feeChargedDescription,
    fromAirdrop: tx.fromAirdrop,
    isAdvanced: tx.isAdvanced,
    issuerAccountID: tx.issuerAccountID ?? undefined,
    issuerDescription: tx.issuerDescription,
    loading: false as const,
    memo: tx.note.stringValue(),
    onBack: navigateUp,
    onCancelPayment: tx.showCancel ? onCancelPayment : undefined,
    onCancelPaymentWaitingKey: Constants.cancelPaymentWaitingKey(tx.id),
    onChat: onChat,
    onLoadPaymentDetail: onLoadPaymentDetail,
    onShowProfile: onShowProfile,
    onViewTransaction: transactionURL ? () => openURL(transactionURL) : undefined,
    operations: tx.operations ?? undefined,
    pathIntermediate: tx.pathIntermediate,
    publicMemo: tx.publicMemo.stringValue(),
    recipientAccountID: tx.targetAccountID ? Types.stringToAccountID(tx.targetAccountID) : undefined,
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
    timestamp: tx.time ? new Date(tx.time) : undefined,
    transactionID: tx.txID,
    trustline: tx.trustline ?? undefined,
    you: you,
  }
  return <TransactionDetails {...props} />
}
