import * as WalletsGen from '../../actions/wallets-gen'
import * as Constants from '../../constants/wallets'
import * as Container from '../../util/container'
import type * as Types from '../../constants/types/wallets'
import Onboarding from '.'

type OwnProps = {
  nextScreen: Types.NextScreenAfterAcceptance
}

const ConnectedOnboarding = (ownProps: OwnProps) => {
  const error = Container.useAnyErrors(Constants.acceptDisclaimerWaitingKey)
  const {acceptingDisclaimerDelay} = Container.useSelector(state => state.wallets)
  const acceptDisclaimerError = error?.message ?? ''

  const dispatch = Container.useDispatch()
  const onAcceptDisclaimer = () => {
    dispatch(WalletsGen.createAcceptDisclaimer())
  }
  const onCheckDisclaimer = (nextScreen: Types.NextScreenAfterAcceptance) => {
    dispatch(WalletsGen.createCheckDisclaimer({nextScreen}))
  }
  const onClose = () => {
    dispatch(WalletsGen.createRejectDisclaimer())
  }
  const props = {
    acceptDisclaimerError: acceptDisclaimerError,
    acceptingDisclaimerDelay: acceptingDisclaimerDelay,
    nextScreen: ownProps.nextScreen,
    onAcceptDisclaimer: onAcceptDisclaimer,
    onCheckDisclaimer: onCheckDisclaimer,
    onClose: onClose,
  }
  return <Onboarding {...props} />
}

// A wrapper to harmonize the type of OwnProps between the
// routed case and <Onboarding /> case.
export const RoutedOnboarding = () => <ConnectedOnboarding nextScreen={'openWallet'} />

export default ConnectedOnboarding
