// @flow
import ChooseAsset, {type DisplayItem, type OtherItem} from '.'
import {compose, namedConnect, lifecycle} from '../../../util/container'
import * as WalletsGen from '../../../actions/wallets-gen'
import * as Constants from '../../../constants/wallets'
import * as Types from '../../../constants/types/wallets'
import type {NavigateUpPayload} from '../../../actions/route-tree-gen'

type OwnProps = {
  navigateUp?: () => NavigateUpPayload, // if routed
  onBack?: () => void, // if direct
}

const mapStateToProps = state => {
  const accountID = state.wallets.selectedAccount
  const to = state.wallets.building.to
  const selected = state.wallets.building.currency

  return {
    accountID,
    to,
    selected,
    currencies: Constants.getDisplayCurrencies(state).toArray(),
    sendAssets: state.wallets.building.sendAssetChoices,
  }
}

const mapDispatchToProps = (dispatch, {navigateUp, onBack}: OwnProps) => ({
  _refresh: (accountID: Types.AccountID, to: string) => {
    dispatch(WalletsGen.createLoadDisplayCurrencies())
    dispatch(WalletsGen.createLoadSendAssetChoices({from: accountID, to}))
  },
  _onClose: () => {
    if (navigateUp) {
      dispatch(navigateUp())
    } else {
      onBack && onBack()
    }
  },
  _onChoose: (currency: string) => {
    dispatch(WalletsGen.createSetBuildingCurrency({currency}))
    if (navigateUp) {
      dispatch(navigateUp())
    } else {
      onBack && onBack()
    }
  },
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  ...stateProps,
  ...ownProps,
  displayChoices: (stateProps.currencies || []).map(c => ({
    currencyCode: c.code,
    selected: c.code === stateProps.selected,
    symbol: c.symbol,
    type: 'display choice',
  })),
  otherChoices: (stateProps.sendAssets || []).map(a => ({
    currencyCode: a.asset.code,
    selected: a.asset.code === stateProps.selected,
    disabledExplanation: a.subtext || 'Support for other assets coming soon',
    issuer: a.asset.issuer,
    type: 'other choice',
  })),
  refresh: () => dispatchProps._refresh(stateProps.accountID, stateProps.to),
  onBack: () => dispatchProps._onClose(),
  onClose: () => dispatchProps._onClose(),
  onChoose: (item: DisplayItem | OtherItem) => dispatchProps._onChoose(item.currencyCode),
})

export default compose(
  namedConnect(mapStateToProps, mapDispatchToProps, mergeProps, 'ChooseAsset'),
  lifecycle({
    componentDidMount() {
      this.props.refresh()
    },
  })
)(ChooseAsset)
