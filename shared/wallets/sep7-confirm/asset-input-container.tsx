import AssetInput from '../send-form/asset-input/asset-input-basic'
import * as Constants from '../../constants/wallets'
import * as Container from '../../util/container'

type OwnProps = {
  amount: string
  onChangeAmount: (amount: string) => void
}

export default (ownProps: OwnProps) => {
  const currency = 'XLM'
  const bottomLabel = Container.useSelector(
    state =>
      `Your primary account has ${
        state.wallets.sep7ConfirmInfo ? state.wallets.sep7ConfirmInfo.availableToSendNative : '(unknown)'
      } available to send.`
  )
  const currencyLoading = false
  const displayUnit = Container.useSelector(
    state => Constants.getCurrencyAndSymbol(state, currency) || currency
  )
  const numDecimalsAllowed = Constants.numDecimalsAllowedForCurrency(currency)
  const topLabel = ''

  const onChangeDisplayUnit = undefined // Add when non-native assets are supported
  const props = {
    bottomLabel: bottomLabel,
    currencyLoading: currencyLoading,
    displayUnit: displayUnit,
    numDecimalsAllowed: numDecimalsAllowed,
    onChangeAmount: ownProps.onChangeAmount,
    onChangeDisplayUnit: onChangeDisplayUnit,
    topLabel: topLabel,
    value: ownProps.amount,
  }
  return <AssetInput {...props} />
}
