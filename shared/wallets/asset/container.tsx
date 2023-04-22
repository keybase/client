import type * as Types from '../../constants/types/wallets'
import * as Constants from '../../constants/wallets'
import * as Container from '../../util/container'
import * as WalletsGen from '../../actions/wallets-gen'
import Asset from '.'
import openURL from '../../util/open-url'

type OwnProps = {
  accountID: Types.AccountID
  index: number
}

export default (ownProps: OwnProps) => {
  const asset = Container.useSelector(
    state => Constants.getAssets(state, ownProps.accountID)[ownProps.index] ?? Constants.makeAssets()
  )
  const dispatch = Container.useDispatch()
  const onDeposit = (accountID: string, code: string, issuerAccountID: string) => {
    dispatch(WalletsGen.createAssetDeposit({accountID, code, issuerAccountID}))
  }
  const onWithdraw = (accountID: string, code: string, issuerAccountID: string) => {
    dispatch(WalletsGen.createAssetWithdraw({accountID, code, issuerAccountID}))
  }

  const props = {
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
      ? () => onDeposit(ownProps.accountID, asset.assetCode, asset.issuerAccountID)
      : undefined,
    onWithdraw: asset.showWithdrawButton
      ? () => onWithdraw(ownProps.accountID, asset.assetCode, asset.issuerAccountID)
      : undefined,
    openInfoURL: asset.infoUrl ? () => openURL(asset.infoUrl) : undefined,
    openStellarURL: () => openURL('https://www.stellar.org/community/faq#why-is-there-a-minimum-balance'),
    reserves: asset.reserves,
    withdrawButtonText: asset.showWithdrawButton ? asset.withdrawButtonText : '',
    withdrawButtonWaitingKey: Constants.assetWithdrawWaitingKey(asset.issuerAccountID, asset.assetCode),
  }
  return <Asset {...props} />
}
