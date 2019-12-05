import * as Container from '../../../../util/container'
import * as RouteTreeGen from '../../../../actions/route-tree-gen'
import * as Types from '../../../../constants/types/wallets'
import * as Constants from '../../../../constants/wallets'
import * as WalletsGen from '../../../../actions/wallets-gen'
import WalletSettingTrustline from '.'

type OwnProps = {
  accountID: Types.AccountID
}

export default Container.namedConnect(
  (state, {accountID}: OwnProps) => ({
    acceptedAssets:
      state.wallets.trustline.acceptedAssets.get(accountID) ?? Constants.emptyAccountAcceptedAssets,
    assetMap: state.wallets.trustline.assetMap,
    thisDeviceIsLockedOut: Constants.getAccount(state, accountID).deviceReadOnly,
  }),
  (dispatch, {accountID}: OwnProps) => ({
    onSetupTrustline: () =>
      dispatch(RouteTreeGen.createNavigateAppend({path: [{props: {accountID}, selected: 'trustline'}]})),
    refresh: () =>
      accountID !== Types.noAccountID &&
      dispatch(WalletsGen.createRefreshTrustlineAcceptedAssets({accountID})),
  }),
  (s, d, _: OwnProps) => ({
    assets: [...s.acceptedAssets?.keys()]
      .map(assetID => s.assetMap.get(assetID) ?? Constants.emptyAssetDescription)
      .map(asset => ({code: asset.code, desc: asset.issuerVerifiedDomain || asset.issuerAccountID})),
    onSetupTrustline: d.onSetupTrustline,
    refresh: d.refresh,
    thisDeviceIsLockedOut: s.thisDeviceIsLockedOut,
  }),
  'WalletSettingTrustline'
)(WalletSettingTrustline)
