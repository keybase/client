// @flow
// Look at this doc: https://goo.gl/7B6p4H
import logger from '../../logger'
import * as Chat2Gen from '../chat2-gen'
import * as ConfigGen from '../config-gen'
import * as DevicesConstants from '../../constants/devices'
import * as WaitingGen from '../waiting-gen'
import * as LoginGen from '../login-gen'
import * as ChatTypes from '../../constants/types/chat2'
import * as ChatConstants from '../../constants/chat2'
import * as Constants from '../../constants/login'
import * as RouteTypes from '../../constants/types/route-tree'
import * as RouteConstants from '../../constants/route-tree'
import * as RouteTree from '../route-tree'
import * as Saga from '../../util/saga'
import * as Tabs from '../../constants/tabs'
import * as RPCTypes from '../../constants/types/rpc-gen'
import openURL from '../../util/open-url'
import {getExtendedStatus} from '../config'
import {isMobile} from '../../constants/platform'
import appRouteTree from '../../app/routes-app'
import loginRouteTree from '../../app/routes-login'
import {type InitialState} from '../../constants/types/config'
import {type TypedState} from '../../constants/reducer'
import provisionSaga from './provision'
import {niceError} from '../../util/errors'

// Login dips into the routing dep tree, so we need to tell
// webpack that we can still handle updates that propagate to here.
export function setupLoginHMR(cb: () => void) {
  module.hot && module.hot.accept(['../../app/routes-app', '../../app/routes-login'], cb)
}

function* getAccounts(): Generator<any, void, any> {
  try {
    yield Saga.put(WaitingGen.createIncrementWaiting({key: DevicesConstants.waitingKey}))
    const accounts = yield Saga.call(RPCTypes.loginGetConfiguredAccountsRpcPromise)
    yield Saga.put(LoginGen.createConfiguredAccounts({accounts}))
  } catch (error) {
    yield Saga.put(LoginGen.createConfiguredAccountsError({error}))
  } finally {
    yield Saga.put(WaitingGen.createDecrementWaiting({key: DevicesConstants.waitingKey}))
  }
}

// TODO entirely change how this works
function* navBasedOnLoginAndInitialState(): Saga.SagaGenerator<any, any> {
  const state = yield Saga.select()
  const {loggedIn, registered, startedDueToPush} = state.config
  // ignore initial state if we're here due to push
  const initialState = startedDueToPush ? null : state.config.initialState
  const {justDeletedSelf, loginError} = state.login
  const {loggedInUserNavigated} = state.routeTree
  logger.info(
    '[RouteState] navBasedOnLoginAndInitialState:',
    loggedIn,
    registered,
    initialState,
    justDeletedSelf,
    loginError,
    loggedInUserNavigated
  )

  // All branches except for when loggedIn is true,
  // loggedInUserNavigated is false, and and initialState is null
  // yield a RouteTree.switchRouteDef action with appRouteTree or
  // loginRouteTree, and must finish by yielding an action which sets
  // state.routeTree.loggedInUserNavigated to true; see
  // loggedInUserNavigatedReducer.
  if (justDeletedSelf) {
    yield Saga.put(RouteTree.switchRouteDef(loginRouteTree))
    yield Saga.put(RouteTree.navigateTo([Tabs.loginTab]))
  } else if (loggedIn) {
    // If the user has already performed a navigation action, or if
    // we've already applied the initialState, do nothing.
    if (loggedInUserNavigated) {
      return
    }

    yield Saga.put(RouteTree.switchRouteDef(appRouteTree))

    if (initialState) {
      const {url, tab, conversation} = (initialState: InitialState)
      if (url) {
        yield Saga.put(ConfigGen.createLink({link: url}))
      } else if (tab && Tabs.isValidInitialTab(tab)) {
        if (tab === Tabs.chatTab && conversation && ChatConstants.isValidConversationIDKey(conversation)) {
          yield Saga.put(
            Chat2Gen.createSelectConversation({
              conversationIDKey: ChatTypes.stringToConversationIDKey(conversation),
              reason: 'savedLastState',
            })
          )
          yield Saga.put(
            RouteTree.navigateTo(
              isMobile ? [Tabs.chatTab, 'conversation'] : [Tabs.chatTab],
              null,
              'initial-restore'
            )
          )
        } else {
          yield Saga.put(RouteTree.navigateTo([tab], null, 'initial-restore'))
        }
      } else {
        yield Saga.put(RouteTree.navigateTo([Tabs.peopleTab], null, 'initial-restore'))
      }
    } else {
      // If the initial state is not set yet, navigate to the people
      // tab without setting state.routeTree.loggedInUserNavigated to true.
      yield Saga.put(RouteTree.navigateTo([Tabs.peopleTab], null, 'initial-default'))
    }
  } else if (registered) {
    // relogging in
    yield Saga.put(RouteTree.switchRouteDef(loginRouteTree))
    yield Saga.put.resolve(getExtendedStatus())
    // We may have logged successfully in by now, check before trying to navigate
    const state = yield Saga.select()
    if (state.config.loggedIn) {
      return
    }
    yield Saga.put(RouteTree.navigateTo(['login'], [Tabs.loginTab]))
  } else if (loginError) {
    // show error on login screen
    yield Saga.put(RouteTree.switchRouteDef(loginRouteTree))
    yield Saga.put(RouteTree.navigateTo(['login'], [Tabs.loginTab]))
  } else {
    // no idea
    yield Saga.put(RouteTree.switchRouteDef(loginRouteTree))
    yield Saga.put(RouteTree.navigateTo([Tabs.loginTab]))
  }
}

