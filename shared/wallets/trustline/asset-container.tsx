import * as Container from '../../util/container'
import * as Types from '../../constants/types/wallets'
import * as Constants from '../../constants/wallets'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as WalletsGen from '../../actions/wallets-gen'
import * as Waiting from '../../constants/waiting'
import openUrl from '../../util/open-url'
import Asset from './asset'

type OwnProps = {
  accountID: Types.AccountID
  assetID: Types.AssetID
  cannotAccept: boolean
  firstItem: boolean
}

const mapStateToProps = (state, ownProps: OwnProps) => ({
  acceptedAssets: state.wallets.trustline.acceptedAssets.get(
    ownProps.accountID,
    Constants.emptyAccountAcceptedAssets
  ),
  asset: state.wallets.trustline.assetMap.get(ownProps.assetID, Constants.emptyAssetDescription),
  expandedAssets: state.wallets.trustline.expandedAssets,
  waitingRefresh: Waiting.anyWaiting(
    state,
    Constants.refreshTrustlineAcceptedAssetsWaitingKey(ownProps.accountID)
  ),
})

const mapDispatchToProps = (dispatch, ownProps: OwnProps) => ({
  onAccept: () =>
    dispatch(WalletsGen.createAddTrustline({accountID: ownProps.accountID, assetID: ownProps.assetID})),
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
  onRemove: () =>
    dispatch(WalletsGen.createDeleteTrustline({accountID: ownProps.accountID, assetID: ownProps.assetID})),
})

const mergeProps = (s, d, o: OwnProps) => ({
  cannotAccept: o.cannotAccept,
  code: s.asset.code,
  expanded: s.expandedAssets.includes(o.assetID),
  firstItem: o.firstItem,
  issuerAccountID: s.asset.issuerAccountID,
  issuerVerifiedDomain: s.asset.issuerVerifiedDomain,
  onAccept: d.onAccept,
  onCollapse: d.onCollapse,
  onExpand: d.onExpand,
  onRemove: d.onRemove,
  onViewDetails: () => openUrl('https://keybase.io'), // TODO patrick
  trusted: !!s.acceptedAssets.get(o.assetID, 0),
  waitingAdd: s.waitingAdd,
  waitingDelete: s.waitingDelete,
  waitingKeyAdd: Constants.addTrustlineWaitingKey(o.accountID, o.assetID),
  waitingKeyDelete: Constants.deleteTrustlineWaitingKey(o.accountID, o.assetID),
  waitingRefresh: s.waitingRefresh,
})

export default Container.namedConnect(mapStateToProps, mapDispatchToProps, mergeProps, 'Asset')(Asset)
