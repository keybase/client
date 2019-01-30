// @flow
import Qualify from '.'
import * as WalletsGen from '../../../actions/wallets-gen'
import {connect, type RouteProps} from '../../../util/container'

type OwnProps = RouteProps<{}, {}>

const mapStateToProps = state => ({
  _rows: state.wallets.airdropQualifications,
  state: state.wallets.airdropQualifiedState,
})

const mapDispatchToProps = (dispatch, {navigateUp}) => ({
  onCancel: () => dispatch(navigateUp()),
  onSubmit: () => dispatch(WalletsGen.createChangeAirdrop({accept: true})),
})

const mergeProps = (stateProps, dispatchProps) => ({
  rows: stateProps._rows.toArray().map(r => r.toObject()),
  state: stateProps.state,
  ...dispatchProps,
})

export default connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(Qualify)
