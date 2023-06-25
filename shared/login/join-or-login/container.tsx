import * as ProvisionGen from '../../actions/provision-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as SignupGen from '../../actions/signup-gen'
import * as ConfigConstants from '../../constants/config'
import Intro from '.'
import * as Container from '../../util/container'

export default () => {
  const justDeletedSelf = ConfigConstants.useConfigState(s => s.justDeletedSelf)
  const justRevokedSelf = ConfigConstants.useConfigState(s => s.justRevokedSelf)
  const bannerMessage = justDeletedSelf
    ? `Your Keybase account ${justDeletedSelf} has been deleted. Au revoir!`
    : justRevokedSelf
    ? `${justRevokedSelf} was revoked successfully`
    : ''

  const isOnline = ConfigConstants.useConfigState(s => s.isOnline)
  const loadIsOnline = ConfigConstants.useConfigState(s => s.dispatch.loadIsOnline)

  const dispatch = Container.useDispatch()
  const _onFeedback = () => {
    dispatch(RouteTreeGen.createNavigateAppend({path: [{props: {}, selected: 'feedback'}]}))
  }
  const checkIsOnline = loadIsOnline
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
