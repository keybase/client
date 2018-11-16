// @flow
import ChooseAsset, {type DisplayItem, type OtherItem} from '.'
import {namedConnect, type RouteProps} from '../../../util/container'
import * as WalletsGen from '../../../actions/wallets-gen'
import * as Constants from '../../../constants/wallets'
import * as Types from '../../../constants/types/wallets'

type OwnProps = RouteProps<{}, {}>

const mapStateToProps = state => {
  const accountID = state.wallets.selectedAccount
  const to = state.wallets.building.to
  const selected = state.wallets.building.currency

  return {
    accountID,
    currencies: Constants.getDisplayCurrencies(state).toArray(),
    selected,
    sendAssets: state.wallets.building.sendAssetChoices,
    to,
  }
}

const mapDispatchToProps = (dispatch, {navigateUp, onBack}: OwnProps) => ({
  _onChoose: (currency: string) => {
    dispatch(WalletsGen.createSetBuildingCurrency({currency}))
    dispatch(navigateUp())
  },
  _onRefresh: (accountID: Types.AccountID, to: string) => {
    dispatch(WalletsGen.createLoadDisplayCurrencies())
    accountID !== Types.noAccountID && dispatch(WalletsGen.createLoadSendAssetChoices({from: accountID, to}))
  },
  onBack: () => dispatch(navigateUp()),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  displayChoices: (stateProps.currencies || []).map(c => ({
    currencyCode: c.code,
    selected: c.code === stateProps.selected,
    symbol: c.symbol,
    type: 'display choice',
  })),
  onBack: dispatchProps.onBack,
  onChoose: (item: DisplayItem | OtherItem) => dispatchProps._onChoose(item.currencyCode),
  onRefresh: () => dispatchProps._onRefresh(stateProps.accountID, stateProps.to),
  otherChoices: (stateProps.sendAssets || []).map(a => ({
    currencyCode: a.asset.code,
    disabledExplanation: a.subtext || 'Support for other assets coming soon',
    issuer: a.asset.issuer,
    selected: a.asset.code === stateProps.selected,
    type: 'other choice',
  })),
  selected: stateProps.selected,
})

export default namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'ChooseAsset'
)(ChooseAsset)
