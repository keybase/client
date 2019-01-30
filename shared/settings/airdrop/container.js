// @flow
import Airdrop from '.'
import * as WalletsGen from '../../actions/wallets-gen'
import {connect, type RouteProps} from '../../util/container'

type OwnProps = RouteProps<{}, {}>

const mapStateToProps = state => ({
  _body: state.wallets.airdropProgramInfo,
  signedUp: state.wallets.airdropState === 'accepted',
})

const mapDispatchToProps = (dispatch, {navigateAppend, navigateUp}) => ({
  onBack: () => dispatch(navitateUp()),
  onCheckQualify: () => dispatch(navigateAppend(['airdropQualify'])),
  onReject: () => dispatch(WalletsGen.createChangeAirdrop({accept: false})),
})

const mergeProps = (stateProps, dispatchProps) => ({
  body: stateProps._body.toArray().map(b => ({
    lines: b.lines.toArray().map(l => ({
      bullet: l.bullet,
      text: l.text,
    })),
    section: b.section,
  })),
  onBack: dispatchProps.onBack,
  onCheckQualify: dispatchProps.onCheckQualify,
  onReject: dispatchProps.onReject,
  signedUp: stateProps.signedUp,
})

export default connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(Airdrop)
