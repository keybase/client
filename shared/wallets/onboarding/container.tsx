import * as Container from '../../util/container'
import * as WalletsGen from '../../actions/wallets-gen'
import * as Constants from '../../constants/wallets'
import * as Types from '../../constants/types/wallets'
import {anyErrors} from '../../constants/waiting'
import Onboarding from '.'

type OwnProps = {
  onboardingReason?: '' | 'airdrop'
}

const mapStateToProps = state => {
  const error = anyErrors(state, Constants.acceptDisclaimerWaitingKey)
  return {
    acceptDisclaimerError: error && error.message ? error.message : '',
    acceptingDisclaimerDelay: state.wallets.acceptingDisclaimerDelay,
  }
}

const mapDispatchToProps = (dispatch: Container.TypedDispatch, ownProps: OwnProps) => {
  const onboardingReason =
    ownProps.onboardingReason || Container.getRouteProps(ownProps, 'onboardingReason', '')
  return {
    onAcceptDisclaimer: () => dispatch(WalletsGen.createAcceptDisclaimer({reason: onboardingReason || ''})),
    onCheckDisclaimer: (nextScreen: Types.NextScreenAfterAcceptance) => {
      if (nextScreen === 'openWallet' && onboardingReason === 'airdrop') {
        nextScreen = 'airdrop'
      }
      dispatch(WalletsGen.createCheckDisclaimer({nextScreen}))
    },
    onClose: () => dispatch(WalletsGen.createRejectDisclaimer()),
    onboardingReason: onboardingReason,
  }
}

const mergeProps = (stateProps, dispatchProps, ownProps: OwnProps) => ({
  acceptDisclaimerError: stateProps.acceptDisclaimerError,
  acceptingDisclaimerDelay: stateProps.acceptingDisclaimerDelay,
  onAcceptDisclaimer: dispatchProps.onAcceptDisclaimer,
  onCheckDisclaimer: dispatchProps.onCheckDisclaimer,
  onClose: dispatchProps.onClose,
  onboardingReason: dispatchProps.onboardingReason,
})

export default Container.connect(mapStateToProps, mapDispatchToProps, mergeProps)(Onboarding)
