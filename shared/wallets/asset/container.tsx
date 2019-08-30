import * as Types from '../../constants/types/wallets'
import * as Constants from '../../constants/wallets'
import * as Container from '../../util/container'
import * as WalletsGen from '../../actions/wallets-gen'
import Asset from '.'
import openURL from '../../util/open-url'

type OwnProps = {
  accountID: Types.AccountID
  index: number
}

const mapStateToProps = (state: Container.TypedState, ownProps: OwnProps) => ({
  _asset: Constants.getAssets(state, ownProps.accountID).get(ownProps.index, Constants.makeAssets()),
})

const mapDispatchToProps = (dispatch: Container.TypedDispatch) => ({
  onDeposit: (accountID: string, code: string, issuerAccountID: string) =>
    dispatch(WalletsGen.createAssetDeposit({accountID, code, issuerAccountID})),
  onWithdraw: (accountID: string, code: string, issuerAccountID: string) =>
    dispatch(WalletsGen.createAssetWithdraw({accountID, code, issuerAccountID})),
})

export default Container.connect(
  mapStateToProps,
  mapDispatchToProps,
  (stateProps, dispatchProps, ownProps) => {
    const asset = stateProps._asset
    return {
      availableToSend: asset.balanceAvailableToSend,
      balance: asset.balanceTotal,
      code: asset.assetCode,
      depositButtonText: asset.showDepositButton ? asset.depositButtonText : '',
      depositButtonWaitingKey: Constants.assetDepositWaitingKey(asset.issuerAccountID, asset.assetCode),
      equivAvailableToSend: `${asset.availableToSendWorth}`,
      equivBalance: `${asset.worth}`,
      infoUrlText: asset.infoUrlText,
      isNative: asset.assetCode === 'XLM' && asset.issuerAccountID === '',
      issuerAccountID: asset.issuerAccountID,
      issuerName: asset.issuerVerifiedDomain || asset.issuerName || 'Unknown',
      name: asset.name,
      onDeposit: asset.showDepositButton
        ? () => dispatchProps.onDeposit(ownProps.accountID, asset.assetCode, asset.issuerAccountID)
        : undefined,
      onWithdraw: asset.showWithdrawButton
        ? () => dispatchProps.onWithdraw(ownProps.accountID, asset.assetCode, asset.issuerAccountID)
        : undefined,
      openInfoURL: asset.infoUrl ? () => openURL(asset.infoUrl) : undefined,
      openStellarURL: () => openURL('https://www.stellar.org/faq/#_Why_is_there_a_minimum_balance'),
      reserves: asset.reserves.toArray(),
      withdrawButtonText: asset.showWithdrawButton ? asset.withdrawButtonText : '',
      withdrawButtonWaitingKey: Constants.assetWithdrawWaitingKey(asset.issuerAccountID, asset.assetCode),
    }
  }
)(Asset)
