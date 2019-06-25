import AssetInput from '../send-form/asset-input/index'
import * as React from 'react'
import {namedConnect} from '../../util/container'
import * as Constants from '../../constants/wallets'

type OwnProps = {}

const mapStateToProps = (state, ownProps: OwnProps) => {
  const currency = 'XLM'
  return {
    bottomLabel: `Your primary account has ${state.wallets.sep7ConfirmInfo.availableToSendNative} available to send.`,
    // bottomLabel: `(Approximately ${state.wallets.sep7ConfirmInfo.displayAmountFiat})`,
    currencyLoading: false,
    displayUnit: Constants.getCurrencyAndSymbol(state, currency) || currency,
    // TODO differentiate between an asset (7 digits) and a display currency (2 digits) below
    inputPlaceholder: currency !== 'XLM' ? '0.00' : '0.0000000',
    numDecimalsAllowed: currency !== 'XLM' ? 2 : 7,
    topLabel: '',
  }
}

const mapDispatchToProps = dispatch => ({
  onChangeDisplayUnit: undefined, // TODO
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  bottomLabel: stateProps.bottomLabel,
  currencyLoading: stateProps.currencyLoading,
  displayUnit: stateProps.displayUnit,
  initialAmount: ownProps.initialAmount,
  inputPlaceholder: stateProps.inputPlaceholder,
  numDecimalsAllowed: stateProps.numDecimalsAllowed,
  onChangeAmount: ownProps.onChangeAmount,
  onChangeDisplayUnit: dispatchProps.onChangeDisplayUnit,
  topLabel: stateProps.topLabel,
  value: stateProps.value,
})

const AssetInputWrapper = props => {
  const [amount, onChangeAmount] = React.useState('')
  return <AssetInput {...props} value={amount} onChangeAmount={onChangeAmount} />
}

export default namedConnect(mapStateToProps, mapDispatchToProps, mergeProps, 'AssetInput')(AssetInputWrapper)
