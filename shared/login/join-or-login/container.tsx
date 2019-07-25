import * as ProvisionGen from '../../actions/provision-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as SignupGen from '../../actions/signup-gen'
import * as LoginGen from '../../actions/login-gen'
import Intro from '.'
import * as Container from '../../util/container'
import {HOCTimers} from '../../common-adapters'

type OwnProps = {}

export default Container.connect(
  state => {
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
  },
  dispatch => ({
    _checkIsOnline: () => dispatch(LoginGen.createLoadIsOnline()),
    _onFeedback: () => dispatch(RouteTreeGen.createNavigateAppend({path: ['feedback']})),
    onLogin: () => dispatch(ProvisionGen.createStartProvision()),
    onSignup: () => dispatch(SignupGen.createRequestAutoInvite()),
    showProxySettings: () => dispatch(RouteTreeGen.createNavigateAppend({path: ['proxySettingsModal']})),
  }),
  (stateProps, dispatchProps, _: OwnProps) => ({
    bannerMessage: stateProps.bannerMessage,
    checkIsOnline: dispatchProps._checkIsOnline,
    isOnline: stateProps.isOnline,
    onFeedback: Container.isMobile ? dispatchProps._onFeedback : null,
    onLogin: dispatchProps.onLogin,
    onSignup: dispatchProps.onSignup,
    showProxySettings: dispatchProps.showProxySettings,
  })
)(HOCTimers(Intro))
