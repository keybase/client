// @flow
import {connect, type TypedState} from '../../util/container'
import * as Constants from '../../constants/wallets'
import * as Types from '../../constants/types/wallets'
import * as StellarRPCTypes from '../../constants/types/rpc-stellar-gen'
import * as ProfileGen from '../../actions/profile-gen'
import Transaction from '.'
import {navigateAppend} from '../../actions/route-tree'

export type OwnProps = {
  accountID: Types.AccountID,
  paymentID: StellarRPCTypes.PaymentID,
  status: Types.StatusSimplified,
}

const mapStateToProps = (state: TypedState, ownProps: OwnProps) => ({
  _transaction:
    ownProps.status === 'pending'
      ? Constants.getPendingPayment(state, ownProps.accountID, ownProps.paymentID)
      : Constants.getPayment(state, ownProps.accountID, ownProps.paymentID),
  _you: state.config.username,
})

const mapDispatchToProps = (dispatch: Dispatch) => ({
  _onSelectTransaction: (paymentID: string, accountID: Types.AccountID, status: Types.StatusSimplified) =>
    dispatch(
      navigateAppend([
        {
          props: {accountID, paymentID, status},
          selected: 'transactionDetails',
        },
      ])
    ),
  _onShowProfile: (username: string) => dispatch(ProfileGen.createShowUserProfile({username})),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => {
  const tx = stateProps._transaction
  const yourRoleAndCounterparty = Constants.paymentToYourRoleAndCounterparty(tx)
  return {
    ...yourRoleAndCounterparty,
    amountUser: tx.worth,
    amountXLM: tx.amountDescription,
    large: yourRoleAndCounterparty.counterpartyType !== 'wallet',
    memo: tx.note.stringValue(),
    // TODO -- waiting on CORE integration for these two
    onCancelPayment: undefined,
    onRetryPayment: undefined,
    onSelectTransaction: () =>
      dispatchProps._onSelectTransaction(ownProps.paymentID, ownProps.accountID, tx.statusSimplified),
    onShowProfile: dispatchProps._onShowProfile,
    selectableText: false,
    status: tx.statusSimplified,
    statusDetail: tx.statusDetail,
    timestamp: tx.time ? new Date(tx.time) : null,
  }
}

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(Transaction)
