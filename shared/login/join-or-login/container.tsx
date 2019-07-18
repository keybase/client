import * as ProvisionGen from '../../actions/provision-gen'
import * as SignupGen from '../../actions/signup-gen'
import * as LoginGen from '../../actions/login-gen'
import Intro from '.'
import {connect, isMobile} from '../../util/container'
import {HOCTimers} from '../../common-adapters'

type OwnProps = {
  navigateAppend: (...args: Array<any>) => any
}

const mapStateToProps = state => {
  let bannerMessage: string | null = null

  if (state.config.justDeletedSelf) {
    bannerMessage = `Your Keybase account ${state.config.justDeletedSelf}" has been deleted. Au revoir!`
  } else if (state.devices.justRevokedSelf) {
    bannerMessage = `${state.devices.justRevokedSelf} was revoked successfully`
  }

  return {
    bannerMessage,
    isOnline: state.login.isOnline,
  }
}

const mapDispatchToProps = (dispatch, {navigateAppend}: OwnProps) => ({
  _checkIsOnline: () => dispatch(LoginGen.createLoadIsOnline()),
  _onFeedback: () => dispatch(navigateAppend(['feedback'])),
  onLogin: () => dispatch(ProvisionGen.createStartProvision()),
  onSignup: () => dispatch(SignupGen.createRequestAutoInvite()),
  showProxySettings: () => dispatch(navigateAppend(['proxySettingsModal'])),
})

const mergeProps = (stateProps, dispatchProps, _: OwnProps) => ({
  bannerMessage: stateProps.bannerMessage,
  checkIsOnline: dispatchProps._checkIsOnline,
  isOnline: stateProps.isOnline,
  onFeedback: isMobile ? dispatchProps._onFeedback : null,
  onLogin: dispatchProps.onLogin,
  onSignup: dispatchProps.onSignup,
  showProxySettings: dispatchProps.showProxySettings,
})

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(HOCTimers(Intro))