function* navigateToLoginRoot(): Generator<any, void, any> {
  const state: TypedState = yield Saga.select()
  const numAccounts = state.login.configuredAccounts ? state.login.configuredAccounts.size : 0
  const route = numAccounts ? ['login'] : []
  yield Saga.put(RouteTree.navigateTo(route, [Tabs.loginTab]))
}

const maybeNavigateToLoginRoot = (
  action: LoginGen.OnBackPayload | RouteTypes.NavigateUp,
  state: TypedState
) => {
  if (
    action.type === RouteConstants.navigateUp &&
    state.routeTree.routeState &&
    state.routeTree.routeState.selected !== Tabs.loginTab
  ) {
    // naving but not on login
    return
  }

  return Saga.call(navigateToLoginRoot)
}

const showUsernameEmailScreen = () =>
  Saga.put(RouteTree.navigateTo(['login', 'usernameOrEmail'], [Tabs.loginTab]))

// Actually do a user/pass login. Don't get sucked into a provisioning flow
const login = (_: any, action: LoginGen.LoginPayload) =>
  Saga.call(function*() {
    try {
      const cancelOnCallback = (params, response, state) => {
        response.error({
          code: RPCTypes.constantsStatusCode.scgeneric,
          desc: 'Canceling RPC',
        })
      }
      const ignoreCallback = (params, state) => {}

      yield RPCTypes.loginLoginRpcSaga({
        // cancel if we get any of these callbacks, we're logging in, not provisioning
        incomingCallMap: {
          'keybase.1.gpgUi.selectKey': cancelOnCallback,
          'keybase.1.loginUi.displayPrimaryPaperKey': ignoreCallback,
          'keybase.1.loginUi.getEmailOrUsername': cancelOnCallback,
          'keybase.1.provisionUi.DisplayAndPromptSecret': cancelOnCallback,
          'keybase.1.provisionUi.DisplaySecretExchanged': ignoreCallback,
          'keybase.1.provisionUi.PromptNewDeviceName': cancelOnCallback,
          'keybase.1.provisionUi.ProvisioneeSuccess': ignoreCallback,
          'keybase.1.provisionUi.ProvisionerSuccess': ignoreCallback,
          'keybase.1.provisionUi.chooseDevice': cancelOnCallback,
          'keybase.1.provisionUi.chooseGPGMethod': cancelOnCallback,
          'keybase.1.secretUi.getPassphrase': (
            params: RPCTypes.SecretUiGetPassphraseRpcParam,
            response,
            state
          ) => {
            if (params.pinentry.type === RPCTypes.passphraseCommonPassphraseType.passPhrase) {
              // Service asking us again due to a bad passphrase?
              if (params.pinentry.retryLabel) {
                cancelOnCallback(params, response, state)
                return Saga.put(LoginGen.createLoginError({error: params.pinentry.retryLabel}))
              } else {
                response.result({
                  passphrase: action.payload.passphrase.stringValue(),
                  storeSecret: false,
                })
              }
            } else {
              cancelOnCallback(params, response, state)
            }
          },
        },
        params: {
          clientType: RPCTypes.commonClientType.guiMain,
          deviceType: isMobile ? 'mobile' : 'desktop',
          usernameOrEmail: action.payload.usernameOrEmail,
        },
        waitingKey: Constants.waitingKey,
      })
    } catch (e) {
      yield Saga.put(LoginGen.createLoginError({error: niceError(e)}))
    }
  })

const launchForgotPasswordWebPage = () => Saga.call(openURL, 'https://keybase.io/#password-reset')
const launchAccountResetWebPage = () => Saga.call(openURL, 'https://keybase.io/#account-reset')

const logoutDone = () =>
  Saga.sequentially([
    Saga.put({payload: undefined, type: LoginGen.resetStore}),
    Saga.call(navBasedOnLoginAndInitialState),
    Saga.put(ConfigGen.createBootstrap({})),
  ])

const logout = () =>
  Saga.sequentially([
    Saga.put(ConfigGen.createClearRouteState()),
    Saga.call(RPCTypes.loginLogoutRpcPromise, undefined, Constants.waitingKey),
    Saga.put(LoginGen.createLogoutDone()),
  ])

// TODO more pure functions
function* loginSaga(): Saga.SagaGenerator<any, any> {
  // Actually log in
  yield Saga.safeTakeEveryPureSimple(LoginGen.login, login)

  // Screen sagas
  yield Saga.safeTakeEveryPureSimple(LoginGen.startLogin, showUsernameEmailScreen)
  yield Saga.safeTakeLatest(LoginGen.navBasedOnLoginAndInitialState, navBasedOnLoginAndInitialState)
  yield Saga.safeTakeEveryPureSimple(LoginGen.logoutDone, logoutDone)
  yield Saga.safeTakeEveryPureSimple(LoginGen.logout, logout)
  yield Saga.safeTakeEveryPureSimple([ConfigGen.readyForBootstrap, LoginGen.logoutDone], getAccounts)

  yield Saga.safeTakeEveryPure([LoginGen.onBack, RouteConstants.navigateUp], maybeNavigateToLoginRoot)

  yield Saga.safeTakeEveryPureSimple(LoginGen.launchForgotPasswordWebPage, launchForgotPasswordWebPage)
  yield Saga.safeTakeEveryPureSimple(LoginGen.launchAccountResetWebPage, launchAccountResetWebPage)

  yield Saga.fork(provisionSaga)
}

export default loginSaga
