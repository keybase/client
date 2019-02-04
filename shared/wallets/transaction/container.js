// @flow
import {connect} from '../../util/container'
import * as Constants from '../../constants/wallets'
import * as Types from '../../constants/types/wallets'
import * as ProfileGen from '../../actions/profile-gen'
import * as WalletsGen from '../../actions/wallets-gen'
import Transaction from '.'
import * as RouteTreeGen from '../../actions/route-tree-gen'

export type OwnProps = {
  accountID: Types.AccountID,
  paymentID: Types.PaymentID,
}

const mapStateToProps = (state, ownProps: OwnProps) => ({
  _oldestUnread: Constants.getOldestUnread(state, ownProps.accountID),
  _transaction: Constants.getPayment(state, ownProps.accountID, ownProps.paymentID),
  _unread: Constants.isPaymentUnread(state, ownProps.accountID, ownProps.paymentID),
  _you: state.config.username,
})

const mapDispatchToProps = dispatch => ({
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

const mergeProps = (stateProps, dispatchProps, ownProps) => {
  const tx = stateProps._transaction
  const {yourRole, counterparty, counterpartyType} = Constants.paymentToYourInfoAndCounterparty(tx)
  const memo = tx.note.stringValue()

  let readState
  if (tx.unread) {
    readState = tx.id === stateProps._oldestUnread ? 'oldestUnread' : 'unread'
  } else {
    readState = 'read'
  }

  const isRelayRecipient = tx.statusSimplified === 'claimable' && yourRole === 'receiverOnly'

  return {
    amountUser: tx.worth,
    amountXLM: tx.amountDescription,
    approxWorth: tx.worthAtSendTime,
    counterparty,
    counterpartyType,
    issuerDescription: tx.issuerDescription,
    memo,
    onCancelPayment: tx.showCancel && !isRelayRecipient ? () => dispatchProps._onCancelPayment(tx.id) : null,
    onCancelPaymentWaitingKey: Constants.cancelPaymentWaitingKey(tx.id),
    onSelectTransaction: isRelayRecipient
      ? null
      : () => dispatchProps._onSelectTransaction(ownProps.paymentID, ownProps.accountID),
    onShowProfile: dispatchProps.onShowProfile,
    readState,
    selectableText: false,
    status: tx.statusSimplified,
    statusDetail: tx.statusDetail,
    timestamp: tx.time ? new Date(tx.time) : null,
    unread: stateProps._unread,
    yourRole,
  }
}

export default connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(Transaction)
