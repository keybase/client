// @flow
import Airdrop from '.'
import * as WalletsGen from '../../actions/wallets-gen'
import {connect, type RouteProps} from '../../util/container'

type OwnProps = RouteProps<{}, {}>

const mapStateToProps = state => ({
  _body: state.wallets.airdropProgramInfo,
  signedUp: state.wallets.airdropState === 'accepted',
})

const mapDispatchToProps = (dispatch, {navigateAppend}) => ({
  onCheckQualify: () => dispatch(navigateAppend(['airdropQualify'])),
  onReject: () => dispatch(WalletsGen.createChangeAirdrop({accept: false})),
})

const mergeProps = (stateProps, dispatchProps) => ({
  body: stateProps._body.toArray().map(b => ({
    lines: b.lines.toArray(),
    section: b.section,
  })),
  onCheckQualify: dispatchProps.onCheckQualify,
  onReject: dispatchProps.onReject,
  signedUp: stateProps.signedUp,
})

export default connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(Airdrop)
