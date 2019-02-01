// @flow
import Qualify from '.'
import * as WalletsGen from '../../../actions/wallets-gen'
import {connect, type RouteProps} from '../../../util/container'

type OwnProps = RouteProps<{}, {}>

const mapStateToProps = state => ({
  _rows: state.wallets.airdropQualifications,
  state: state.wallets.airdropState,
})

const mapDispatchToProps = (dispatch, {navigateUp}) => ({
  onCancel: () => dispatch(navigateUp()),
  onLoad: () => dispatch(WalletsGen.createUpdateAirdropState()),
  onSubmit: () => {
    dispatch(WalletsGen.createChangeAirdrop({accept: true}))
    dispatch(navigateUp())
  },
})

const injectSmile = rows =>
  rows.length ? [...rows, {subTitle: '😁', title: 'A beautiful smile', valid: true}] : rows

const mergeProps = (stateProps, dispatchProps) => ({
  rows: injectSmile(stateProps._rows.toArray().map(r => r.toObject())),
  state: stateProps.state,
  ...dispatchProps,
})

export default connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(Qualify)
