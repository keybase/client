import logger from '../logger'
import * as Constants from '../constants/signup'
import * as SignupGen from './signup-gen'
import * as Saga from '../util/saga'
import * as RPCTypes from '../constants/types/rpc-gen'
import {isMobile} from '../constants/platform'
import * as RouteTreeGen from '../actions/route-tree-gen'
import {RPCError} from '../util/errors'
import * as Container from '../util/container'
import * as SettingsGen from './settings-gen'

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

const showEmailScreenOnNoErrors = (state: Container.TypedState) =>
  noErrors(state) && RouteTreeGen.createNavigateAppend({path: ['signupEnterEmail']})

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
  } catch (e) {
    const err: RPCError = e
    return SignupGen.createCheckedInviteCodeError({error: err.desc, inviteCode: state.signup.inviteCode})
  }
}

const requestAutoInvite = async () => {
  try {
    const inviteCode = await RPCTypes.signupGetInvitationCodeRpcPromise(undefined, Constants.waitingKey)
    return SignupGen.createRequestedAutoInvite({inviteCode})
  } catch (_) {
    return SignupGen.createRequestedAutoInviteError()
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
  } catch (e) {
    const err: RPCError = e
    return SignupGen.createRequestedInviteError({
      email: state.signup.email,
      emailError: `Sorry can't get an invite: ${err.desc}`,
      name: state.signup.name,
      nameError: '',
    })
  }
}

const checkUsername = async (
  state: Container.TypedState,
  _: SignupGen.CheckUsernamePayload,
  logger: Saga.SagaLogger
) => {
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
  } catch (e) {
    const err: RPCError = e
    logger.warn(`${state.signup.username} error: ${err.message}`)
    const error = err.code === RPCTypes.StatusCode.scinputerror ? Constants.usernameHint : err.desc
    return SignupGen.createCheckedUsername({
      // Don't set error if it's 'username taken', we show a banner in that case
      error: err.code === RPCTypes.StatusCode.scbadsignupusernametaken ? '' : error,
      username: state.signup.username,
      usernameTaken:
        err.code === RPCTypes.StatusCode.scbadsignupusernametaken ? state.signup.username : undefined,
    })
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
  } catch (e) {
    const err: RPCError = e
    return SignupGen.createCheckedDevicenameError({
      devicename: state.signup.devicename,
      error: `Device name is invalid: ${err.desc}.`,
    })
  }
}

// Actually sign up ///////////////////////////////////////////////////////////
function* reallySignupOnNoErrors(state: Container.TypedState): Saga.SagaGenerator<any, any> {
  if (!noErrors(state)) {
    logger.warn('Still has errors, bailing on really signing up')
    return
  }

  const {email, username, inviteCode, devicename} = state.signup

  if (!email || !username || !inviteCode || !devicename) {
    logger.warn('Missing data during signup phase', email, username, inviteCode, devicename)
    throw new Error('Missing data for signup')
  }

  try {
    yield RPCTypes.signupSignupRpcSaga({
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
        deviceName: devicename,
        deviceType: isMobile ? RPCTypes.DeviceType.mobile : RPCTypes.DeviceType.desktop,
        email,
        genPGPBatch: false,
        genPaper: false,
        inviteCode,
        passphrase: '',
        randomPw: true,
        skipMail: false,
        storeSecret: true,
        username,
        verifyEmail: true,
      },
      waitingKey: Constants.waitingKey,
    })
    yield Saga.put(SignupGen.createSignedup())
  } catch (error) {
    yield Saga.put(SignupGen.createSignedupError({error}))
  }
}

const signupSaga = function*(): Saga.SagaGenerator<any, any> {
  // validation actions
  yield* Saga.chainAction2(SignupGen.requestInvite, requestInvite)
  yield* Saga.chainAction2(SignupGen.checkUsername, checkUsername, 'checkUsername')
  yield* Saga.chainAction2(SignupGen.requestAutoInvite, requestAutoInvite)
  yield* Saga.chainAction2([SignupGen.requestedAutoInvite, SignupGen.checkInviteCode], checkInviteCode)
  yield* Saga.chainAction2(SignupGen.checkDevicename, checkDevicename)

  // move to next screen actions\
  yield* Saga.chainAction2(SignupGen.requestedInvite, showInviteSuccessOnNoErrors)
  yield* Saga.chainAction2(SignupGen.checkedUsername, showEmailScreenOnNoErrors)
  yield* Saga.chainAction2(SignupGen.checkEmail, showDeviceScreenOnNoErrors)
  yield* Saga.chainAction2(SignupGen.requestedAutoInvite, showInviteScreen)
  yield* Saga.chainAction2(SignupGen.checkedInviteCode, showUserOnNoErrors)
  yield* Saga.chainAction2(SignupGen.signedup, showErrorOrCleanupAfterSignup)
  yield* Saga.chainAction2(SignupGen.signedup, setEmailVisibilityAfterSignup)

  // actually make the signup call
  yield* Saga.chainGenerator(SignupGen.checkedDevicename, reallySignupOnNoErrors)
  yield* Saga.chainAction2(SignupGen.goBackAndClearErrors, goBackAndClearErrors)
}

export default signupSaga

export const _testing = {
  checkDevicename,
  checkInviteCode,
  checkUsername,
  goBackAndClearErrors,
  reallySignupOnNoErrors,
  requestAutoInvite,
  requestInvite,
  showDeviceScreenOnNoErrors,
  showErrorOrCleanupAfterSignup,
  showInviteScreen,
  showInviteSuccessOnNoErrors,
  showUserOnNoErrors,
}
