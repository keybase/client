// @flow
import AssetInput from '.'
import * as WalletsGen from '../../../actions/wallets-gen'
import {compose, connect, setDisplayName, type TypedState, type Dispatch} from '../../../util/container'

const mapStateToProps = (state: TypedState) => ({
  displayUnit: state.wallets.buildingPayment.currency,
  inputPlaceholder: '0.00',
  bottomLabel: '', // TODO
  topLabel: '', // TODO
})

const mapDispatchToProps = (dispatch: Dispatch) => ({
  onChangeDisplayUnit: () => {}, // TODO
  onClickInfo: () => {}, // TODO
  onChangeAmount: (amount: string) => dispatch(WalletsGen.createSetBuildingAmount({amount})),
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps, (s, d, o) => ({...s, ...d, ...o})),
  setDisplayName('AssetInput')
)(AssetInput)
