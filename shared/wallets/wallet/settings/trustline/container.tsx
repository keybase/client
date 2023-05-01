import * as Container from '../../../../util/container'
import * as RouteTreeGen from '../../../../actions/route-tree-gen'
import * as Types from '../../../../constants/types/wallets'
import * as Constants from '../../../../constants/wallets'
import * as WalletsGen from '../../../../actions/wallets-gen'
import WalletSettingTrustline from '.'

type OwnProps = {
  accountID: Types.AccountID
}

export default (ownProps: OwnProps) => {
  const {accountID} = ownProps
  const acceptedAssets = Container.useSelector(
    state => state.wallets.trustline.acceptedAssets.get(accountID) ?? Constants.emptyAccountAcceptedAssets
  )
  const assetMap = Container.useSelector(state => state.wallets.trustline.assetMap)
  const thisDeviceIsLockedOut = Container.useSelector(
    state => Constants.getAccount(state, accountID).deviceReadOnly
  )

  const dispatch = Container.useDispatch()
  const onSetupTrustline = () => {
    dispatch(RouteTreeGen.createNavigateAppend({path: [{props: {accountID}, selected: 'trustline'}]}))
  }
  const refresh = () => {
    accountID !== Types.noAccountID && dispatch(WalletsGen.createRefreshTrustlineAcceptedAssets({accountID}))
  }
  const props = {
    assets: [...(acceptedAssets?.keys() ?? [])]
      .map(assetID => assetMap.get(assetID) ?? Constants.emptyAssetDescription)
      .map(asset => ({code: asset.code, desc: asset.issuerVerifiedDomain || asset.issuerAccountID})),
    onSetupTrustline: onSetupTrustline,
    refresh: refresh,
    thisDeviceIsLockedOut: thisDeviceIsLockedOut,
  }
  return <WalletSettingTrustline {...props} />
}
