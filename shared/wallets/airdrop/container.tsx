import * as React from 'react'
import Airdrop, {Props as AirdropProps} from '.'
import * as WalletsGen from '../../actions/wallets-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Container from '../../util/container'
import Onboarding from '../onboarding/container'

const mapStateToProps = (state: Container.TypedState) => {
  const {acceptedDisclaimer, airdropDetails, airdropState} = state.wallets
  const {details} = airdropDetails
  return {
    acceptedDisclaimer,
    headerBody: details.header.body,
    headerTitle: details.header.title,
    loading: airdropState === 'loading',
    sections: details.sections,
    signedUp: airdropState === 'accepted',
  }
}

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
    headerBody: stateProps.headerBody,
    headerTitle: stateProps.headerTitle,
    loading: stateProps.loading,
    onBack: dispatchProps.onBack,
    onCheckQualify: dispatchProps.onCheckQualify,
    onLoad: dispatchProps.onLoad,
    onReject: dispatchProps.onReject,
    sections: stateProps.sections,
    signedUp: stateProps.signedUp,
    title: 'Airdrop',
  })
)(AirdropOrOnboarding)

export default ConnectedAirdrop
