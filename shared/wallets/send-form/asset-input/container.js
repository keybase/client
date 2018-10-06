// @flow
import AssetInput from '.'
import * as WalletsGen from '../../../actions/wallets-gen'
import {compose, connect, lifecycle, setDisplayName, type TypedState} from '../../../util/container'
import * as Route from '../../../actions/route-tree'
import * as Constants from '../../../constants/wallets'

const mapStateToProps = (state: TypedState) => {
  const displayUnit = Constants.getCurrencyAndSymbol(state, state.wallets.buildingPayment.currency)
  return {
    displayUnit,
    inputPlaceholder: '0.00',
    bottomLabel: '', // TODO
    topLabel: '', // TODO
    value: state.wallets.buildingPayment.amount,
  }
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
  _refresh: () => dispatch(WalletsGen.createLoadDisplayCurrencies()),
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
  onClickInfo: () => {}, // TODO
  onChangeAmount: (amount: string) => dispatch(WalletsGen.createSetBuildingAmount({amount})),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  ...stateProps,
  ...dispatchProps,
  ...ownProps,
  refresh: () => dispatchProps._refresh(),
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  setDisplayName('AssetInput'),
)(AssetInput)
