// @flow
import Airdrop from '.'
import * as WalletsGen from '../../actions/wallets-gen'
import {connect, type RouteProps} from '../../util/container'

type OwnProps = RouteProps<{}, {}>

const mapStateToProps = state => ({
  _body: state.wallets.airdropProgramInfo,
  loading: state.wallets.airdropState === 'loading',
  signedUp: state.wallets.airdropState === 'accepted',
})

const mapDispatchToProps = (dispatch, {navigateAppend, navigateUp}) => ({
  onBack: () => dispatch(navigateUp()),
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
  loading: stateProps.loading,
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
