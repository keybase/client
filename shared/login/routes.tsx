import * as Container from '../util/container'
import type Feedback from '../settings/feedback/container'
import type {ProxySettingsPopup} from '../settings/proxy'
import type {KnowPassword, EnterPassword} from './reset/password'
import type Waiting from './reset/waiting'
import type Confirm from './reset/confirm'
import type LoadingType from './loading/container'
import type ReloginType from './relogin/container'
import type JoinOrLoginType from './join-or-login/container'

type OwnProps = {}
type Props = {
  isLoggedIn: boolean
  showLoading: boolean
  showRelogin: boolean
}

const _RootLogin = (p: Props) => {
  // routing should switch us away so lets not draw anything to speed things up
  if (p.isLoggedIn) return null
  if (p.showLoading) {
    const Loading = require('./loading/container').default as typeof LoadingType
    return <Loading />
  }
  if (p.showRelogin) {
    const Relogin = require('./relogin/container').default as typeof ReloginType
    return <Relogin />
  }

  const JoinOrLogin = require('./join-or-login/container').default as typeof JoinOrLoginType
  return <JoinOrLogin />
}

_RootLogin.navigationOptions = {
  headerBottomStyle: {height: undefined},
  headerLeft: null, // no back button
}

const RootLogin = Container.connect(
  state => {
    const isLoggedIn = state.config.loggedIn
    const showLoading = state.config.daemonHandshakeState !== 'done' || state.config.userSwitching
    const showRelogin = !showLoading && state.config.configuredAccounts.length > 0
    return {isLoggedIn, showLoading, showRelogin}
  },
  () => ({}),
  (s, d, _: OwnProps) => ({...s, ...d})
)(_RootLogin)

export const newRoutes = {
  feedback: {getScreen: (): typeof Feedback => require('../signup/feedback/container').default},
  login: {getScreen: () => RootLogin},
  resetConfirm: {getScreen: (): typeof Confirm => require('./reset/confirm').default},
  resetEnterPassword: {getScreen: (): typeof EnterPassword => require('./reset/password').EnterPassword},
  resetKnowPassword: {getScreen: (): typeof KnowPassword => require('./reset/password').KnowPassword},
  resetWaiting: {getScreen: (): typeof Waiting => require('./reset/waiting').default},
  ...require('../provision/routes-sub').newRoutes,
  ...require('./recover-password/routes-sub').newRoutes,
}
export const newModalRoutes = {
  proxySettingsModal: {
    getScreen: (): typeof ProxySettingsPopup => require('../settings/proxy/container').default,
  },
  ...require('./recover-password/routes-sub').newModalRoutes,
}

export type RootParamListLogin = {
  codePage: undefined
  error: undefined
  feedback: undefined
  forgotUsername: undefined
  gpgSign: undefined
  login: undefined
  paperkey: undefined
  password: undefined
  proxySettingsModal: undefined
  recoverPasswordDeviceSelector: undefined
  recoverPasswordError: undefined
  recoverPasswordErrorModal: undefined
  recoverPasswordExplainDevice: undefined
  recoverPasswordPaperKey: undefined
  recoverPasswordPromptResetAccount: undefined
  recoverPasswordPromptResetPassword: undefined
  recoverPasswordSetPassword: undefined
  resetConfirm: undefined
  resetEnterPassword: undefined
  resetKnowPassword: undefined
  resetWaiting: {pipelineStarted: boolean}
  selectOtherDevice: undefined
  setPublicName: undefined
  username: {fromReset: boolean}
}
