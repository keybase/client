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
    _details: state.wallets.airdropDetails.disclaimer,
    acceptDisclaimerError: error && error.message ? error.message : '',
    acceptingDisclaimerDelay: state.wallets.acceptingDisclaimerDelay,
  }
}

const mapDispatchToProps = dispatch => ({
  onAcceptDisclaimer: () => dispatch(WalletsGen.createAcceptDisclaimer()),
  onCheckDisclaimer: (nextScreen: Types.NextScreenAfterAcceptance) =>
    dispatch(WalletsGen.createCheckDisclaimer({nextScreen})),
  onClose: () => dispatch(WalletsGen.createRejectDisclaimer()),
  onLoadDetails: () => dispatch(WalletsGen.createUpdateAirdropDetails()),
})

const mergeProps = (stateProps, dispatchProps, _: OwnProps) => ({
  acceptDisclaimerError: stateProps.acceptDisclaimerError,
  acceptingDisclaimerDelay: stateProps.acceptingDisclaimerDelay,
  onAcceptDisclaimer: dispatchProps.onAcceptDisclaimer,
  onCheckDisclaimer: dispatchProps.onCheckDisclaimer,
  onClose: dispatchProps.onClose,
  onLoadDetails: dispatchProps.onLoadDetails,
  sections: stateProps._details.sections.toArray().map(s => ({
    icon: s.icon,
    lines: s.lines.toArray().map(l => ({
      bullet: l.bullet,
      text: l.text,
    })),
    section: s.section,
  })),
})

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(Onboarding)
