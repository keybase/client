// @flow
import AssetInput from '.'
import * as WalletsGen from '../../../actions/wallets-gen'
import {compose, connect, setDisplayName, type TypedState} from '../../../util/container'
import * as Route from '../../../actions/route-tree'
import * as Constants from '../../../constants/wallets'

const mapStateToProps = (state: TypedState) => ({
  displayUnit: state.wallets.buildingPayment.currency,
  inputPlaceholder: '0.00',
  bottomLabel: '', // TODO
  topLabel: '', // TODO
  value: state.wallets.buildingPayment.amount,
})

const mapDispatchToProps = (dispatch: Dispatch) => ({
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

export default compose(
  connect(mapStateToProps, mapDispatchToProps, (s, d, o) => ({...o, ...s, ...d})),
  setDisplayName('AssetInput')
)(AssetInput)
