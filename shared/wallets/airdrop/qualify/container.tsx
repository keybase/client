import Qualify from '.'
import * as Types from '../../../constants/types/wallets'
import * as WalletsGen from '../../../actions/wallets-gen'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import * as Container from '../../../util/container'

const injectSmile = (rows: Array<Types.AirdropQualification>) =>
  rows.length ? [...rows, {subTitle: '', title: 'A beautiful smile', valid: true}] : rows

export default Container.connect(
  state => ({
    _rows: state.wallets.airdropQualifications,
    state: state.wallets.airdropState,
  }),
  dispatch => ({
    onCancel: () => dispatch(RouteTreeGen.createNavigateUp()),
    onLoad: () => dispatch(WalletsGen.createUpdateAirdropState()),
    onSubmit: () => dispatch(WalletsGen.createChangeAirdrop({accept: true})),
  }),
  (stateProps, dispatchProps) => ({
    rows: injectSmile(stateProps._rows),
    state: stateProps.state,
    ...dispatchProps,
  })
)(Qualify)
