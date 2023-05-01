import * as Container from '../../util/container'
import type * as Types from '../../constants/types/wallets'
import * as Constants from '../../constants/wallets'
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

export default (ownProps: OwnProps) => {
  const acceptedAssets = Container.useSelector(
    state =>
      state.wallets.trustline.acceptedAssets.get(ownProps.accountID) ?? Constants.emptyAccountAcceptedAssets
  )
  const asset = Container.useSelector(
    state => state.wallets.trustline.assetMap.get(ownProps.assetID) ?? Constants.emptyAssetDescription
  )
  const expandedAssets = Container.useSelector(state => state.wallets.trustline.expandedAssets)
  const thisDeviceIsLockedOut = Container.useSelector(
    state => Constants.getAccount(state, ownProps.accountID).deviceReadOnly
  )
  const waitingRefresh = Container.useSelector(state =>
    Waiting.anyWaiting(state, Constants.refreshTrustlineAcceptedAssetsWaitingKey(ownProps.accountID))
  )

  const dispatch = Container.useDispatch()
  const onAccept = () => {
    dispatch(WalletsGen.createAddTrustline({accountID: ownProps.accountID, assetID: ownProps.assetID}))
  }
  const onCollapse = () => {
    dispatch(WalletsGen.createSetTrustlineExpanded({assetID: ownProps.assetID, expanded: false}))
  }
  const onExpand = () => {
    dispatch(WalletsGen.createSetTrustlineExpanded({assetID: ownProps.assetID, expanded: true}))
  }
  const onRemove = () => {
    dispatch(WalletsGen.createDeleteTrustline({accountID: ownProps.accountID, assetID: ownProps.assetID}))
  }
  const props = {
    cannotAccept: ownProps.cannotAccept,
    code: asset.code,
    expanded: expandedAssets.has(ownProps.assetID),
    firstItem: ownProps.firstItem,
    infoUrlText: asset.infoUrlText,
    issuerAccountID: asset.issuerAccountID,
    issuerVerifiedDomain: asset.issuerVerifiedDomain,
    onAccept: onAccept,
    onCollapse: onCollapse,
    onExpand: onExpand,
    onOpenInfoUrl: asset.infoUrl ? () => openUrl(asset.infoUrl) : undefined,
    onRemove: onRemove,
    thisDeviceIsLockedOut: thisDeviceIsLockedOut,
    trusted: !!acceptedAssets.get(ownProps.assetID) ?? 0,
    waitingKeyAdd: Constants.addTrustlineWaitingKey(ownProps.accountID, ownProps.assetID),
    waitingKeyDelete: Constants.deleteTrustlineWaitingKey(ownProps.accountID, ownProps.assetID),
    waitingRefresh: waitingRefresh,
  }
  return <Asset {...props} />
}
