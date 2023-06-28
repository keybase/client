import * as Container from '../../util/container'
import * as Constants from '../../constants/wallets'
import * as ProfileConstants from '../../constants/profile'
import type * as Types from '../../constants/types/wallets'
import * as WalletsGen from '../../actions/wallets-gen'
import {Transaction, type ReadState} from '.'
import * as RouteTreeGen from '../../actions/route-tree-gen'

export type OwnProps = {
  accountID: Types.AccountID
  paymentID: Types.PaymentID
}

export default (ownProps: OwnProps) => {
  const _oldestUnread = Container.useSelector(state => Constants.getOldestUnread(state, ownProps.accountID))
  const _transaction = Container.useSelector(state =>
    Constants.getPayment(state, ownProps.accountID, ownProps.paymentID)
  )
  const dispatch = Container.useDispatch()
  const _onCancelPayment = (paymentID: Types.PaymentID) => {
    dispatch(WalletsGen.createCancelPayment({paymentID}))
  }
  const _onSelectTransaction = (paymentID: Types.PaymentID, accountID: Types.AccountID) => {
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [
          {
            props: {accountID, paymentID},
            selected: 'transactionDetails',
          },
        ],
      })
    )
  }
  const showUserProfile = ProfileConstants.useState(s => s.dispatch.showUserProfile)
  const onShowProfile = showUserProfile

  const tx = _transaction
  const {yourRole, counterparty, counterpartyType} = Constants.paymentToYourInfoAndCounterparty(tx)
  const memo = tx.note.stringValue()

  let readState: ReadState
  if (tx.unread) {
    readState = tx.id === _oldestUnread ? ('oldestUnread' as const) : ('unread' as const)
  } else {
    readState = 'read' as const
  }

  const isRelayRecipient = tx.statusSimplified === 'claimable' && yourRole === 'receiverOnly'

  const props = {
    amountUser: tx.worth,
    amountXLM: tx.amountDescription,
    approxWorth: tx.worthAtSendTime,
    counterparty,
    counterpartyType,
    detailView: undefined,
    fromAirdrop: tx.fromAirdrop,
    isAdvanced: tx.isAdvanced,
    issuerDescription: tx.issuerDescription,
    memo,
    onCancelPayment: tx.showCancel && !isRelayRecipient ? () => _onCancelPayment(tx.id) : undefined,
    onCancelPaymentWaitingKey: Constants.cancelPaymentWaitingKey(tx.id),
    onSelectTransaction: isRelayRecipient
      ? undefined
      : () => _onSelectTransaction(ownProps.paymentID, ownProps.accountID),
    onShowProfile: onShowProfile,
    readState,
    selectableText: false,
    sourceAmount: tx.sourceAmount,
    sourceAsset: tx.sourceAsset,
    status: tx.statusSimplified,
    statusDetail: tx.statusDetail,
    summaryAdvanced: tx.summaryAdvanced,
    timestamp: tx.time ? new Date(tx.time) : undefined,
    trustline: tx.trustline || undefined,
    unread: tx.unread,
    yourRole,
  }

  return <Transaction {...props} />
}
