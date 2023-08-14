import * as C from '../../constants'
import * as Container from '../../util/container'
import Intro from '.'

export default () => {
  const justDeletedSelf = C.useConfigState(s => s.justDeletedSelf)
  const justRevokedSelf = C.useConfigState(s => s.justRevokedSelf)
  const bannerMessage = justDeletedSelf
    ? `Your Keybase account ${justDeletedSelf} has been deleted. Au revoir!`
    : justRevokedSelf
    ? `${justRevokedSelf} was revoked successfully`
    : ''

  const isOnline = C.useConfigState(s => s.isOnline)
  const loadIsOnline = C.useConfigState(s => s.dispatch.loadIsOnline)

  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const _onFeedback = () => {
    navigateAppend({props: {}, selected: 'feedback'})
  }
  const checkIsOnline = loadIsOnline
  const onLogin = C.useProvisionState(s => s.dispatch.startProvision)
  const requestAutoInvite = C.useSignupState(s => s.dispatch.requestAutoInvite)
  const onSignup = () => {
    requestAutoInvite()
  }
  const showProxySettings = () => {
    navigateAppend('proxySettingsModal')
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
