// @flow
import {connect} from '../../util/container'
import * as Constants from '../../constants/wallets'
import * as Types from '../../constants/types/wallets'
import * as ProfileGen from '../../actions/profile-gen'
import * as WalletsGen from '../../actions/wallets-gen'
import Transaction from '.'
import {navigateAppend} from '../../actions/route-tree'

export type OwnProps = {
  accountID: Types.AccountID,
  paymentID: Types.PaymentID,
}

const mapStateToProps = (state, ownProps: OwnProps) => ({
  _oldestUnread: Constants.getOldestUnread(state, ownProps.accountID),
  _transaction: Constants.getPayment(state, ownProps.accountID, ownProps.paymentID),
  _you: state.config.username,
  _unread: Constants.isPaymentUnread(state, ownProps.accountID, ownProps.paymentID),
})

const mapDispatchToProps = dispatch => ({
  _onCancelPayment: (paymentID: Types.PaymentID) =>
    dispatch(WalletsGen.createCancelPayment({paymentID, showAccount: true})),
  _onSelectTransaction: (
    paymentID: Types.PaymentID,
    accountID: Types.AccountID,
    status: Types.StatusSimplified
  ) =>
    dispatch(
      navigateAppend([
        {
          props: {accountID, paymentID, status},
          selected: 'transactionDetails',
        },
      ])
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

  return {
    yourRole,
    counterparty,
    counterpartyType,
    amountUser: tx.worth,
    amountXLM: tx.amountDescription,
    memo,
    onCancelPayment:
      tx.showCancel ? () => dispatchProps._onCancelPayment(tx.id) : null,
    onCancelPaymentWaitingKey: Constants.cancelPaymentWaitingKey(tx.id),
    onSelectTransaction: () =>
      dispatchProps._onSelectTransaction(ownProps.paymentID, ownProps.accountID, tx.statusSimplified),
    onShowProfile: dispatchProps.onShowProfile,
    readState,
    selectableText: false,
    status: tx.statusSimplified,
    statusDetail: tx.statusDetail,
    timestamp: tx.time ? new Date(tx.time) : null,
    unread: stateProps._unread,
  }
}

export default connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(Transaction)
