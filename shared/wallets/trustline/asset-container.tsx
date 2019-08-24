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

const mapStateToProps = (state: Container.TypedState, ownProps: OwnProps) => ({
  acceptedAssets: state.wallets.trustline.acceptedAssets.get(
    ownProps.accountID,
    Constants.emptyAccountAcceptedAssets
  ),
  asset: state.wallets.trustline.assetMap.get(ownProps.assetID, Constants.emptyAssetDescription),
  expandedAssets: state.wallets.trustline.expandedAssets,
  thisDeviceIsLockedOut: Constants.getAccount(state, ownProps.accountID).deviceReadOnly,
  waitingRefresh: Waiting.anyWaiting(
    state,
    Constants.refreshTrustlineAcceptedAssetsWaitingKey(ownProps.accountID)
  ),
})

const mapDispatchToProps = (dispatch: Container.TypedDispatch, ownProps: OwnProps) => ({
  onAccept: () =>
    dispatch(WalletsGen.createAddTrustline({accountID: ownProps.accountID, assetID: ownProps.assetID})),
  onCollapse: () =>
    dispatch(
      WalletsGen.createSetTrustlineExpanded({
        assetID: ownProps.assetID,
        expanded: false,
      })
    ),
  onDeposit: (accountID: string, code: string, issuerAccountID: string) =>
    dispatch(WalletsGen.createAssetDeposit({accountID, code, issuerAccountID})),
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
  onWithdraw: (accountID: string, code: string, issuerAccountID: string) =>
    dispatch(WalletsGen.createAssetWithdraw({accountID, code, issuerAccountID})),
})

export default Container.namedConnect(
  mapStateToProps,
  mapDispatchToProps,
  (s, d, o) => ({
    cannotAccept: o.cannotAccept,
    code: s.asset.code,
    depositButtonText: s.asset.depositButtonText,
    depositButtonWaitingKey: Constants.assetDepositWaitingKey(s.asset.issuerAccountID, s.asset.code),
    expanded: s.expandedAssets.includes(o.assetID),
    firstItem: o.firstItem,
    infoUrlText: s.asset.infoUrlText,
    issuerAccountID: s.asset.issuerAccountID,
    issuerVerifiedDomain: s.asset.issuerVerifiedDomain,
    onAccept: d.onAccept,
    onCollapse: d.onCollapse,
    onDeposit: s.asset.showDepositButton
      ? () => d.onDeposit(o.accountID, s.asset.code, s.asset.issuerAccountID)
      : undefined,
    onExpand: d.onExpand,
    onOpenInfoUrl: s.asset.infoUrl ? () => openUrl(s.asset.infoUrl) : undefined,
    onRemove: d.onRemove,
    onWithdraw: s.asset.showWithdrawButton
      ? () => d.onWithdraw(o.accountID, s.asset.code, s.asset.issuerAccountID)
      : undefined,
    thisDeviceIsLockedOut: s.thisDeviceIsLockedOut,
    trusted: !!s.acceptedAssets.get(o.assetID, 0),
    waitingKeyAdd: Constants.addTrustlineWaitingKey(o.accountID, o.assetID),
    waitingKeyDelete: Constants.deleteTrustlineWaitingKey(o.accountID, o.assetID),
    waitingRefresh: s.waitingRefresh,
    withdrawButtonText: s.asset.withdrawButtonText,
    withdrawButtonWaitingKey: Constants.assetWithdrawWaitingKey(s.asset.issuerAccountID, s.asset.code),
  }),
  'Asset'
)(Asset)
