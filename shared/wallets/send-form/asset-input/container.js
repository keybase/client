// @flow
import AssetInput from '.'
import * as WalletsGen from '../../../actions/wallets-gen'
import {compose, connect, setDisplayName} from '../../../util/container'
import * as Route from '../../../actions/route-tree'
import * as Constants from '../../../constants/wallets'

const mapStateToProps = state => {
  const currency = state.wallets.building.currency
  const displayUnit = Constants.getCurrencyAndSymbol(state, currency)
  return {
    displayUnit,
    inputPlaceholder: currency && currency !== 'XLM' ? '0.00' : '0.0000000',
    bottomLabel: '', // TODO
    topLabel: '', // TODO
    value: state.wallets.building.amount,
  }
}

const mapDispatchToProps = dispatch => ({
  refresh: () => dispatch(WalletsGen.createLoadDisplayCurrencies()),
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
  ...stateProps,
  ...dispatchProps,
  ...ownProps,
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  setDisplayName('AssetInput')
)(AssetInput)
