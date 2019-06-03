import Airdrop from '.'
import * as WalletsGen from '../../actions/wallets-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Container from '../../util/container'

type OwnProps = Container.RouteProps<{}, {}>

const mapStateToProps = state => ({
  _details: state.wallets.airdropDetails,
  loading: state.wallets.airdropState === 'loading',
  signedUp: state.wallets.airdropState === 'accepted',
})

const mapDispatchToProps = dispatch => ({
  onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
  onCheckQualify: () => dispatch(RouteTreeGen.createNavigateAppend({path: ['airdropQualify']})),
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
  title: 'Airdrop',
})

export default Container.connect(mapStateToProps, mapDispatchToProps, mergeProps)(Airdrop)
