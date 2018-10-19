// @flow
import AssetInput from '.'
import * as WalletsGen from '../../../actions/wallets-gen'
import {compose, connect, setDisplayName} from '../../../util/container'
import * as Route from '../../../actions/route-tree'
import * as Constants from '../../../constants/wallets'
import * as Types from '../../../constants/types/wallets'

const mapStateToProps = state => {
  const accountID = state.wallets.selectedAccount
  const currency = state.wallets.building.currency
  const displayUnit = Constants.getCurrencyAndSymbol(state, currency || 'XLM' )
  const defaultCurrencyCode = state.wallets.lastSentXLM ? 'XLM' : Constants.getDisplayCurrency(state, accountID).code
  return {
    accountID,
    bottomLabel: '', // TODO
    currency,
    defaultCurrencyCode,
    displayUnit,
    inputPlaceholder: currency && currency !== 'XLM' ? '0.00' : '0.0000000',
    topLabel: '', // TODO
    value: state.wallets.building.amount,
  }
}

const mapDispatchToProps = dispatch => ({
  _refresh: (accountID: Types.AccountID) => {
    dispatch(WalletsGen.createLoadDisplayCurrencies())
    dispatch(WalletsGen.createLoadDisplayCurrency({accountID}))
  },
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
  _onSetCurrency: (currency: string) => dispatch(WalletsGen.createSetBuildingCurrency({currency})),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  bottomLabel: stateProps.bottomLabel,
  defaultCurrencyCode: stateProps.defaultCurrencyCode,
  displayUnit: stateProps.displayUnit,
  inputPlaceholder: stateProps.inputPlaceholder,
  onChangeAmount: dispatchProps.onChangeAmount,
  onChangeDisplayUnit: dispatchProps.onChangeDisplayUnit,
  refresh: () => dispatchProps._refresh(stateProps.accountID),
  topLabel: stateProps.topLabel,
  value: stateProps.value,
  onSetCurrency: () => {
    // This is because we have to wait for createLoadDisplayCurrency.
    // Only called before the user changes the currency selection.
    !stateProps.currency && stateProps.defaultCurrencyCode &&
      dispatchProps._onSetCurrency(stateProps.defaultCurrencyCode)
  }
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  setDisplayName('AssetInput')
)(AssetInput)
