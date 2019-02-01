// @flow
import Airdrop from '.'
import * as WalletsGen from '../../actions/wallets-gen'
import {connect, type RouteProps} from '../../util/container'

type OwnProps = RouteProps<{}, {}>

const mapStateToProps = state => ({
  _details: state.wallets.airdropDetails,
  loading: state.wallets.airdropState === 'loading',
  signedUp: state.wallets.airdropState === 'accepted',
})

const mapDispatchToProps = (dispatch, {navigateAppend, navigateUp}) => ({
  onBack: () => dispatch(navigateUp()),
  onCheckQualify: () => dispatch(navigateAppend(['airdropQualify'])),
  onLoad: () => {
    dispatch(WalletsGen.createUpdateAirdropState())
    dispatch(WalletsGen.createUpdateAirdropDetails())
  },
  onReject: () => dispatch(WalletsGen.createChangeAirdrop({accept: false})),
})

const mergeProps = (stateProps, dispatchProps) => ({
  headerBody: stateProps._details.header.body,
  headerTitle: stateProps._details.header.title,
  loading: stateProps.loading,
  onBack: dispatchProps.onBack,
  onCheckQualify: dispatchProps.onCheckQualify,
  onLoad: dispatchProps.onLoad,
  onReject: dispatchProps.onReject,
  sections: stateProps._details.sections.toArray().map(s => ({
    icon: s.icon,
    lines: s.lines.toArray().map(l => ({
      bullet: l.bullet,
      text: l.text,
    })),
    section: s.section,
  })),
  signedUp: stateProps.signedUp,
})

export default connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(Airdrop)
