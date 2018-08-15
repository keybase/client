// @flow
import AssetInput from '.'
import * as WalletsGen from '../../../actions/wallets-gen'
import {compose, connect, setDisplayName, type TypedState, type Dispatch} from '../../../util/container'

const mapStateToProps = (state: TypedState) => ({
  displayUnit: state.wallets.get('buildingPayment').get('currency'),
  // warningAsset
  // warningPayee
})

const mapDispatchToProps = (dispatch: Dispatch) => ({
  inputPlaceholder: '0.00',
  onChangeAmount: (amount: string) => dispatch(WalletsGen.createSetBuildingAmount({amount})),
})

export default compose(connect(mapStateToProps, mapDispatchToProps), setDisplayName('AssetInput'))(AssetInput)
