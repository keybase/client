import * as Container from '../../util/container'
import * as Types from '../../constants/types/wallets'
import * as Constants from '../../constants/wallets'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as WalletsGen from '../../actions/wallets-gen'
import Asset from './asset'

type OwnProps = {
  accountID: Types.AccountID
  assetID: Types.AssetID
  firstItem: boolean
}

const mapStateToProps = (state, ownProps: OwnProps) => ({
  acceptedAssets: state.wallets.trustline.acceptedAssets.get(
    ownProps.accountID,
    Constants.emptyAccountAcceptedAssets
  ),
  asset: state.wallets.trustline.assetMap.get(ownProps.assetID, Constants.emptyAssetDescription),
  expandedAssets: state.wallets.trustline.expandedAssets,
})

const mapDispatchToProps = (dispatch, ownProps: OwnProps) => ({
  onCollapse: () =>
    dispatch(
      WalletsGen.createSetTrustlineExpanded({
        assetID: ownProps.assetID,
        expanded: false,
      })
    ),
  onDone: RouteTreeGen.createNavigateUp(),
  onExpand: () =>
    dispatch(
      WalletsGen.createSetTrustlineExpanded({
        assetID: ownProps.assetID,
        expanded: true,
      })
    ),
})

const mergeProps = (s, d, o: OwnProps) => ({
  code: s.asset.code,
  expanded: s.expandedAssets.includes(o.assetID),
  firstItem: o.firstItem,
  issuerAccountID: s.asset.issuerAccountID,
  issuerVerifiedDomain: s.asset.issuerVerifiedDomain,
  onAccept: () => {}, // TODO PICNIC-53
  onCollapse: d.onCollapse,
  onExpand: d.onExpand,
  onRemove: () => {}, // TODO PICNIC-53
  onViewDetails: () => {}, // TODO PICNIC-53
  trusted: !!s.acceptedAssets.get(o.assetID, 0),
})

export default Container.namedConnect(mapStateToProps, mapDispatchToProps, mergeProps, 'Asset')(Asset)
