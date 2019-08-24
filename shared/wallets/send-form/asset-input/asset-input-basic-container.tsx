import AssetInputBasic from './asset-input-basic'
import * as WalletsGen from '../../../actions/wallets-gen'
import {namedConnect} from '../../../util/container'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import * as Constants from '../../../constants/wallets'

type OwnProps = {}

const mapStateToProps = state => {
  const {amount, currency} = state.wallets.building
  return {
    bottomLabel: '', // TODO
    currencyLoading: currency === '',
    displayUnit: Constants.getCurrencyAndSymbol(state, currency) || currency,
    // TODO differentiate between an asset (7 digits) and a display currency (2 digits) below
    numDecimalsAllowed: Constants.numDecimalsAllowedForCurrency(currency),
    topLabel: '', // TODO
    value: amount,
  }
}

const mapDispatchToProps = dispatch => ({
  onChangeAmount: (amount: string) => dispatch(WalletsGen.createSetBuildingAmount({amount})),
  onChangeDisplayUnit: () => {
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [
          {
            props: {},
            selected: Constants.chooseAssetFormRouteKey,
          },
        ],
      })
    )
  },
})

const mergeProps = (stateProps, dispatchProps, _: OwnProps) => ({
  bottomLabel: stateProps.bottomLabel,
  currencyLoading: stateProps.currencyLoading,
  displayUnit: stateProps.displayUnit,
  numDecimalsAllowed: stateProps.numDecimalsAllowed,
  onChangeAmount: dispatchProps.onChangeAmount,
  onChangeDisplayUnit: dispatchProps.onChangeDisplayUnit,
  topLabel: stateProps.topLabel,
  value: stateProps.value,
})

export default namedConnect(mapStateToProps, mapDispatchToProps, mergeProps, 'AssetInputBasic')(
  AssetInputBasic
)
