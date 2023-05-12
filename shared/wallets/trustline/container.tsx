import * as Container from '../../util/container'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Types from '../../constants/types/wallets'
import * as Constants from '../../constants/wallets'
import * as WalletsGen from '../../actions/wallets-gen'
import * as Waiting from '../../constants/waiting'
import debounce from 'lodash/debounce'
import Trustline from '.'

type OwnProps = Container.RouteProps2<'trustline'>

const emptyAccountAsset = Constants.makeAssets()

export default (ownProps: OwnProps) => {
  const accountID = ownProps.route.params.accountID ?? Types.noAccountID
  const accountAssets = Container.useSelector(state => Constants.getAssets(state, accountID))
  const canAddTrustline = Container.useSelector(
    state => Constants.getAccount(state, accountID).canAddTrustline
  )
  const error = Container.useSelector(state => state.wallets.changeTrustlineError)
  const trustline = Container.useSelector(state => state.wallets.trustline)
  const waitingSearch = Container.useSelector(state =>
    Waiting.anyWaiting(state, Constants.searchTrustlineAssetsWaitingKey)
  )
  const dispatch = Container.useDispatch()
  const onDone = () => {
    dispatch(RouteTreeGen.createNavigateUp())
  }
  const onSearchChange = debounce(
    (text: string) => dispatch(WalletsGen.createSetTrustlineSearchText({text})),
    500
  )
  const acceptedAssets = trustline.acceptedAssets.get(accountID) ?? Constants.emptyAccountAcceptedAssets
  const props = {
    acceptedAssets: [...acceptedAssets.keys()],
    accountID,
    balanceAvailableToSend: (accountAssets.find(({assetCode}) => assetCode === 'XLM') ?? emptyAccountAsset)
      .balanceAvailableToSend,
    canAddTrustline: canAddTrustline,
    error: error,
    loaded: trustline.loaded,
    onDone,
    onSearchChange,
    popularAssets: trustline.popularAssets.filter(assetID => !acceptedAssets.has(assetID)),
    searchingAssets: trustline.searchingAssets && trustline.searchingAssets,
    totalAssetsCount: trustline.totalAssetsCount,
    waitingSearch: waitingSearch,
  }
  return <Trustline {...props} />
}
