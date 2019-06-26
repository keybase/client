import {
  AssetInputSenderAdvanced as AssetInputSenderAdvancedComponent,
  AssetInputRecipientAdvanced as AssetInputRecipientAdvancedComponent,
} from './asset-input-advanced'
import {namedConnect} from '../../../util/container'
import * as Constants from '../../../constants/wallets'
import * as WalletsGen from '../../../actions/wallets-gen'

type OwnProps = {}

const recipientS = state => ({
  _buildingAdvanced: state.wallets.buildingAdvanced,
})

const recipientD = dispatch => ({
  onChangeAmount: (recipientAmount: string) =>
    dispatch(WalletsGen.createSetBuildingAdvancedRecipientAmount({recipientAmount})),
})

const recipientM = (s, d, o: OwnProps) => ({
  numDecimalsAllowed: 2, // TODO
  onChangeAmount: d.onChangeAmount,
  recipient: s._buildingAdvanced.recipient,
  recipientAsset: s._buildingAdvanced.recipientAsset,
  recipientType: s._buildingAdvanced.recipientType,
  value: s._buildingAdvanced.recipientAmount,
})

export const AssetInputRecipientAdvanced = namedConnect(
  recipientS,
  recipientD,
  recipientM,
  'AssetInputRecipientAdvanced'
)(AssetInputRecipientAdvancedComponent)

const senderS = state => ({
  _buildingAdvanced: state.wallets.buildingAdvanced,
  _builtPaymentAdvanced: state.wallets.builtPaymentAdvanced,
})

const senderD = dispatch => ({})

const senderM = (s, d, o: OwnProps) => ({
  amountLoading: false,
  approximate: s._builtPaymentAdvanced.fullPath.sourceAmount,
  atMost: s._builtPaymentAdvanced.fullPath.sourceAmountMax,
  error: false,
  numDecimals: s._buildingAdvanced.recipientAsset === 'native' ? 7 : 2,
  recipientAsset: s._buildingAdvanced.recipientAsset,
  senderAsset: s._buildingAdvanced.senderAsset,
  xlmToRecipientAsset: 0,
})

export const AssetInputSenderAdvanced = namedConnect(senderS, senderD, senderM, 'AssetInputSenderAdvanced')(
  AssetInputSenderAdvancedComponent
)
