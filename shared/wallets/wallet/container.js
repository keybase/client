// @flow
import {connect, type TypedState} from '../../util/container'
import * as WalletsGen from '../../actions/wallets-gen'
import * as Constants from '../../constants/wallets'
import * as Types from '../../constants/types/wallets'
import {partition} from 'lodash-es'

import Wallet from '.'

const mapStateToProps = (state: TypedState) => {
  const accountID = Constants.getSelectedAccount(state)
  return {
    accountID,
    assets: Constants.getAssets(state),
    payments: Constants.getPayments(state),
    loadingMore: state.wallets.paymentLoadingMoreMap.get(accountID, false),
  }
}

const mapDispatchToProps = (dispatch, {navigateAppend, navigateUp}) => ({
  navigateAppend,
  navigateUp,
  _onLoadMore: accountID => dispatch(WalletsGen.createLoadMorePayments({accountID})),
  _onMarkAsRead: (accountID, mostRecentID) =>
    dispatch(WalletsGen.createMarkAsRead({accountID, mostRecentID})),
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

  // split into pending & history
  let mostRecentID
  const paymentsList = stateProps.payments && stateProps.payments.toList().toArray()
  const [_history, _pending] = partition(paymentsList, p => p.section === 'history')
  const mapItem = p => ({paymentID: p.id, timestamp: p.time})
  let history = _history.map(mapItem)
  const pending = _pending.map(mapItem)

  if (history.length) {
    history = sortAndStripTimestamps(history)
    mostRecentID = history[0].paymentID
  } else {
    history = [stateProps.payments ? 'noPayments' : 'notLoadedYet']
  }

  if (pending.length) {
    sections.push({
      data: sortAndStripTimestamps(pending),
      title: 'Pending',
    })
  }

  sections.push({
    data: history,
    title: 'History',
  })

  return {
    accountID: stateProps.accountID,
    loadingMore: stateProps.loadingMore,
    navigateAppend: dispatchProps.navigateAppend,
    navigateUp: dispatchProps.navigateUp,
    onLoadMore: () => dispatchProps._onLoadMore(stateProps.accountID),
    onMarkAsRead: () => {
      if (mostRecentID) {
        dispatchProps._onMarkAsRead(stateProps.accountID, mostRecentID)
      }
    },
    sections,
  }
}

const sortAndStripTimestamps = (p: Array<{paymentID: Types.PaymentID, timestamp: ?number}>) =>
  p
    .sort((p1, p2) => (p1.timestamp && p2.timestamp && p2.timestamp - p1.timestamp) || 0)
    .map(({paymentID}) => ({paymentID}))

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(Wallet)
