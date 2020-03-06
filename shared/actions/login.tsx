// Look at this doc: https://goo.gl/7B6p4H
import * as LoginGen from './login-gen'
import * as ConfigGen from './config-gen'
import * as ProvisionGen from './provision-gen'
import * as Constants from '../constants/login'
import * as Saga from '../util/saga'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Container from '../util/container'
import logger from '../logger'
import {isMobile} from '../constants/platform'
import {RPCError, niceError} from '../util/errors'

// TODO better types for response / incomingCallMap

const cancelDesc = 'Canceling RPC'
const cancelOnCallback = (_: any, response: any) => {
  response.error({code: RPCTypes.StatusCode.scgeneric, desc: cancelDesc})
}
const ignoreCallback = () => {}

const getPasswordHandler = (passphrase: string) => (params: any, response: any) => {
  if (params.pinentry.type === RPCTypes.PassphraseType.passPhrase) {
    // Service asking us again due to a bad passphrase?
    if (params.pinentry.retryLabel) {
      cancelOnCallback(params, response)
      let retryLabel = params.pinentry.retryLabel
      if (retryLabel === Constants.invalidPasswordErrorString) {
        retryLabel = 'Incorrect password.'
      }
      const error = new RPCError(retryLabel, RPCTypes.StatusCode.scinputerror)
      return Saga.put(LoginGen.createLoginError({error}))
    } else {
      response.result({passphrase, storeSecret: false})
    }
  } else {
    cancelOnCallback(params, response)
  }
  return undefined
}

const moveToProvisioning = (username: string) => (_: any, response: any) => {
  cancelOnCallback(undefined, response)
  return Saga.put(ProvisionGen.createSubmitUsername({username}))
}

// Actually do a user/pass login. Don't get sucked into a provisioning flow
function* login(_: Container.TypedState, action: LoginGen.LoginPayload) {
  try {
    yield RPCTypes.loginLoginRpcSaga({
      customResponseIncomingCallMap: {
        'keybase.1.gpgUi.selectKey': cancelOnCallback,
        'keybase.1.loginUi.getEmailOrUsername': cancelOnCallback,
        'keybase.1.provisionUi.DisplayAndPromptSecret': cancelOnCallback,
        'keybase.1.provisionUi.PromptNewDeviceName': moveToProvisioning(action.payload.username),
        'keybase.1.provisionUi.chooseDevice': cancelOnCallback,
        'keybase.1.provisionUi.chooseGPGMethod': cancelOnCallback,
        'keybase.1.secretUi.getPassphrase': getPasswordHandler(action.payload.password.stringValue()),
      },
      // cancel if we get any of these callbacks, we're logging in, not provisioning
      incomingCallMap: {
        'keybase.1.loginUi.displayPrimaryPaperKey': ignoreCallback,
        'keybase.1.provisionUi.DisplaySecretExchanged': ignoreCallback,
        'keybase.1.provisionUi.ProvisioneeSuccess': ignoreCallback,
        'keybase.1.provisionUi.ProvisionerSuccess': ignoreCallback,
      },
      params: {
        clientType: RPCTypes.ClientType.guiMain,
        deviceName: '',
        deviceType: isMobile ? 'mobile' : 'desktop',
        doUserSwitch: true,
        paperKey: '',
        username: action.payload.username,
      },
      waitingKey: Constants.waitingKey,
    })
    logger.info('login call succeeded')
    yield Saga.put(ConfigGen.createLoggedIn({causedBySignup: false, causedByStartup: false}))
  } catch (e) {
    if (e.code === RPCTypes.StatusCode.scalreadyloggedin) {
      yield Saga.put(ConfigGen.createLoggedIn({causedBySignup: false, causedByStartup: false}))
    } else if (e.desc !== cancelDesc) {
      // If we're canceling then ignore the error
      e.desc = niceError(e)
      yield Saga.put(LoginGen.createLoginError({error: e}))
    }
  }
}

const loadIsOnline = async () => {
  try {
    const isOnline = await RPCTypes.loginIsOnlineRpcPromise(undefined)
    return LoginGen.createLoadedIsOnline({isOnline})
  } catch (err) {
    logger.warn('Error in checking whether we are online', err)
    return false
  }
}

// On login error, turn off the user switching flag, so that the login screen is not
// hidden and the user can see and respond to the error.
const loginError = () => ConfigGen.createSetUserSwitching({userSwitching: false})

function* loginSaga() {
  // Actually log in
  yield* Saga.chainGenerator<LoginGen.LoginPayload>(LoginGen.login, login)
  yield* Saga.chainAction2(LoginGen.loadIsOnline, loadIsOnline)
  yield* Saga.chainAction2(LoginGen.loginError, loginError)
}

export default loginSaga
