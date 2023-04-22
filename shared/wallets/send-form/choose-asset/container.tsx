import ChooseAsset, {type DisplayItem} from '.'
import * as Container from '../../../util/container'
import * as WalletsGen from '../../../actions/wallets-gen'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import * as Constants from '../../../constants/wallets'
import * as Types from '../../../constants/types/wallets'

export default () => {
  const accountID = Container.useSelector(state => state.wallets.selectedAccount)
  const to = Container.useSelector(state => state.wallets.building.to)
  const selected = Container.useSelector(state => state.wallets.building.currency)
  const currencies = Container.useSelector(state => Constants.getDisplayCurrencies(state))
  const isRequest = Container.useSelector(state => state.wallets.building.isRequest)

  const dispatch = Container.useDispatch()
  const _onChoose = (currency: string) => {
    dispatch(WalletsGen.createSetBuildingCurrency({currency}))
    dispatch(RouteTreeGen.createNavigateUp())
  }
  const _onRefresh = (accountID: Types.AccountID, to: string) => {
    dispatch(WalletsGen.createLoadDisplayCurrencies())
    accountID !== Types.noAccountID && dispatch(WalletsGen.createLoadSendAssetChoices({from: accountID, to}))
  }
  const onBack = () => {
    dispatch(RouteTreeGen.createNavigateUp())
  }
  const props = {
    displayChoices: (currencies || []).map(c => ({
      currencyCode: c.code,
      selected: c.code === selected,
      symbol: c.symbol,
      type: 'display choice' as const,
    })),
    isRequest: isRequest,
    onBack: onBack,
    onChoose: (item: DisplayItem) => _onChoose(item.currencyCode),
    onRefresh: () => _onRefresh(accountID, to),
    selected: selected,
  }
  return <ChooseAsset {...props} />
}
