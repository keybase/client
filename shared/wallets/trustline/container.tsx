import * as Container from '../../util/container'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Types from '../../constants/types/wallets'
import * as Constants from '../../constants/wallets'
import * as WalletsGen from '../../actions/wallets-gen'
import * as Waiting from '../../constants/waiting'
import {debounce} from 'lodash-es'
import Trustline from '.'

type OwnProps = Container.RouteProps<
  {
    accountID: Types.AccountID
  },
  {}
>

const mapStateToProps = (state, ownProps: OwnProps) => ({
  trustline: state.wallets.trustline,
  waitingSearch: Waiting.anyWaiting(state, Constants.searchTrustlineAssetsWaitingKey),
})

const mapDispatchToProps = (dispatch, ownProps: OwnProps) => ({
  clearTrustlineModal: () => {
    dispatch(WalletsGen.createClearTrustlineSearchResults())
    dispatch(WalletsGen.createSetTrustlineErrorMessage({errorMessage: null}))
  },
  onDone: () => dispatch(RouteTreeGen.createNavigateUp()),
  onSearchChange: debounce((text: string) => dispatch(WalletsGen.createSetTrustlineSearchText({text})), 500),
  refresh: () => {
    const accountID = Container.getRouteProps(ownProps, 'accountID') || Types.noAccountID
    accountID !== Types.noAccountID && dispatch(WalletsGen.createRefreshTrustlineAcceptedAssets({accountID}))
    dispatch(WalletsGen.createRefreshTrustlinePopularAssets())
  },
})

const mergeProps = (s, d, o: OwnProps) => {
  const accountID = Container.getRouteProps(o, 'accountID') || Types.noAccountID
  const acceptedAssets = s.trustline.acceptedAssets.get(accountID, Constants.emptyAccountAcceptedAssets)
  return {
    acceptedAssets,
    accountID,
    clearTrustlineModal: d.clearTrustlineModal,
    errorMessage: s.trustline.errorMessage,
    loaded: s.trustline.loaded,
    popularAssets: s.trustline.popularAssets.filter(assetID => !acceptedAssets.has(assetID)),
    searchingAssets: s.trustline.searchingAssets,
    waitingSearch: s.waitingSearch,
    ...d,
  }
}

export default Container.namedConnect(mapStateToProps, mapDispatchToProps, mergeProps, 'Trustline')(Trustline)
