import {connect} from '../../util/container'
import * as WalletsGen from '../../actions/wallets-gen'
import * as Constants from '../../constants/wallets'
import * as Types from '../../constants/types/wallets'
import {anyErrors} from '../../constants/waiting'
import Onboarding from '.'

type OwnProps = {}

const mapStateToProps = state => {
  const error = anyErrors(state, Constants.acceptDisclaimerWaitingKey)
  return {
    acceptDisclaimerError: error && error.message ? error.message : '',
    acceptingDisclaimerDelay: state.wallets.acceptingDisclaimerDelay,
  }
}

const mapDispatchToProps = dispatch => ({
  onAcceptDisclaimer: () => dispatch(WalletsGen.createAcceptDisclaimer()),
  onCheckDisclaimer: (nextScreen: Types.NextScreenAfterAcceptance) =>
    dispatch(WalletsGen.createCheckDisclaimer({nextScreen})),
  onClose: () => dispatch(WalletsGen.createRejectDisclaimer()),
})

const mergeProps = (stateProps, dispatchProps) => ({
  acceptDisclaimerError: stateProps.acceptDisclaimerError,
  acceptingDisclaimerDelay: stateProps.acceptingDisclaimerDelay,
  onAcceptDisclaimer: dispatchProps.onAcceptDisclaimer,
  onCheckDisclaimer: dispatchProps.onCheckDisclaimer,
  onClose: dispatchProps.onClose,
})

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(Onboarding)
