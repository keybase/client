import * as ProvisionGen from '../../actions/provision-gen'
import * as SignupGen from '../../actions/signup-gen'
import Intro from '.'
import {connect, isMobile} from '../../util/container'

type OwnProps = {
  navigateAppend: (...args: Array<any>) => any
}

const mapStateToProps = state => {
  let bannerMessage = null

  if (state.config.justDeletedSelf) {
    bannerMessage = `Your Keybase account ${state.config.justDeletedSelf}" has been deleted. Au revoir!`
  } else if (state.devices.justRevokedSelf) {
    bannerMessage = `${state.devices.justRevokedSelf} was revoked successfully`
  }

  return {bannerMessage}
}

const mapDispatchToProps = (dispatch, {navigateAppend}: OwnProps) => ({
  _onFeedback: () => dispatch(navigateAppend(['feedback'])),
  onLogin: () => dispatch(ProvisionGen.createStartProvision()),
  onSignup: () => dispatch(SignupGen.createRequestAutoInvite()),
})

const mergeProps = (stateProps, dispatchProps, ownProps: OwnProps) => ({
  bannerMessage: stateProps.bannerMessage,
  onFeedback: isMobile ? dispatchProps._onFeedback : null,
  onLogin: dispatchProps.onLogin,
  onSignup: dispatchProps.onSignup,
})

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(Intro)
