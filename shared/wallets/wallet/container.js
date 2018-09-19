// @flow
import {connect, type TypedState} from '../../util/container'
import * as Constants from '../../constants/wallets'
import Wallet from '.'

const mapStateToProps = (state: TypedState) => ({
  accountID: Constants.getSelectedAccount(state),
  assets: Constants.getAssets(state),
  payments: Constants.getPayments(state),
  pending: Constants.getPendingPayments(state),
})

const mapDispatchToProps = (dispatch, {navigateAppend}) => ({
  navigateAppend,
})

const mergeProps = (stateProps, dispatchProps) => {
  const sections = []
  // layout is
  // 1. header (TODO: not included in list yet)
  // 2. assets header and list of assets
  // 3. transactions header and transactions
  // Formatted in a SectionList
  const assets = stateProps.assets.count()
    ? stateProps.assets.map((a, index) => index).toArray()
    : ['pending']
  sections.push({data: assets, title: 'Your assets'})
  const completed = stateProps.payments.map(p => ({paymentID: p.id, status: p.statusSimplified})).toArray()
  const pending = stateProps.pending.map(p => ({paymentID: p.id, status: p.statusSimplified})).toArray()

  if (pending.length > 0) {
    sections.push({data: pending, title: 'Pending'})
  }

  if (completed.length === 0) {
    sections.push({data: ['historyPlaceholder'], title: 'History'})
  } else {
    sections.push({data: completed, title: 'History'})
  }

  return {
    accountID: stateProps.accountID,
    navigateAppend: dispatchProps.navigateAppend,
    sections,
  }
}

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(Wallet)
