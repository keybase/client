// @flow
import AssetInput from '.'
import * as WalletsGen from '../../../actions/wallets-gen'
import {namedConnect} from '../../../util/container'
import * as Route from '../../../actions/route-tree'
import * as Constants from '../../../constants/wallets'
import {anyWaiting} from '../../../constants/waiting'

const mapStateToProps = state => {
  const accountID = state.wallets.selectedAccount
  const currency = state.wallets.building.currency
  const currencyWaiting = anyWaiting(state, Constants.getDisplayCurrencyWaitingKey(accountID))
  const displayUnit = currencyWaiting ? '' : Constants.getCurrencyAndSymbol(state, currency)
  return {
    accountID,
    bottomLabel: '', // TODO
    displayUnit,
    // TODO differentiate between an asset (7 digits) and a display currency (2 digits) below
    inputPlaceholder: currency && currency !== 'XLM' ? '0.00' : '0.0000000',
    numDecimalsAllowed: currency && currency !== 'XLM' ? 2 : 7,
    topLabel: '', // TODO
    value: state.wallets.building.amount,
  }
}

const mapDispatchToProps = dispatch => ({
  onChangeDisplayUnit: () => {
    dispatch(
      Route.navigateAppend([
        {
          props: {},
          selected: Constants.chooseAssetFormRouteKey,
        },
      ])
    )
  },
  onChangeAmount: (amount: string) => dispatch(WalletsGen.createSetBuildingAmount({amount})),
})

const mergeProps = (stateProps, dispatchProps) => ({
  bottomLabel: stateProps.bottomLabel,
  displayUnit: stateProps.displayUnit,
  inputPlaceholder: stateProps.inputPlaceholder,
  numDecimalsAllowed: stateProps.numDecimalsAllowed,
  onChangeAmount: dispatchProps.onChangeAmount,
  onChangeDisplayUnit: dispatchProps.onChangeDisplayUnit,
  topLabel: stateProps.topLabel,
  value: stateProps.value,
})

export default namedConnect(mapStateToProps, mapDispatchToProps, mergeProps, 'AssetInput')(AssetInput)
