import logger from '../logger'
import * as Router2Constants from '../constants/router2'
import * as Tabs from '../constants/tabs'
import * as Constants from '../constants/signup'
import * as ConfigConstants from '../constants/config'
import * as SignupGen from './signup-gen'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as RouteTreeGen from './route-tree-gen'
import * as SettingsGen from './settings-gen'
import * as PushGen from './push-gen'
import * as Container from '../util/container'
import {RPCError} from '../util/errors'

// Helpers ///////////////////////////////////////////////////////////
// returns true if there are no errors, we check all errors at every transition just to be extra careful
const noErrors = (state: Container.TypedState) =>
  !state.signup.devicenameError &&
  !state.signup.emailError &&
  !state.signup.inviteCodeError &&
  !state.signup.nameError &&
  !state.signup.usernameError &&
  !state.signup.signupError &&
  !state.signup.usernameTaken

// Navigation side effects ///////////////////////////////////////////////////////////
// When going back we clear all errors so we can fix things and move forward
const goBackAndClearErrors = () => RouteTreeGen.createNavigateUp()

const showUserOnNoErrors = (state: Container.TypedState) =>
  noErrors(state) && [
    RouteTreeGen.createNavigateUp(),
    RouteTreeGen.createNavigateAppend({path: ['signupEnterUsername']}),
  ]

const showInviteScreen = () => RouteTreeGen.createNavigateAppend({path: ['signupInviteCode']})

const showInviteSuccessOnNoErrors = (state: Container.TypedState) =>
  noErrors(state) && RouteTreeGen.createNavigateAppend({path: ['signupRequestInviteSuccess']})

const showDeviceScreenOnNoErrors = (state: Container.TypedState) =>
  noErrors(state) && RouteTreeGen.createNavigateAppend({path: ['signupEnterDevicename']})

const showErrorOrCleanupAfterSignup = (state: Container.TypedState) =>
  noErrors(state)
    ? SignupGen.createRestartSignup()
    : RouteTreeGen.createNavigateAppend({path: ['signupError']})

// If the email was set to be visible during signup, we need to set that with a separate RPC.
const setEmailVisibilityAfterSignup = (state: Container.TypedState) =>
  noErrors(state) &&
  state.signup.emailVisible &&
  SettingsGen.createEditEmail({email: state.signup.email, makeSearchable: true})

// Validation side effects ///////////////////////////////////////////////////////////
const checkInviteCode = async (state: Container.TypedState) => {
  try {
    await RPCTypes.signupCheckInvitationCodeRpcPromise(
      {invitationCode: state.signup.inviteCode},
      Constants.waitingKey
    )
    return SignupGen.createCheckedInviteCode({inviteCode: state.signup.inviteCode})
  } catch (error) {
    if (error instanceof RPCError) {
      return SignupGen.createCheckedInviteCode({error: error.desc, inviteCode: state.signup.inviteCode})
    }
    return
  }
}

const requestAutoInvite = async (state: Container.TypedState) => {
  // If we're logged in, we're coming from the user switcher; log out first to prevent the service from getting out of sync with the GUI about our logged-in-ness
  if (state.config.loggedIn) {
    await RPCTypes.loginLogoutRpcPromise(
      {force: false, keepSecrets: true},
      ConfigConstants.createOtherAccountWaitingKey
    )
  }
  try {
    const inviteCode = await RPCTypes.signupGetInvitationCodeRpcPromise(undefined, Constants.waitingKey)
    return SignupGen.createRequestedAutoInvite({inviteCode})
  } catch (_) {
    return SignupGen.createRequestedAutoInvite({})
  }
}

