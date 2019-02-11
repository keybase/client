// @flow
// Look at this doc: https://goo.gl/7B6p4H
import * as LoginGen from './login-gen'
import * as ConfigGen from './config-gen'
import * as ProvisionGen from './provision-gen'
import * as Constants from '../constants/login'
import * as Saga from '../util/saga'
import * as RPCTypes from '../constants/types/rpc-gen'
import logger from '../logger'
import openURL from '../util/open-url'
import {isMobile} from '../constants/platform'
import {niceError} from '../util/errors'
import HiddenString from '../util/hidden-string'

// Login dips into the routing dep tree, so we need to tell
// webpack that we can still handle updates that propagate to here.
export function setupLoginHMR(cb: () => void) {
  module.hot && module.hot.accept(['../app/routes-app', '../app/routes-login'], cb)
}

const cancelDesc = 'Canceling RPC'
const cancelOnCallback = (params, response) => {
  response.error({code: RPCTypes.constantsStatusCode.scgeneric, desc: cancelDesc})
}
const ignoreCallback = params => {}

const getPassphraseHandler = passphrase => (params, response) => {
  if (params.pinentry.type === RPCTypes.passphraseCommonPassphraseType.passPhrase) {
    // Service asking us again due to a bad passphrase?
    if (params.pinentry.retryLabel) {
      cancelOnCallback(params, response)
      let retryLabel = params.pinentry.retryLabel
      if (retryLabel === 'Bad passphrase: Invalid passphrase. Server rejected login attempt..') {
        retryLabel = 'Incorrect password'
      }
      return Saga.put(LoginGen.createLoginError({error: new HiddenString(retryLabel)}))
    } else {
      response.result({
        passphrase,
        storeSecret: false,
      })
    }
  } else {
    cancelOnCallback(params, response)
  }
}

const moveToProvisioning = (usernameOrEmail: string) => (params, response) => {
  cancelOnCallback(params, response)
  return Saga.put(
    ProvisionGen.createSubmitUsernameOrEmail({
      usernameOrEmail,
    })
  )
}

// Actually do a user/pass login. Don't get sucked into a provisioning flow
function* login(state, action) {
  try {
    yield* Saga.callRPCs(
      RPCTypes.loginLoginRpcSaga({
        customResponseIncomingCallMap: {
          'keybase.1.gpgUi.selectKey': cancelOnCallback,
          'keybase.1.loginUi.getEmailOrUsername': cancelOnCallback,
          'keybase.1.provisionUi.DisplayAndPromptSecret': cancelOnCallback,
          'keybase.1.provisionUi.PromptNewDeviceName': moveToProvisioning(action.payload.usernameOrEmail),
          'keybase.1.provisionUi.chooseDevice': cancelOnCallback,
          'keybase.1.provisionUi.chooseGPGMethod': cancelOnCallback,
          'keybase.1.secretUi.getPassphrase': getPassphraseHandler(action.payload.passphrase.stringValue()),
        },
        // cancel if we get any of these callbacks, we're logging in, not provisioning
        incomingCallMap: {
          'keybase.1.loginUi.displayPrimaryPaperKey': ignoreCallback,
          'keybase.1.provisionUi.DisplaySecretExchanged': ignoreCallback,
          'keybase.1.provisionUi.ProvisioneeSuccess': ignoreCallback,
          'keybase.1.provisionUi.ProvisionerSuccess': ignoreCallback,
        },
        params: {
          clientType: RPCTypes.commonClientType.guiMain,
          deviceType: isMobile ? 'mobile' : 'desktop',
          usernameOrEmail: action.payload.usernameOrEmail,
        },
        waitingKey: Constants.waitingKey,
      })
    )
    logger.info('login call succeeded')
    yield Saga.put(ConfigGen.createLoggedIn({causedByStartup: false}))
  } catch (e) {
    // If we're canceling then ignore the error
    if (e.desc !== cancelDesc) {
      yield Saga.put(LoginGen.createLoginError({error: new HiddenString(niceError(e))}))
    }
  }
}

const launchForgotPasswordWebPage = () => {
  openURL('https://keybase.io/#password-reset')
}
const launchAccountResetWebPage = () => {
  openURL('https://keybase.io/#account-reset')
}

function* loginSaga(): Saga.SagaGenerator<any, any> {
  // Actually log in
  yield* Saga.chainGenerator<LoginGen.LoginPayload>(LoginGen.login, login)
  yield* Saga.chainAction<LoginGen.LaunchForgotPasswordWebPagePayload>(
    LoginGen.launchForgotPasswordWebPage,
    launchForgotPasswordWebPage
  )
  yield* Saga.chainAction<LoginGen.LaunchAccountResetWebPagePayload>(
    LoginGen.launchAccountResetWebPage,
    launchAccountResetWebPage
  )
}

export default loginSaga
