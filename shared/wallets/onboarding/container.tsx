import * as WalletsGen from '../../actions/wallets-gen'
import * as Constants from '../../constants/wallets'
import * as Container from '../../util/container'
import type * as Types from '../../constants/types/wallets'
import {anyErrors} from '../../constants/waiting'
import Onboarding from '.'

type OwnProps = {
  nextScreen: Types.NextScreenAfterAcceptance
}

const ConnectedOnboarding = Container.connect(
  state => {
    const error = anyErrors(state, Constants.acceptDisclaimerWaitingKey)
    const {acceptingDisclaimerDelay} = state.wallets
    return {
      acceptDisclaimerError: error?.message ?? '',
      acceptingDisclaimerDelay: acceptingDisclaimerDelay,
    }
  },
  dispatch => ({
    onAcceptDisclaimer: () => dispatch(WalletsGen.createAcceptDisclaimer()),
    onCheckDisclaimer: (nextScreen: Types.NextScreenAfterAcceptance) =>
      dispatch(WalletsGen.createCheckDisclaimer({nextScreen})),
    onClose: () => dispatch(WalletsGen.createRejectDisclaimer()),
  }),
  (stateProps, dispatchProps, ownProps: OwnProps) => ({
    acceptDisclaimerError: stateProps.acceptDisclaimerError,
    acceptingDisclaimerDelay: stateProps.acceptingDisclaimerDelay,
    nextScreen: ownProps.nextScreen,
    onAcceptDisclaimer: dispatchProps.onAcceptDisclaimer,
    onCheckDisclaimer: dispatchProps.onCheckDisclaimer,
    onClose: dispatchProps.onClose,
  })
)(Onboarding)

// A wrapper to harmonize the type of OwnProps between the
// routed case and <Onboarding /> case.
type RoutedOnboardingProps = Container.RouteProps<'walletOnboarding'>
export const RoutedOnboarding = (ownProps: RoutedOnboardingProps) => (
  <ConnectedOnboarding nextScreen={ownProps.route.params?.nextScreen ?? 'openWallet'} />
)

export default ConnectedOnboarding
