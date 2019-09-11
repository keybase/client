import * as React from 'react'
import Airdrop, {Props as AirdropProps} from '.'
import * as WalletsGen from '../../actions/wallets-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Container from '../../util/container'
import Onboarding from '../onboarding/container'

const mapStateToProps = (state: Container.TypedState) => ({
  _details: state.wallets.airdropDetails.details,
  acceptedDisclaimer: state.wallets.acceptedDisclaimer,
  loading: state.wallets.airdropState === 'loading',
  signedUp: state.wallets.airdropState === 'accepted',
})

const mapDispatchToProps = (dispatch: Container.TypedDispatch) => ({
  onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
  onCheckQualify: () => dispatch(RouteTreeGen.createNavigateAppend({path: ['airdropQualify']})),
  onLoad: () => {
    dispatch(WalletsGen.createUpdateAirdropState())
    dispatch(WalletsGen.createUpdateAirdropDetails())
  },
  onReject: () => dispatch(WalletsGen.createChangeAirdrop({accept: false})),
})

export type Props = AirdropProps & {acceptedDisclaimer: boolean}
const AirdropOrOnboarding = (props: Props) =>
  props.acceptedDisclaimer ? <Airdrop {...props} /> : <Onboarding nextScreen="airdrop" />

const ConnectedAirdrop = Container.connect(
  mapStateToProps,
  mapDispatchToProps,
  (stateProps, dispatchProps) => ({
    acceptedDisclaimer: stateProps.acceptedDisclaimer,
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
)(AirdropOrOnboarding)

export default ConnectedAirdrop
