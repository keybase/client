import * as Container from '../../util/container'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Types from '../../constants/types/wallets'
import * as Constants from '../../constants/wallets'
import * as WalletsGen from '../../actions/wallets-gen'
import * as Waiting from '../../constants/waiting'
import {debounce} from 'lodash-es'
import Trustline from '.'

type OwnProps = Container.RouteProps<{accountID: Types.AccountID}>

const mapStateToProps = (state: Container.TypedState, ownProps: OwnProps) => {
  const accountID = Container.getRouteProps(ownProps, 'accountID', Types.noAccountID)
  return {
    accountAssets: Constants.getAssets(state, accountID),
    canAddTrustline: Constants.getAccount(state, accountID).canAddTrustline,
    error: state.wallets.changeTrustlineError,
    trustline: state.wallets.trustline,
    waitingSearch: Waiting.anyWaiting(state, Constants.searchTrustlineAssetsWaitingKey),
  }
}

const mapDispatchToProps = (dispatch: Container.TypedDispatch, ownProps: OwnProps) => ({
  clearTrustlineModal: () => dispatch(WalletsGen.createClearTrustlineSearchResults()),
  onDone: () => dispatch(RouteTreeGen.createNavigateUp()),
  onSearchChange: debounce((text: string) => dispatch(WalletsGen.createSetTrustlineSearchText({text})), 500),
  refresh: () => {
    const accountID = Container.getRouteProps(ownProps, 'accountID', Types.noAccountID)
    accountID !== Types.noAccountID && dispatch(WalletsGen.createRefreshTrustlineAcceptedAssets({accountID}))
    dispatch(WalletsGen.createRefreshTrustlinePopularAssets())
  },
})

const emptyAccountAsset = Constants.makeAssets()

const mergeProps = (s, d, o: OwnProps) => {
  const accountID = Container.getRouteProps(o, 'accountID', Types.noAccountID)
  const acceptedAssets = s.trustline.acceptedAssets.get(accountID, Constants.emptyAccountAcceptedAssets)
  return {
    acceptedAssets: acceptedAssets.keySeq().toArray(),
    accountID,
    balanceAvailableToSend: s.accountAssets.find(
      ({assetCode}) => assetCode === 'XLM',
      undefined,
      emptyAccountAsset
    ).balanceAvailableToSend,
    canAddTrustline: s.canAddTrustline,
    clearTrustlineModal: d.clearTrustlineModal,
    error: s.error,
    loaded: s.trustline.loaded,
    popularAssets: s.trustline.popularAssets.filter(assetID => !acceptedAssets.has(assetID)).toArray(),
    searchingAssets: s.trustline.searchingAssets && s.trustline.searchingAssets.toArray(),
    totalAssetsCount: s.trustline.totalAssetsCount,
    waitingSearch: s.waitingSearch,
    ...d,
  }
}

export default Container.namedConnect(mapStateToProps, mapDispatchToProps, mergeProps, 'Trustline')(Trustline)