const requestInvite = async (state: Container.TypedState) => {
  if (!noErrors(state)) {
    return false
  }
  try {
    await RPCTypes.signupInviteRequestRpcPromise(
      {email: state.signup.email, fullname: state.signup.name, notes: 'Requested through GUI app'},
      Constants.waitingKey
    )
    return SignupGen.createRequestedInvite({
      email: state.signup.email,
      name: state.signup.name,
    })
  } catch (error) {
    if (error instanceof RPCError) {
      return SignupGen.createRequestedInvite({
        email: state.signup.email,
        emailError: `Sorry can't get an invite: ${error.desc}`,
        name: state.signup.name,
        nameError: '',
      })
    }
    return
  }
}

const checkUsername = async (state: Container.TypedState, _: SignupGen.CheckUsernamePayload) => {
  logger.info(`checking ${state.signup.username}`)
  if (!noErrors(state)) {
    return false
  }

  try {
    await RPCTypes.signupCheckUsernameAvailableRpcPromise(
      {username: state.signup.username},
      Constants.waitingKey
    )
    logger.info(`${state.signup.username} success`)
    return SignupGen.createCheckedUsername({error: '', username: state.signup.username})
  } catch (error) {
    if (error instanceof RPCError) {
      logger.warn(`${state.signup.username} error: ${error.message}`)
      const s = error.code === RPCTypes.StatusCode.scinputerror ? Constants.usernameHint : error.desc
      return SignupGen.createCheckedUsername({
        // Don't set error if it's 'username taken', we show a banner in that case
        error: error.code === RPCTypes.StatusCode.scbadsignupusernametaken ? '' : s,
        username: state.signup.username,
        usernameTaken:
          error.code === RPCTypes.StatusCode.scbadsignupusernametaken ? state.signup.username : undefined,
      })
    }
    return
  }
}

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

  const {username, inviteCode, devicename} = state.signup

  if (!username || !inviteCode || !devicename) {
    logger.warn('Missing data during signup phase', username, inviteCode, devicename)
    throw new Error('Missing data for signup')
  }

  try {
    listenerApi.dispatch(PushGen.createShowPermissionsPrompt({justSignedUp: true}))

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
      listenerApi.dispatch(PushGen.createShowPermissionsPrompt({justSignedUp: false}))
    }
  }
}

const maybeClearJustSignedUpEmail = (
  state: Container.TypedState,
  action: RouteTreeGen.OnNavChangedPayload
) => {
  const {prev, next} = action.payload
  // Clear "just signed up email" when you leave the people tab after signup
  if (
    state.signup.justSignedUpEmail &&
    prev &&
    Router2Constants.getTab(prev) === Tabs.peopleTab &&
    next &&
    Router2Constants.getTab(next) !== Tabs.peopleTab
  ) {
    return SignupGen.createClearJustSignedUpEmail()
  }
  return false
}

const initSignup = () => {
  // validation actions
  Container.listenAction(SignupGen.requestInvite, requestInvite)
  Container.listenAction(SignupGen.checkUsername, checkUsername)
  Container.listenAction(SignupGen.requestAutoInvite, requestAutoInvite)
  Container.listenAction([SignupGen.requestedAutoInvite, SignupGen.checkInviteCode], checkInviteCode)
  Container.listenAction(SignupGen.checkDevicename, checkDevicename)

  // move to next screen actions
  Container.listenAction(SignupGen.requestedInvite, showInviteSuccessOnNoErrors)
  Container.listenAction(SignupGen.checkedUsername, showDeviceScreenOnNoErrors)
  Container.listenAction(SignupGen.requestedAutoInvite, showInviteScreen)
  Container.listenAction(SignupGen.checkedInviteCode, showUserOnNoErrors)
  Container.listenAction(SignupGen.signedup, showErrorOrCleanupAfterSignup)
  Container.listenAction(SignupGen.signedup, setEmailVisibilityAfterSignup)

  Container.listenAction(RouteTreeGen.onNavChanged, maybeClearJustSignedUpEmail)

  // actually make the signup call
  Container.listenAction(SignupGen.checkedDevicename, reallySignupOnNoErrors)
  Container.listenAction(SignupGen.goBackAndClearErrors, goBackAndClearErrors)
}

export default initSignup
