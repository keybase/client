// @flow
import {connect, type TypedState} from '../../util/container'
import * as WalletsGen from '../../actions/wallets-gen'
import * as Constants from '../../constants/wallets'
import * as I from 'immutable'
import * as Types from '../../constants/types/wallets'
import memoize from 'memoize-one'

import Wallet from '.'

const mapStateToProps = (state: TypedState) => {
  const accountID = Constants.getSelectedAccount(state)
  return {
    accountID,
    assets: Constants.getAssets(state),
    payments: Constants.getPayments(state),
    pending: Constants.getPendingPayments(state),
    loadingMore: state.wallets.paymentLoadingMoreMap.get(accountID, false),
  }
}

const mapDispatchToProps = (dispatch, {navigateAppend, navigateUp}) => ({
  navigateAppend,
  navigateUp,
  _onLoadMore: accountID => dispatch(WalletsGen.createLoadMorePayments({accountID})),
})

const mergeProps = (stateProps, dispatchProps) => {
  const sections = []
  // layout is
  // 1. header (TODO: not included in list yet)
  // 2. assets header and list of assets
  // 3. transactions header and transactions
  // Formatted in a SectionList
  const assets =
    stateProps.assets.count() > 0 ? stateProps.assets.map((a, index) => index).toArray() : ['notLoadedYet']
  sections.push({data: assets, title: 'Your assets'})

  if (stateProps.pending && stateProps.pending.size > 0) {
    sections.push({
      data: stateProps.pending
        .toList()
        .map(p => ({paymentID: p.id, status: p.statusSimplified}))
        .toArray(),
      title: 'Pending',
    })
  }

  sections.push({
    data: paymentsFromState(stateProps.payments),
    title: 'History',
  })

  return {
    accountID: stateProps.accountID,
    loadingMore: stateProps.loadingMore,
    navigateAppend: dispatchProps.navigateAppend,
    navigateUp: dispatchProps.navigateUp,
    onLoadMore: () => dispatchProps._onLoadMore(stateProps.accountID),
    sections,
  }
}

const paymentsFromState = memoize((paymentsMap: ?I.Map<Types.PaymentID, Types.Payment>) => {
  if (!paymentsMap) {
    return ['notLoadedYet']
  }
  if (paymentsMap.size === 0) {
    return ['noPayments']
  }
  const payments = paymentsMap.toList()
  return payments // payments always have a time
    .sort((p1, p2) => (p2.time && p1.time && p2.time - p1.time) || 0)
    .map(p => ({paymentID: p.id, status: p.statusSimplified}))
    .toArray()
})

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(Wallet)
