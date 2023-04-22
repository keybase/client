import AssetInputBasic from './asset-input-basic'
import * as WalletsGen from '../../../actions/wallets-gen'
import * as Container from '../../../util/container'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import * as Constants from '../../../constants/wallets'

export default () => {
  const {amount, currency} = Container.useSelector(state => state.wallets.building)
  const bottomLabel = '' // TODO
  const currencyLoading = currency === ''
  const displayUnit = Container.useSelector(
    state => Constants.getCurrencyAndSymbol(state, currency) || currency
  )
  // TODO differentiate between an asset (7 digits) and a display currency (2 digits) below
  const numDecimalsAllowed = Constants.numDecimalsAllowedForCurrency(currency)
  const topLabel = '' // TODO
  const value = amount

  const dispatch = Container.useDispatch()
  const onChangeAmount = (amount: string) => {
    dispatch(WalletsGen.createSetBuildingAmount({amount}))
  }
  const onChangeDisplayUnit = () => {
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [Constants.chooseAssetFormRouteKey],
      })
    )
  }
  const props = {
    bottomLabel: bottomLabel,
    currencyLoading: currencyLoading,
    displayUnit: displayUnit,
    numDecimalsAllowed: numDecimalsAllowed,
    onChangeAmount: onChangeAmount,
    onChangeDisplayUnit: onChangeDisplayUnit,
    topLabel: topLabel,
    value: value,
  }
  return <AssetInputBasic {...props} />
}
