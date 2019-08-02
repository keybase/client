import * as React from 'react'
import WalletsAndDetails from '.'
import Onboarding from '../onboarding/container'
import * as Container from '../../util/container'

type OwnProps = {
  children: React.ReactNode
  onboardingReason: '' | 'airdrop'
}

type Props = {
  acceptedDisclaimer: boolean
  children: React.ReactNode
  onboardingReason: '' | 'airdrop'
}

const mapStateToProps = (state: Container.TypedState, ownProps: OwnProps) => {
  return {
    onboardingReason: ownProps.onboardingReason || '', // does this need optionally to come from a routeprop?
    acceptedDisclaimer: state.wallets.acceptedDisclaimer,
  }
}

const WalletsOrOnboarding = (props: Props) =>
  props.acceptedDisclaimer ? (
    <WalletsAndDetails>{props.children}</WalletsAndDetails>
  ) : (
    <Onboarding onboardingReason={props.onboardingReason} />
  )

export default Container.connect(
  mapStateToProps,
  () => ({}),
  (stateProps, _, ownProps: OwnProps) => ({
    onboardingReason: stateProps.onboardingReason,
    acceptedDisclaimer: stateProps.acceptedDisclaimer,
    children: ownProps.children,
  })
)(WalletsOrOnboarding)
