import * as Container from '../../util/container'
import * as Constants from '../../constants/wallets'
import * as Types from '../../constants/types/wallets'
import * as ProfileGen from '../../actions/profile-gen'
import * as WalletsGen from '../../actions/wallets-gen'
import {Transaction, ReadState} from '.'
import * as RouteTreeGen from '../../actions/route-tree-gen'

export type OwnProps = {
  accountID: Types.AccountID
  paymentID: Types.PaymentID
}

const mapStateToProps = (state: Container.TypedState, ownProps: OwnProps) => ({
  _oldestUnread: Constants.getOldestUnread(state, ownProps.accountID),
  _transaction: Constants.getPayment(state, ownProps.accountID, ownProps.paymentID),
  _you: state.config.username,
})

const mapDispatchToProps = (dispatch: Container.TypedDispatch) => ({
  _onCancelPayment: (paymentID: Types.PaymentID) => dispatch(WalletsGen.createCancelPayment({paymentID})),
  _onSelectTransaction: (paymentID: Types.PaymentID, accountID: Types.AccountID) =>
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [
          {
            props: {accountID, paymentID},
            selected: 'transactionDetails',
          },
        ],
      })
    ),
  onShowProfile: (username: string) => dispatch(ProfileGen.createShowUserProfile({username})),
})

export default Container.connect(
  mapStateToProps,
  mapDispatchToProps,
  (stateProps, dispatchProps, ownProps: OwnProps) => {
    const tx = stateProps._transaction
    const {yourRole, counterparty, counterpartyType} = Constants.paymentToYourInfoAndCounterparty(tx)
    const memo = tx.note.stringValue()

    let readState: ReadState
    if (tx.unread) {
      readState = tx.id === stateProps._oldestUnread ? ('oldestUnread' as const) : ('unread' as const)
    } else {
      readState = 'read' as const
    }

    const isRelayRecipient = tx.statusSimplified === 'claimable' && yourRole === 'receiverOnly'

    return {
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
      onCancelPayment:
        tx.showCancel && !isRelayRecipient ? () => dispatchProps._onCancelPayment(tx.id) : undefined,
      onCancelPaymentWaitingKey: Constants.cancelPaymentWaitingKey(tx.id),
      onSelectTransaction: isRelayRecipient
        ? undefined
        : () => dispatchProps._onSelectTransaction(ownProps.paymentID, ownProps.accountID),
      onShowProfile: dispatchProps.onShowProfile,
      readState,
      selectableText: false,
      sourceAmount: tx.sourceAmount,
      sourceAsset: tx.sourceAsset,
      status: tx.statusSimplified,
      statusDetail: tx.statusDetail,
      summaryAdvanced: tx.summaryAdvanced,
      timestamp: tx.time ? new Date(tx.time) : null,
      trustline: tx.trustline || undefined,
      unread: tx.unread,
      yourRole,
    }
  }
)(Transaction)
