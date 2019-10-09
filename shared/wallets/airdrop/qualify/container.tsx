import Qualify from '.'
import * as Types from '../../../constants/types/wallets'
import * as WalletsGen from '../../../actions/wallets-gen'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import * as Container from '../../../util/container'

const mapStateToProps = (state: Container.TypedState) => ({
  _rows: state.wallets.airdropQualifications,
  state: state.wallets.airdropState,
})

const mapDispatchToProps = (dispatch: Container.TypedDispatch) => ({
  onCancel: () => dispatch(RouteTreeGen.createNavigateUp()),
  onLoad: () => dispatch(WalletsGen.createUpdateAirdropState()),
  onSubmit: () => dispatch(WalletsGen.createChangeAirdrop({accept: true})),
})

const injectSmile = (rows: Array<Types._AirdropQualification>) =>
  rows.length ? [...rows, {subTitle: '', title: 'A beautiful smile', valid: true}] : rows

export default Container.connect(mapStateToProps, mapDispatchToProps, (stateProps, dispatchProps) => ({
  rows: injectSmile(stateProps._rows.toArray().map(r => r.toObject())),
  state: stateProps.state,
  ...dispatchProps,
}))(Qualify)
