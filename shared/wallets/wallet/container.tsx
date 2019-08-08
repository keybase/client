import * as React from 'react'
import * as Container from '../../util/container'
import * as WalletsGen from '../../actions/wallets-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Constants from '../../constants/wallets'
import * as Types from '../../constants/types/wallets'
import Onboarding from '../onboarding/container'
import {partition} from 'lodash-es'
import Wallet, {Props, AssetSectionTitle} from '.'

type OwnProps = {}

const mapStateToProps = (state: Container.TypedState) => {
  const accountID = Constants.getSelectedAccount(state)
  return {
    acceptedDisclaimer: state.wallets.acceptedDisclaimer,
    accountID,
    assets: Constants.getAssets(state, accountID),
    loadingMore: state.wallets.paymentLoadingMoreMap.get(accountID, false),
    payments: Constants.getPayments(state, accountID),
    thisDeviceIsLockedOut: Constants.getAccount(state, accountID).deviceReadOnly,
  }
}

const mapDispatchToProps = (dispatch: Container.TypedDispatch) => ({
  _onLoadMore: accountID => dispatch(WalletsGen.createLoadMorePayments({accountID})),
  _onMarkAsRead: (accountID, mostRecentID) =>
    dispatch(WalletsGen.createMarkAsRead({accountID, mostRecentID})),
  onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
  onSetupTrustline: accountID =>
    dispatch(RouteTreeGen.createNavigateAppend({path: [{props: {accountID}, selected: 'trustline'}]})),
})

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
  !Container.isMobile || props.acceptedDisclaimer ? (
    <Wallet {...props} />
  ) : (
    <Onboarding nextScreen="openWallet" />
  )

export default Container.connect(
  mapStateToProps,
  mapDispatchToProps,
  (stateProps, dispatchProps, _: OwnProps) => {
    const sections: Props['sections'] = []
    // layout is
    // 1. assets header and list of assets
    // 2. transactions header and transactions
    // Formatted in a SectionList
    const assets =
      stateProps.assets.count() > 0 ? stateProps.assets.map((_, index) => index).toArray() : ['notLoadedYet']
    sections.push({
      data: assets,
      kind: 'assets',
      title: (
        <AssetSectionTitle
          onSetupTrustline={() => dispatchProps.onSetupTrustline(stateProps.accountID)}
          thisDeviceIsLockedOut={stateProps.thisDeviceIsLockedOut}
        />
      ),
    })

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
        kind: 'payments',
        stripeHeader: true,
        title: 'Pending',
      })
    }

    sections.push({
      data: history,
      kind: 'payments',
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
)(WalletOrOnboarding)
