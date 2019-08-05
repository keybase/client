import * as React from 'react'
import * as WalletsGen from '../../actions/wallets-gen'
import * as Constants from '../../constants/wallets'
import * as Container from '../../util/container'
import * as Types from '../../constants/types/wallets'
import {anyErrors} from '../../constants/waiting'
import Onboarding from '.'

type OwnProps = {
  nextScreen: Types.NextScreenAfterAcceptance
}

const mapStateToProps = (state: Container.TypedState) => {
  const error = anyErrors(state, Constants.acceptDisclaimerWaitingKey)
  return {
    _disclaimer: state.wallets.airdropDetails.disclaimer,
    acceptDisclaimerError: error && error.message ? error.message : '',
    acceptingDisclaimerDelay: state.wallets.acceptingDisclaimerDelay,
  }
}

const mapDispatchToProps = (dispatch: Container.TypedDispatch) => ({
  onAcceptDisclaimer: () => dispatch(WalletsGen.createAcceptDisclaimer()),
  onCheckDisclaimer: (nextScreen: Types.NextScreenAfterAcceptance) =>
    dispatch(WalletsGen.createCheckDisclaimer({nextScreen})),
  onClose: () => dispatch(WalletsGen.createRejectDisclaimer()),
  onLoadDetails: () => dispatch(WalletsGen.createUpdateAirdropDetails()),
})

const ConnectedOnboarding = Container.connect(
  mapStateToProps,
  mapDispatchToProps,
  (stateProps, dispatchProps, ownProps: OwnProps) => ({
    acceptDisclaimerError: stateProps.acceptDisclaimerError,
    acceptingDisclaimerDelay: stateProps.acceptingDisclaimerDelay,
    headerBody: stateProps._disclaimer.header.body,
    headerTitle: stateProps._disclaimer.header.title,
    nextScreen: ownProps.nextScreen,
    onAcceptDisclaimer: dispatchProps.onAcceptDisclaimer,
    onCheckDisclaimer: dispatchProps.onCheckDisclaimer,
    onClose: dispatchProps.onClose,
    onLoadDetails: dispatchProps.onLoadDetails,
    sections: stateProps._disclaimer.sections.toArray().map(s => ({
      icon: s.icon,
      lines: s.lines.toArray().map(l => ({
        bullet: l.bullet,
        text: l.text,
      })),
      section: s.section,
    })),
  })
)(Onboarding)

// A wrapper to harmonize the type of OwnProps between the
// routed case and <Onboarding /> case.
type RoutedOnboardingProps = Container.RouteProps<OwnProps>
export const RoutedOnboarding = (ownProps: RoutedOnboardingProps) => (
  <ConnectedOnboarding nextScreen={Container.getRouteProps(ownProps, 'nextScreen', 'openWallet')} />
)

export default ConnectedOnboarding
