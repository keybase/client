import Qualify from '.'
import * as WalletsGen from '../../../actions/wallets-gen'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import {connect, RouteProps} from '../../../util/container'

type OwnProps = RouteProps

const mapStateToProps = state => ({
  _rows: state.wallets.airdropQualifications,
  state: state.wallets.airdropState,
})

const mapDispatchToProps = dispatch => ({
  onCancel: () => dispatch(RouteTreeGen.createNavigateUp()),
  onLoad: () => dispatch(WalletsGen.createUpdateAirdropState()),
  onSubmit: () => dispatch(WalletsGen.createChangeAirdrop({accept: true})),
})

const injectSmile = rows =>
  rows.length ? [...rows, {subTitle: '', title: 'A beautiful smile', valid: true}] : rows
const mergeProps = (stateProps, dispatchProps, _: OwnProps) => ({
  rows: injectSmile(stateProps._rows.toArray().map(r => r.toObject())),
  state: stateProps.state,
  ...dispatchProps,
})
export default connect(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(Qualify)
