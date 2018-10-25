// @flow
import {connect} from '../../util/container'
import * as Constants from '../../constants/wallets'
import * as Types from '../../constants/types/wallets'
import * as Chat2Gen from '../../actions/chat2-gen'
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
})

const mapDispatchToProps = dispatch => ({
  _onCancelPayment: (paymentID: Types.PaymentID) =>
    dispatch(WalletsGen.createCancelPayment({paymentID, showAccount: true})),
  _onSelectTransaction: (paymentID: string, accountID: Types.AccountID, status: Types.StatusSimplified) =>
    dispatch(
      navigateAppend([
        {
          props: {accountID, paymentID, status},
          selected: 'transactionDetails',
        },
      ])
    ),
  onChat: (username: string) =>
    dispatch(Chat2Gen.createPreviewConversation({participants: [username], reason: 'transaction'})),
  onShowProfile: (username: string) => dispatch(ProfileGen.createShowUserProfile({username})),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => {
  const tx = stateProps._transaction
  const {yourRole, counterparty, counterpartyType} = Constants.paymentToYourRoleAndCounterparty(tx)
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
      tx.statusSimplified === 'cancelable' ? () => dispatchProps._onCancelPayment(tx.id) : null,
    onCancelPaymentWaitingKey: Constants.cancelPaymentWaitingKey(tx.id),
    onChat: dispatchProps.onChat,
    onSelectTransaction: () =>
      dispatchProps._onSelectTransaction(ownProps.paymentID, ownProps.accountID, tx.statusSimplified),
    onShowProfile: dispatchProps.onShowProfile,
    readState,
    selectableText: false,
    status: tx.statusSimplified,
    statusDetail: tx.statusDetail,
    timestamp: tx.time ? new Date(tx.time) : null,
  }
}

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(Transaction)
