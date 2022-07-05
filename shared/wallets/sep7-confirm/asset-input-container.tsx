import AssetInput from '../send-form/asset-input/asset-input-basic'
import * as Constants from '../../constants/wallets'
import * as Container from '../../util/container'

type OwnProps = {
  amount: string
  onChangeAmount: (amount: string) => void
}

const mapStateToProps = (state: Container.TypedState) => {
  const currency = 'XLM'
  return {
    bottomLabel: `Your primary account has ${
      state.wallets.sep7ConfirmInfo ? state.wallets.sep7ConfirmInfo.availableToSendNative : '(unknown)' // TODO is this ok
    } available to send.`,
    currencyLoading: false,
    displayUnit: Constants.getCurrencyAndSymbol(state, currency) || currency,
    numDecimalsAllowed: Constants.numDecimalsAllowedForCurrency(currency),
    topLabel: '',
  }
}

const mapDispatchToProps = (_: Container.TypedDispatch) => ({
  onChangeDisplayUnit: undefined, // Add when non-native assets are supported
})

export default Container.connect(
  mapStateToProps,
  mapDispatchToProps,
  (stateProps, dispatchProps, ownProps: OwnProps) => ({
    bottomLabel: stateProps.bottomLabel,
    currencyLoading: stateProps.currencyLoading,
    displayUnit: stateProps.displayUnit,
    numDecimalsAllowed: stateProps.numDecimalsAllowed,
    onChangeAmount: ownProps.onChangeAmount,
    onChangeDisplayUnit: dispatchProps.onChangeDisplayUnit,
    topLabel: stateProps.topLabel,
    value: ownProps.amount,
  })
)(AssetInput)
