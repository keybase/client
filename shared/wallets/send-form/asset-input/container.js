// @flow
import AssetInput from '.'
import * as WalletsGen from '../../../actions/wallets-gen'
import {compose, connect, setDisplayName} from '../../../util/container'
import * as Route from '../../../actions/route-tree'
import * as Constants from '../../../constants/wallets'

const mapStateToProps = state => {
  const accountID = state.wallets.selectedAccount
  const currency = state.wallets.building.currency

  const displayUnit = Constants.getCurrencyAndSymbol(state, currency)
  return {
    accountID,
    bottomLabel: '', // TODO
    displayUnit,
    inputPlaceholder: currency && currency !== 'XLM' ? '0.00' : '0.0000000',
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

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  bottomLabel: stateProps.bottomLabel,
  displayUnit: stateProps.displayUnit,
  inputPlaceholder: stateProps.inputPlaceholder,
  onChangeAmount: dispatchProps.onChangeAmount,
  onChangeDisplayUnit: ownProps.onChooseAsset || dispatchProps.onChangeDisplayUnit,
  topLabel: stateProps.topLabel,
  value: stateProps.value,
})

export default compose(
  connect(
    mapStateToProps,
    mapDispatchToProps,
    mergeProps
  ),
  setDisplayName('AssetInput')
)(AssetInput)
