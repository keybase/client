import * as Container from '../../util/container'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Types from '../../constants/types/wallets'
import * as Constants from '../../constants/wallets'
import * as WalletsGen from '../../actions/wallets-gen'
import Trustline from '.'

type OwnProps = Container.RouteProps<
  {
    accountID: Types.AccountID
  },
  {}
>

const mapStateToProps = (state, ownProps: OwnProps) => ({
  trustline: state.wallets.trustline,
})

const mapDispatchToProps = (dispatch, ownProps: OwnProps) => ({
  onDone: () => dispatch(RouteTreeGen.createNavigateUp()),
  onSearchChange: (text: string) => {},
  refresh: () => {
    const accountID = Container.getRouteProps(ownProps, 'accountID') || Types.noAccountID
    accountID !== Types.noAccountID && dispatch(WalletsGen.createRefreshTrustlineAcceptedAssets({accountID}))
    dispatch(WalletsGen.createRefreshTrustlinePopularAssets())
  },
})

const mergeProps = (s, d, o: OwnProps) => {
  const accountID = Container.getRouteProps(o, 'accountID') || Types.noAccountID
  return {
    acceptedAssets: s.trustline.acceptedAssets.get(accountID, Constants.emptyAccountAcceptedAssets),
    accountID,
    errorMessage: s.trustline.errorMessage,
    loaded: s.trustline.loaded,
    popularAssets: s.trustline.popularAssets,
    searchingAssets: s.trustline.searchingAssetsHit,
    ...d,
  }
}

export default Container.namedConnect(mapStateToProps, mapDispatchToProps, mergeProps, 'Trustline')(Trustline)
