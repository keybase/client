import * as Container from '../../util/container'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Types from '../../constants/types/wallets'
import * as Constants from '../../constants/wallets'
import * as WalletsGen from '../../actions/wallets-gen'
import * as Waiting from '../../constants/waiting'
import debounce from 'lodash/debounce'
import Trustline from '.'

type OwnProps = Container.RouteProps<{accountID: Types.AccountID}>

const emptyAccountAsset = Constants.makeAssets()

export default Container.namedConnect(
  (state, ownProps: OwnProps) => {
    const accountID = Container.getRouteProps(ownProps, 'accountID', Types.noAccountID)
    return {
      accountAssets: Constants.getAssets(state, accountID),
      canAddTrustline: Constants.getAccount(state, accountID).canAddTrustline,
      error: state.wallets.changeTrustlineError,
      trustline: state.wallets.trustline,
      waitingSearch: Waiting.anyWaiting(state, Constants.searchTrustlineAssetsWaitingKey),
    }
  },
  dispatch => ({
    onDone: () => dispatch(RouteTreeGen.createNavigateUp()),
    onSearchChange: debounce(
      (text: string) => dispatch(WalletsGen.createSetTrustlineSearchText({text})),
      500
    ),
  }),
  (s, d, o: OwnProps) => {
    const accountID = Container.getRouteProps(o, 'accountID', Types.noAccountID)
    const acceptedAssets = s.trustline.acceptedAssets.get(accountID) ?? Constants.emptyAccountAcceptedAssets
    return {
      acceptedAssets: [...acceptedAssets.keys()],
      accountID,
      balanceAvailableToSend: (
        s.accountAssets.find(({assetCode}) => assetCode === 'XLM') ?? emptyAccountAsset
      ).balanceAvailableToSend,
      canAddTrustline: s.canAddTrustline,
      error: s.error,
      loaded: s.trustline.loaded,
      popularAssets: s.trustline.popularAssets.filter(assetID => !acceptedAssets.has(assetID)),
      searchingAssets: s.trustline.searchingAssets && s.trustline.searchingAssets,
      totalAssetsCount: s.trustline.totalAssetsCount,
      waitingSearch: s.waitingSearch,
      ...d,
    }
  },
  'Trustline'
)(Trustline)
