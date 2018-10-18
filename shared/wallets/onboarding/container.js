// @flow
import {connect} from '../../util/container'
import * as WalletsGen from '../../actions/wallets-gen'
import Onboarding from '.'

const mapStateToProps = state => ({})

const mapDispatchToProps = dispatch => ({
  onAcceptDisclaimer: (nextScreen: string) => dispatch(WalletsGen.createAcceptDisclaimer({nextScreen})),
  onNotNow: () => dispatch(WalletsGen.createRejectDisclaimer()),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  onAcceptDisclaimer: dispatchProps.onAcceptDisclaimer,
  onClose: dispatchProps.onNotNow,
})

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(Onboarding)
