// @flow
import {connect} from '../../util/container'
import * as WalletsGen from '../../actions/wallets-gen'
import * as Types from '../../constants/types/wallets'
import Onboarding from '.'

type OwnProps = {||}

const mapStateToProps = state => ({
  acceptingDisclaimerDelay: state.wallets.acceptingDisclaimerDelay,
})

const mapDispatchToProps = dispatch => ({
  onAcceptDisclaimer: () => dispatch(WalletsGen.createAcceptDisclaimer()),
  onCheckDisclaimer: (nextScreen: Types.NextScreenAfterAcceptance) =>
    dispatch(WalletsGen.createCheckDisclaimer({nextScreen})),
  onClose: () => dispatch(WalletsGen.createRejectDisclaimer()),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  acceptingDisclaimerDelay: stateProps.acceptingDisclaimerDelay,
  onAcceptDisclaimer: dispatchProps.onAcceptDisclaimer,
  onCheckDisclaimer: dispatchProps.onCheckDisclaimer,
  onClose: dispatchProps.onClose,
})

export default connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(Onboarding)
