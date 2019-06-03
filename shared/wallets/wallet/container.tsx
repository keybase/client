import * as React from 'react'
import {connect, isMobile} from '../../util/container'
import * as WalletsGen from '../../actions/wallets-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Constants from '../../constants/wallets'
import * as Types from '../../constants/types/wallets'
import Onboarding from '../onboarding/container'
import {partition} from 'lodash-es'

import Wallet, {Props} from '.'

type OwnProps = {}

const mapStateToProps = state => {
  const accountID = Constants.getSelectedAccount(state)
  return {
    acceptedDisclaimer: state.wallets.acceptedDisclaimer,
    accountID,
    assets: Constants.getAssets(state, accountID),
    loadingMore: state.wallets.paymentLoadingMoreMap.get(accountID, false),
    payments: Constants.getPayments(state, accountID),
  }
}

const mapDispatchToProps = (dispatch, {navigateAppend, navigateUp}) => ({
  _onLoadMore: accountID => dispatch(WalletsGen.createLoadMorePayments({accountID})),
  _onMarkAsRead: (accountID, mostRecentID) =>
    dispatch(WalletsGen.createMarkAsRead({accountID, mostRecentID})),
  onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
})

const mergeProps = (stateProps, dispatchProps) => {
  const sections = []
  // layout is
  // 1. assets header and list of assets
  // 2. transactions header and transactions
  // Formatted in a SectionList
  const assets =
    stateProps.assets.count() > 0 ? stateProps.assets.map((a, index) => index).toArray() : ['notLoadedYet']
  sections.push({data: assets, title: 'Your assets'})

  // split into pending & history
  let mostRecentID
  const paymentsList = stateProps.payments && stateProps.payments.toList().toArray()
  const [_history, _pending] = partition(paymentsList, p => p.section === 'history')
  const mapItem = p => ({paymentID: p.id, timestamp: p.time})
  let history: any = _history.map(mapItem)
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
      stripeHeader: true,
      title: 'Pending',
    })
  }

  sections.push({
    data: history,
    title: 'History',
  })

  return {
    acceptedDisclaimer: stateProps.acceptedDisclaimer,
    accountID: stateProps.accountID,
    loadingMore: stateProps.loadingMore,
    onBack: dispatchProps.onBack,
    onLoadMore: () => dispatchProps._onLoadMore(stateProps.accountID),
    onMarkAsRead: () => {
      if (mostRecentID) {
        dispatchProps._onMarkAsRead(stateProps.accountID, mostRecentID)
      }
    },
    sections,
  }
}

const sortAndStripTimestamps = (
  p: Array<{
    paymentID: Types.PaymentID
    timestamp: number | null
  }>
) =>
  p
    .sort((p1, p2) => (p1.timestamp && p2.timestamp && p2.timestamp - p1.timestamp) || 0)
    .map(({paymentID}) => ({paymentID}))

// On desktop it's impossible to get here without accepting the
// disclaimer (from the wallet list).
const WalletOrOnboarding = (props: Props) =>
  !isMobile || props.acceptedDisclaimer ? <Wallet {...props} /> : <Onboarding />

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(WalletOrOnboarding)
