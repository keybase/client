import * as Container from '../../util/container'
import * as WalletsGen from '../../actions/wallets-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Constants from '../../constants/wallets'
import type * as Types from '../../constants/types/wallets'
import Header from './header/container'
import Onboarding from '../onboarding/container'
import partition from 'lodash/partition'
import Wallet, {AssetSectionTitle, type Props} from '.'

type OwnProps = {}

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
  !props.acceptedDisclaimer ? <Onboarding nextScreen="openWallet" /> : <Wallet {...props} />

WalletOrOnboarding.navigationOptions = {
  header: () => <Header />,
  headerLeft: () => null,
  headerRight: () => null,
  headerTitle: () => null,
}

export default Container.connect(
  state => {
    const accountID = Constants.getSelectedAccount(state)
    return {
      acceptedDisclaimer: state.wallets.acceptedDisclaimer,
      accountID,
      assets: Constants.getAssets(state, accountID),
      loadError: state.wallets.loadPaymentsError,
      loadingMore: state.wallets.paymentLoadingMoreMap.get(accountID) ?? false,
      payments: Constants.getPayments(state, accountID),
      thisDeviceIsLockedOut: Constants.getAccount(state, accountID).deviceReadOnly,
    }
  },
  dispatch => ({
    _onLoadMore: accountID => dispatch(WalletsGen.createLoadMorePayments({accountID})),
    _onMarkAsRead: (accountID, mostRecentID) =>
      dispatch(WalletsGen.createMarkAsRead({accountID, mostRecentID})),
    onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
    onSetupTrustline: accountID =>
      dispatch(RouteTreeGen.createNavigateAppend({path: [{props: {accountID}, selected: 'trustline'}]})),
  }),
  (stateProps, dispatchProps, _: OwnProps) => {
    const sections: Props['sections'] = []
    // layout is
    // 1. assets header and list of assets
    // 2. transactions header and transactions
    // Formatted in a SectionList
    const assets =
      stateProps.assets.length > 0 ? stateProps.assets.map((_, index) => index) : ['notLoadedYet']
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
    const paymentsList = stateProps.payments && [...stateProps.payments.values()]
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
      loadError: stateProps.loadError,
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
