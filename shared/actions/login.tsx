// Look at this doc: https://goo.gl/7B6p4H
import * as LoginGen from './login-gen'
import * as ConfigGen from './config-gen'
import * as ProvisionGen from './provision-gen'
import * as Constants from '../constants/login'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Container from '../util/container'
import logger from '../logger'
import {isMobile} from '../constants/platform'
import {RPCError, niceError} from '../util/errors'
import {type CommonResponseHandler} from '../engine/types'

const cancelDesc = 'Canceling RPC'
const cancelOnCallback = (_: unknown, response: CommonResponseHandler) => {
  response.error({code: RPCTypes.StatusCode.scgeneric, desc: cancelDesc})
}
const ignoreCallback = () => {}

// Actually do a user/pass login. Don't get sucked into a provisioning flow
const login = async (
  _: Container.TypedState,
  action: LoginGen.LoginPayload,
  listenerApi: Container.ListenerApi
) => {
  try {
    await RPCTypes.loginLoginRpcListener(
      {
        customResponseIncomingCallMap: {
          'keybase.1.gpgUi.selectKey': cancelOnCallback,
          'keybase.1.loginUi.getEmailOrUsername': cancelOnCallback,
          'keybase.1.provisionUi.DisplayAndPromptSecret': cancelOnCallback,
          'keybase.1.provisionUi.PromptNewDeviceName': (_, response) => {
            const username = action.payload.username
            cancelOnCallback(undefined, response)
            return ProvisionGen.createSubmitUsername({username})
          },
          'keybase.1.provisionUi.chooseDevice': cancelOnCallback,
          'keybase.1.provisionUi.chooseGPGMethod': cancelOnCallback,
          'keybase.1.secretUi.getPassphrase': (params, response) => {
            const passphrase = action.payload.password.stringValue()
            if (params.pinentry.type === RPCTypes.PassphraseType.passPhrase) {
              // Service asking us again due to a bad passphrase?
              if (params.pinentry.retryLabel) {
                cancelOnCallback(params, response)
                let retryLabel = params.pinentry.retryLabel
                if (retryLabel === Constants.invalidPasswordErrorString) {
                  retryLabel = 'Incorrect password.'
                }
                const error = new RPCError(retryLabel, RPCTypes.StatusCode.scinputerror)
                return LoginGen.createLoginError({error})
              } else {
                response.result({passphrase, storeSecret: false})
              }
            } else {
              cancelOnCallback(params, response)
            }
            return
          },
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
      },
      listenerApi
    )
    logger.info('login call succeeded')
    listenerApi.dispatch(ConfigGen.createLoggedIn({causedBySignup: false, causedByStartup: false}))
  } catch (error) {
    if (!(error instanceof RPCError)) {
      return
    }
    if (error.code === RPCTypes.StatusCode.scalreadyloggedin) {
      listenerApi.dispatch(ConfigGen.createLoggedIn({causedBySignup: false, causedByStartup: false}))
    } else if (error.desc !== cancelDesc) {
      // If we're canceling then ignore the error
      error.desc = niceError(error)
      listenerApi.dispatch(LoginGen.createLoginError({error: error}))
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

const initLogin = () => {
  // Actually log in
  Container.listenAction(LoginGen.login, login)
  Container.listenAction(LoginGen.loadIsOnline, loadIsOnline)
  Container.listenAction(LoginGen.loginError, loginError)
}

export default initLogin
