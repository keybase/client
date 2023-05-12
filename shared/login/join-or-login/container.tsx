import * as ProvisionGen from '../../actions/provision-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as SignupGen from '../../actions/signup-gen'
import * as LoginGen from '../../actions/login-gen'
import Intro from '.'
import * as Container from '../../util/container'

export default () => {
  const bannerMessage = Container.useSelector(state => {
    let bannerMessage: string | undefined

    if (state.config.justDeletedSelf) {
      bannerMessage = `Your Keybase account ${state.config.justDeletedSelf} has been deleted. Au revoir!`
    } else if (state.devices.justRevokedSelf) {
      bannerMessage = `${state.devices.justRevokedSelf} was revoked successfully`
    }
    return bannerMessage
  })

  const isOnline = Container.useSelector(state => state.login.isOnline)

  const dispatch = Container.useDispatch()
  const _onFeedback = () => {
    dispatch(RouteTreeGen.createNavigateAppend({path: ['feedback']}))
  }
  const checkIsOnline = () => {
    dispatch(LoginGen.createLoadIsOnline())
  }
  const onLogin = () => {
    dispatch(ProvisionGen.createStartProvision())
  }
  const onSignup = () => {
    dispatch(SignupGen.createRequestAutoInvite())
  }
  const showProxySettings = () => {
    dispatch(RouteTreeGen.createNavigateAppend({path: ['proxySettingsModal']}))
  }
  const props = {
    bannerMessage,
    checkIsOnline,
    isOnline,
    onFeedback: Container.isMobile ? _onFeedback : undefined,
    onLogin,
    onSignup,
    showProxySettings,
  }
  return <Intro {...props} />
}
