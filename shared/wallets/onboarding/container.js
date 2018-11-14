// @flow
import {connect} from '../../util/container'
import * as WalletsGen from '../../actions/wallets-gen'
import * as Types from '../../constants/types/wallets'
import Onboarding from '.'

const mapStateToProps = state => ({})

const mapDispatchToProps = dispatch => ({
  onAcceptDisclaimer: (nextScreen: Types.NextScreenAfterAcceptance) =>
    dispatch(WalletsGen.createAcceptDisclaimer({nextScreen})),
  onClose: () => dispatch(WalletsGen.createRejectDisclaimer()),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  onAcceptDisclaimer: dispatchProps.onAcceptDisclaimer,
  onClose: dispatchProps.onClose,
})

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(Onboarding)
