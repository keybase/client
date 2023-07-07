import logger from '../logger'
import * as EngineGen from './engine-gen-gen'
import * as Router2Constants from '../constants/router2'
import * as Tabs from '../constants/tabs'
import * as Constants from '../constants/signup'
import * as SettingsConstants from '../constants/settings'
import * as PushConstants from '../constants/push'
import * as SignupGen from './signup-gen'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as RouteTreeGen from './route-tree-gen'
import * as Container from '../util/container'
import {RPCError} from '../util/errors'

const noErrors = Constants.noErrors

const showErrorOrCleanupAfterSignup = (state: Container.TypedState) =>
  noErrors(state)
    ? Constants.useState.getState().dispatch.restartSignup()
    : RouteTreeGen.createNavigateAppend({path: ['signupError']})
// If the email was set to be visible during signup, we need to set that with a separate RPC.
const setEmailVisibilityAfterSignup = (state: Container.TypedState) =>
  noErrors(state) &&
  Constants.useState.getState().emailVisible &&
  SettingsConstants.useEmailState
    .getState()
    .dispatch.editEmail({email: Constants.useState.getState().email, makeSearchable: true})

const checkDevicename = async (state: Container.TypedState) => {
  if (!noErrors(state)) {
    return false
  }
  try {
    await RPCTypes.deviceCheckDeviceNameFormatRpcPromise(
      {name: state.signup.devicename},
      Constants.waitingKey
    )
    return SignupGen.createCheckedDevicename({devicename: state.signup.devicename})
  } catch (error) {
    if (error instanceof RPCError) {
      return SignupGen.createCheckedDevicename({
        devicename: state.signup.devicename,
        error: `Device name is invalid: ${error.desc}.`,
      })
    }
    return
  }
}

// Actually sign up ///////////////////////////////////////////////////////////
const reallySignupOnNoErrors = async (
  state: Container.TypedState,
  _a: unknown,
  listenerApi: Container.ListenerApi
) => {
  if (!noErrors(state)) {
    logger.warn('Still has errors, bailing on really signing up')
    return
  }

  const {username, inviteCode} = Constants.useState.getState()
  const {devicename} = state.signup

  if (!username || !inviteCode || !devicename) {
    logger.warn('Missing data during signup phase', username, inviteCode, devicename)
    throw new Error('Missing data for signup')
  }

  try {
    PushConstants.useState.getState().dispatch.showPermissionsPrompt({justSignedUp: true})

    await RPCTypes.signupSignupRpcListener(
      {
        customResponseIncomingCallMap: {
          // Do not add a gpg key for now
          'keybase.1.gpgUi.wantToAddGPGKey': (_, response) => {
            response.result(false)
          },
        },
        incomingCallMap: {
          // We dont show the paperkey anymore
          'keybase.1.loginUi.displayPrimaryPaperKey': () => {},
        },
        params: {
          botToken: '',
          deviceName: devicename,
          deviceType: Container.isMobile ? RPCTypes.DeviceType.mobile : RPCTypes.DeviceType.desktop,
          email: '',
          genPGPBatch: false,
          genPaper: false,
          inviteCode,
          passphrase: '',
          randomPw: true,
          skipGPG: true,
          skipMail: true,
          storeSecret: true,
          username,
          verifyEmail: true,
        },
        waitingKey: Constants.waitingKey,
      },
      listenerApi
    )
    listenerApi.dispatch(SignupGen.createSignedup())
  } catch (error) {
    if (error instanceof RPCError) {
      listenerApi.dispatch(SignupGen.createSignedup({error}))
      PushConstants.useState.getState().dispatch.showPermissionsPrompt({justSignedUp: false})
    }
  }
}

const initSignup = () => {
  // validation actions
  Container.listenAction(SignupGen.checkDevicename, checkDevicename)

  // move to next screen actions
  Container.listenAction(SignupGen.signedup, showErrorOrCleanupAfterSignup)
  Container.listenAction(SignupGen.signedup, setEmailVisibilityAfterSignup)

  Container.listenAction(RouteTreeGen.onNavChanged, (_, action) => {
    const {prev, next} = action.payload
    // Clear "just signed up email" when you leave the people tab after signup
    if (
      Constants.useState.getState().justSignedUpEmail &&
      prev &&
      Router2Constants.getTab(prev) === Tabs.peopleTab &&
      next &&
      Router2Constants.getTab(next) !== Tabs.peopleTab
    ) {
      Constants.useState.getState().dispatch.clearJustSignedUpEmail()
    }
  })

  // actually make the signup call
  Container.listenAction(SignupGen.checkedDevicename, reallySignupOnNoErrors)

  Container.listenAction(EngineGen.keybase1NotifyEmailAddressEmailAddressVerified, () => {
    Constants.useState.getState().dispatch.clearJustSignedUpEmail()
  })
}

export default initSignup
