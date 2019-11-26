import ChooseAsset, {DisplayItem} from '.'
import * as Container from '../../../util/container'
import * as WalletsGen from '../../../actions/wallets-gen'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import * as Constants from '../../../constants/wallets'
import * as Types from '../../../constants/types/wallets'

type OwnProps = Container.RouteProps

const mapStateToProps = state => {
  const accountID = state.wallets.selectedAccount
  const to = state.wallets.building.to
  const selected = state.wallets.building.currency

  return {
    accountID,
    currencies: Constants.getDisplayCurrencies(state),
    isRequest: state.wallets.building.isRequest,
    selected,
    to,
  }
}

const mapDispatchToProps = dispatch => ({
  _onChoose: (currency: string) => {
    dispatch(WalletsGen.createSetBuildingCurrency({currency}))
    dispatch(RouteTreeGen.createNavigateUp())
  },
  _onRefresh: (accountID: Types.AccountID, to: string) => {
    dispatch(WalletsGen.createLoadDisplayCurrencies())
    accountID !== Types.noAccountID && dispatch(WalletsGen.createLoadSendAssetChoices({from: accountID, to}))
  },
  onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
})

const mergeProps = (stateProps, dispatchProps, _: OwnProps) => ({
  displayChoices: (stateProps.currencies || []).map(c => ({
    currencyCode: c.code,
    selected: c.code === stateProps.selected,
    symbol: c.symbol,
    type: 'display choice',
  })),
  isRequest: stateProps.isRequest,
  onBack: dispatchProps.onBack,
  onChoose: (item: DisplayItem) => dispatchProps._onChoose(item.currencyCode),
  onRefresh: () => dispatchProps._onRefresh(stateProps.accountID, stateProps.to),
  selected: stateProps.selected,
})

export default Container.namedConnect(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'ChooseAsset'
)(ChooseAsset)
