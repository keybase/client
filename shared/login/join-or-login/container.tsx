import * as ConfigConstants from '../../constants/config'
import * as Constants from '../../constants/provision'
import * as Container from '../../util/container'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as SignupConstants from '../../constants/signup'
import Intro from '.'

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
  const onLogin = Constants.useState(s => s.dispatch.startProvision)
  const requestAutoInvite = SignupConstants.useState(s => s.dispatch.requestAutoInvite)
  const onSignup = () => {
    requestAutoInvite()
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
