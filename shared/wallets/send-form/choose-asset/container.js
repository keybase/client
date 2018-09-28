// @flow
import ChooseAsset, {type Props, type DisplayItem, type OtherItem} from '.'
import {compose, connect, lifecycle, setDisplayName, type TypedState} from '../../../util/container'
import * as WalletsGen from '../../../actions/wallets-gen'
import * as Constants from '../../../constants/wallets'
import {navigateUp} from '../../../actions/route-tree'

const mapStateToProps = (state: TypedState) => {
  const accountID = state.selectedAccount
  const currencies = Constants.getDisplayCurrencies(state)
  const selected = Constants.getDisplayCurrency(state, accountID)

  return {
    displayChoices: (currencies || []).map(c => ({
      currencyCode: c.code,
      selected: c.code === selected.currencyCode,
      symbol: c.symbol,
      type: 'display choice',
      })),
      otherChoices: [], // todo
    }
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
  _refresh: () => {
    dispatch(WalletsGen.createLoadDisplayCurrencies())
//    dispatch(WalletsGen.createLoadDisplayCurrency({accounID: routeProps.get('accountID')}))
  },
  _onClose: () => {
    dispatch(navigateUp()
    )
  },
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  ...stateProps,
  ...ownProps,
  refresh: () => dispatchProps._refresh(),
  onBack: () => dispatchProps._onClose(),
  onChoose: (item: DisplayItem | OtherItem) => dispatchProps._onClose(),
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
