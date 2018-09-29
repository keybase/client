// @flow
import ChooseAsset, {type Props, type DisplayItem, type OtherItem} from '.'
import {compose, connect, lifecycle, setDisplayName, type TypedState} from '../../../util/container'
import * as WalletsGen from '../../../actions/wallets-gen'
import * as Constants from '../../../constants/wallets'
import {navigateUp} from '../../../actions/route-tree'
import * as Types from '../../../constants/types/wallets'

const mapStateToProps = (state: TypedState) => {
  const accountID = state.wallets.selectedAccount
  const to = state.wallets.buildingPayment.to
  const currencies = Constants.getDisplayCurrencies(state).toArray()
  const selected = state.wallets.buildingPayment.currency
  const sendAssets = state.wallets.buildingPayment.sendAssetChoices

  return {
    displayChoices: (currencies || []).map(c => ({
      currencyCode: c.code,
      selected: c.code === selected,
      symbol: c.symbol,
      type: 'display choice',
      })),
    otherChoices: (sendAssets || []).map(a => ({
      code: a.asset.code,
      selected: a.asset.code === selected,
      disabledExplanation: a.subtext,
      issuer: a.asset.issuer,
      type: 'other choice',
      })),
    accountID,
    to,
    selected,
    }
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
  _refresh: (accountID: Types.AccountID, to: String) => {
    dispatch(WalletsGen.createLoadDisplayCurrencies())
    dispatch(WalletsGen.createLoadSendAssetChoices({from: accountID, to}))
    dispatch(WalletsGen.createLoadDisplayCurrency({accountID}))
  },
  _onClose: () => {
    dispatch(navigateUp())
  },
  _onChoose: (currency: String) => {
      dispatch(WalletsGen.createSetBuildingCurrency({currency}))
      dispatch(navigateUp())
  },
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  ...stateProps,
  ...ownProps,
  refresh: () => dispatchProps._refresh(stateProps.accountID, stateProps.to),
  onBack: () => dispatchProps._onClose(),
  onClose: () => dispatchProps._onClose(),
  onChoose: (item: DisplayItem | OtherItem) => dispatchProps._onChoose(item.currencyCode),
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  lifecycle({
    componentDidMount() {
      this.props.refresh()
    },
  }),
  setDisplayName('ChooseAsset')
)(ChooseAsset)
