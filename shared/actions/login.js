// @flow
// Look at this doc: https://goo.gl/7B6p4H
import * as WaitingGen from './waiting-gen'
import * as LoginGen from './login-gen'
import * as Constants from '../constants/login'
import * as RouteConstants from '../constants/route-tree'
import * as RouteTree from './route-tree'
import * as Saga from '../util/saga'
import * as Tabs from '../constants/tabs'
import * as RPCTypes from '../constants/types/rpc-gen'
import openURL from '../util/open-url'
import {isMobile} from '../constants/platform'
import {type TypedState} from '../constants/reducer'
import {niceError} from '../util/errors'
import HiddenString from '../util/hidden-string'

// Login dips into the routing dep tree, so we need to tell
// webpack that we can still handle updates that propagate to here.
export function setupLoginHMR(cb: () => void) {
  module.hot && module.hot.accept(['../app/routes-app', '../app/routes-login'], cb)
}

// TODO entirely change how this works
/*
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
  } else if (loggedIn) {
    // If the user has already performed a navigation action, or if
    // we've already applied the initialState, do nothing.
    if (loggedInUserNavigated) {
      return
    }

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
*/

function* navigateToLoginRoot(): Generator<any, void, any> {
  const state: TypedState = yield Saga.select()
  const numAccounts = state.config.configuredAccounts.size
  const route = numAccounts ? ['login'] : []
  yield Saga.put(RouteTree.navigateTo(route, [Tabs.loginTab]))
}

const maybeNavigateToLoginRoot = (state: TypedState) =>
  // naving but not on login
  state.routeTree.routeState && state.routeTree.routeState.selected !== Tabs.loginTab
    ? null
    : Saga.call(navigateToLoginRoot)

const cancelDesc = 'Canceling RPC'
const cancelOnCallback = (params, response, state) => {
  response.error({
    code: RPCTypes.constantsStatusCode.scgeneric,
    desc: cancelDesc,
  })
}
const ignoreCallback = (params, state) => {}

const getPassphraseHandler = passphrase => (
  params: RPCTypes.SecretUiGetPassphraseRpcParam,
  response,
  state
) => {
  if (params.pinentry.type === RPCTypes.passphraseCommonPassphraseType.passPhrase) {
    // Service asking us again due to a bad passphrase?
    if (params.pinentry.retryLabel) {
      cancelOnCallback(params, response, state)
      return Saga.put(LoginGen.createLoginError({error: new HiddenString(params.pinentry.retryLabel)}))
    } else {
      response.result({
        passphrase,
        storeSecret: false,
      })
    }
  } else {
    cancelOnCallback(params, response, state)
  }
}

// Actually do a user/pass login. Don't get sucked into a provisioning flow
const login = (_: any, action: LoginGen.LoginPayload) =>
  Saga.call(function*() {
    try {
      // We don't want the waiting key to be positive during this whole process so we do a decrement first so its not going 1,2,1,2,1,2
      yield Saga.put(WaitingGen.createDecrementWaiting({key: Constants.waitingKey}))

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
          'keybase.1.secretUi.getPassphrase': getPassphraseHandler(action.payload.passphrase.stringValue()),
        },
        params: {
          clientType: RPCTypes.commonClientType.guiMain,
          deviceType: isMobile ? 'mobile' : 'desktop',
          usernameOrEmail: action.payload.usernameOrEmail,
        },
        waitingKey: Constants.waitingKey,
      })
    } catch (e) {
      // If we're canceling then ignore the error
      if (e.desc !== cancelDesc) {
        yield Saga.put(LoginGen.createLoginError({error: new HiddenString(niceError(e))}))
      }
    } finally {
      // Reset us to zero
      yield Saga.put(WaitingGen.createIncrementWaiting({key: Constants.waitingKey}))
    }
  })

const launchForgotPasswordWebPage = () => Saga.call(openURL, 'https://keybase.io/#password-reset')
const launchAccountResetWebPage = () => Saga.call(openURL, 'https://keybase.io/#account-reset')

function* loginSaga(): Saga.SagaGenerator<any, any> {
  // Actually log in
  yield Saga.actionToAction(LoginGen.login, login)

  yield Saga.actionToAction(RouteConstants.navigateUp, maybeNavigateToLoginRoot)

  yield Saga.actionToAction(LoginGen.launchForgotPasswordWebPage, launchForgotPasswordWebPage)
  yield Saga.actionToAction(LoginGen.launchAccountResetWebPage, launchAccountResetWebPage)
}

export default loginSaga
