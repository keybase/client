import * as Container from '../../../../util/container'
import * as RouteTreeGen from '../../../../actions/route-tree-gen'
import * as Types from '../../../../constants/types/wallets'
import * as Constants from '../../../../constants/wallets'
import * as WalletsGen from '../../../../actions/wallets-gen'
import WalletSettingTrustline from '.'

type OwnProps = {
  accountID: Types.AccountID
}

const mapStateToProps = (state, {accountID}: OwnProps) => ({
  acceptedAssets: state.wallets.trustline.acceptedAssets.get(accountID, Constants.emptyAccountAcceptedAssets),
  assetMap: state.wallets.trustline.assetMap,
})

const mapDispatchToProps = (dispatch, {accountID}: OwnProps) => ({
  onSetupTrustline: () =>
    dispatch(RouteTreeGen.createNavigateAppend({path: [{props: {accountID}, selected: 'trustline'}]})),
  refresh: () =>
    accountID !== Types.noAccountID && dispatch(WalletsGen.createRefreshTrustlineAcceptedAssets({accountID})),
})

const mergeProps = (s, d, o: OwnProps) => ({
  assets: s.acceptedAssets
    .keySeq()
    .toArray()
    .map(assetID => s.assetMap.get(assetID, Constants.emptyAssetDescription))
    .map(asset => ({code: asset.code, issuerVerifiedDomain: asset.issuerVerifiedDomain})),
  onSetupTrustline: d.onSetupTrustline,
  refresh: d.refresh,
})

export default Container.namedConnect(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'WalletSettingTrustline'
)(WalletSettingTrustline)
