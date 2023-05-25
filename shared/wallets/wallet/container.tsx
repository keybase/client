import * as Container from '../../util/container'
import * as WalletsGen from '../../actions/wallets-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Constants from '../../constants/wallets'
import type * as Types from '../../constants/types/wallets'
import Onboarding from '../onboarding/container'
import partition from 'lodash/partition'
import Wallet, {AssetSectionTitle, type Props} from '.'

const sortAndStripTimestamps = (
  p: Array<{
    paymentID: Types.PaymentID
    timestamp: number
  }>
) =>
  p
    .sort((p1, p2) => (p1.timestamp && p2.timestamp && p2.timestamp - p1.timestamp) || 0)
    .map(({paymentID}) => ({paymentID}))

// On desktop it's impossible to get here without accepting the
// disclaimer (from the wallet list).
const WalletOrOnboarding = (props: Props) =>
  !props.acceptedDisclaimer ? <Onboarding nextScreen="openWallet" /> : <Wallet {...props} />

export default () => {
  const accountID = Container.useSelector(state => Constants.getSelectedAccount(state))
  const acceptedDisclaimer = Container.useSelector(state => state.wallets.acceptedDisclaimer)
  const _assets = Container.useSelector(state => Constants.getAssets(state, accountID))
  const loadError = Container.useSelector(state => state.wallets.loadPaymentsError)
  const loadingMore = Container.useSelector(
    state => state.wallets.paymentLoadingMoreMap.get(accountID) ?? false
  )
  const payments = Container.useSelector(state => Constants.getPayments(state, accountID))
  const thisDeviceIsLockedOut = Container.useSelector(
    state => Constants.getAccount(state, accountID).deviceReadOnly
  )

  const dispatch = Container.useDispatch()
  const _onLoadMore = accountID => {
    dispatch(WalletsGen.createLoadMorePayments({accountID}))
  }
  const _onMarkAsRead = (accountID, mostRecentID) => {
    dispatch(WalletsGen.createMarkAsRead({accountID, mostRecentID}))
  }
  const onBack = () => {
    dispatch(RouteTreeGen.createNavigateUp())
  }
  const onSetupTrustline = (accountID: string) => {
    dispatch(
      RouteTreeGen.createNavigateAppend({path: [{props: {accountID}, selected: 'trustline'} as const]})
    )
  }

  const sections: Props['sections'] = []
  // layout is
  // 1. assets header and list of assets
  // 2. transactions header and transactions
  // Formatted in a SectionList
  const assets = _assets.length > 0 ? _assets.map((_, index) => index) : ['notLoadedYet']
  sections.push({
    data: assets,
    kind: 'assets',
    title: (
      <AssetSectionTitle
        onSetupTrustline={() => onSetupTrustline(accountID)}
        thisDeviceIsLockedOut={thisDeviceIsLockedOut}
      />
    ),
  })

  // split into pending & history
  let mostRecentID
  const paymentsList = payments && [...payments.values()]
  const [_history, _pending] = partition(paymentsList, p => p.section === 'history')
  const mapItem = p => ({paymentID: p.id, timestamp: p.time})
  let history: any = _history.map(mapItem)
  const pending = _pending.map(mapItem)

  if (history.length) {
    history = sortAndStripTimestamps(history)
    mostRecentID = history[0].paymentID
  } else {
    history = [payments ? 'noPayments' : 'notLoadedYet']
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

  const props = {
    acceptedDisclaimer: acceptedDisclaimer,
    accountID: accountID,
    loadError: loadError,
    loadingMore: loadingMore,
    onBack: onBack,
    onLoadMore: () => _onLoadMore(accountID),
    onMarkAsRead: () => {
      if (mostRecentID) {
        _onMarkAsRead(accountID, mostRecentID)
      }
    },
    sections,
  }
  return <WalletOrOnboarding {...props} />
}
