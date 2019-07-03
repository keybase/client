import logger from '../logger'
import * as Constants from '../constants/signup'
import * as SignupGen from './signup-gen'
import * as Saga from '../util/saga'
import * as RPCTypes from '../constants/types/rpc-gen'
import HiddenString from '../util/hidden-string'
import {isMobile} from '../constants/platform'
import {loginTab} from '../constants/tabs'
import * as RouteTreeGen from '../actions/route-tree-gen'
import {RPCError} from '../util/errors'
import {TypedState} from '../constants/reducer'
import * as SettingsGen from './settings-gen'
import flags from '../util/feature-flags'

// Helpers ///////////////////////////////////////////////////////////
// returns true if there are no errors, we check all errors at every transition just to be extra careful
const noErrors = (state: TypedState) =>
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

const showUserOnNoErrors = (state: TypedState) =>
  noErrors(state) && [
    RouteTreeGen.createNavigateUp(),
    RouteTreeGen.createNavigateAppend({parentPath: [loginTab], path: ['signupEnterUsername']}),
  ]

const showInviteScreen = () =>
  RouteTreeGen.createNavigateAppend({parentPath: [loginTab], path: ['signupInviteCode']})

const showInviteSuccessOnNoErrors = (state: TypedState) =>
  noErrors(state) &&
  RouteTreeGen.createNavigateAppend({parentPath: [loginTab], path: ['signupRequestInviteSuccess']})

const showEmailScreenOnNoErrors = (state: TypedState) =>
  noErrors(state) && RouteTreeGen.createNavigateAppend({path: ['signupEnterEmail']})

const showDeviceScreenOnNoErrors = (state: TypedState) =>
  noErrors(state) &&
  RouteTreeGen.createNavigateAppend({parentPath: [loginTab], path: ['signupEnterDevicename']})

const showErrorOrCleanupAfterSignup = (state: TypedState) =>
  noErrors(state)
    ? SignupGen.createRestartSignup()
    : RouteTreeGen.createNavigateAppend({parentPath: [loginTab], path: ['signupError']})

// If the email was set to be visible during signup, we need to set that with a separate RPC.
const setEmailVisibilityAfterSignup = (state: TypedState) =>
  flags.sbsContacts &&
  noErrors(state) &&
  state.signup.emailVisible &&
  SettingsGen.createEditEmail({email: state.signup.email, makeSearchable: true})

// Validation side effects ///////////////////////////////////////////////////////////
const checkInviteCode = (state: TypedState) =>
  RPCTypes.signupCheckInvitationCodeRpcPromise(
    {invitationCode: state.signup.inviteCode},
    Constants.waitingKey
  )
    .then(() => SignupGen.createCheckedInviteCode({inviteCode: state.signup.inviteCode}))
    .catch((err: RPCError) =>
      SignupGen.createCheckedInviteCodeError({error: err.desc, inviteCode: state.signup.inviteCode})
    )

const requestAutoInvite = () =>
  RPCTypes.signupGetInvitationCodeRpcPromise(undefined, Constants.waitingKey)
    .then((inviteCode: string) => SignupGen.createRequestedAutoInvite({inviteCode}))
    .catch(() => SignupGen.createRequestedAutoInviteError())

const requestInvite = (state: TypedState) =>
  noErrors(state) &&
  RPCTypes.signupInviteRequestRpcPromise(
    {email: state.signup.email, fullname: state.signup.name, notes: 'Requested through GUI app'},
    Constants.waitingKey
  )
    .then(() =>
      SignupGen.createRequestedInvite({
        email: state.signup.email,
        name: state.signup.name,
      })
    )
    .catch(err =>
      SignupGen.createRequestedInviteError({
        email: state.signup.email,
        emailError: `Sorry can't get an invite: ${err.desc}`,
        name: state.signup.name,
        nameError: '',
      })
    )

const checkUsername = (state: TypedState, _, logger) => {
  logger.info(`checking ${state.signup.username}`)
  return (
    noErrors(state) &&
    RPCTypes.signupCheckUsernameAvailableRpcPromise({username: state.signup.username}, Constants.waitingKey)
      .then(() => {
        logger.info(`${state.signup.username} success`)
        return SignupGen.createCheckedUsername({error: '', username: state.signup.username})
      })
      .catch(err => {
        logger.warn(`${state.signup.username} error: ${err.message}`)
        const error = err.code === RPCTypes.StatusCode.scinputerror ? Constants.usernameHint : err.desc
        return SignupGen.createCheckedUsername({
          // Don't set error if it's 'username taken', we show a banner in that case
          error: err.code === RPCTypes.StatusCode.scbadsignupusernametaken ? '' : error,
          username: state.signup.username,
          usernameTaken:
            err.code === RPCTypes.StatusCode.scbadsignupusernametaken ? state.signup.username : null,
        })
      })
  )
}

const checkDevicename = (state: TypedState) =>
  noErrors(state) &&
  RPCTypes.deviceCheckDeviceNameFormatRpcPromise({name: state.signup.devicename}, Constants.waitingKey)
    .then(() => SignupGen.createCheckedDevicename({devicename: state.signup.devicename}))
    .catch(error =>
      SignupGen.createCheckedDevicenameError({
        devicename: state.signup.devicename,
        error: `Device name is invalid: ${error.desc}.`,
      })
    )

// Actually sign up ///////////////////////////////////////////////////////////
function* reallySignupOnNoErrors(state: TypedState): Saga.SagaGenerator<any, any> {
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
  yield* Saga.chainAction<SignupGen.RequestInvitePayload>(SignupGen.requestInvite, requestInvite)
  yield* Saga.chainAction<SignupGen.CheckUsernamePayload>(
    SignupGen.checkUsername,
    checkUsername,
    'checkUsername'
  )
  yield* Saga.chainAction<SignupGen.RequestAutoInvitePayload>(SignupGen.requestAutoInvite, requestAutoInvite)
  yield* Saga.chainAction<SignupGen.RequestedAutoInvitePayload | SignupGen.CheckInviteCodePayload>(
    [SignupGen.requestedAutoInvite, SignupGen.checkInviteCode],
    checkInviteCode
  )
  yield* Saga.chainAction<SignupGen.CheckDevicenamePayload>(SignupGen.checkDevicename, checkDevicename)

  // move to next screen actions\
  yield* Saga.chainAction<SignupGen.RequestedInvitePayload>(
    SignupGen.requestedInvite,
    showInviteSuccessOnNoErrors
  )
  yield* Saga.chainAction<SignupGen.CheckedUsernamePayload>(
    SignupGen.checkedUsername,
    showEmailScreenOnNoErrors
  )
  yield* Saga.chainAction<SignupGen.CheckEmailPayload>([SignupGen.checkEmail], showDeviceScreenOnNoErrors)
  yield* Saga.chainAction<SignupGen.RequestedAutoInvitePayload>(
    SignupGen.requestedAutoInvite,
    showInviteScreen
  )
  yield* Saga.chainAction<SignupGen.CheckedInviteCodePayload>(SignupGen.checkedInviteCode, showUserOnNoErrors)
  yield* Saga.chainAction<SignupGen.SignedupPayload>(SignupGen.signedup, showErrorOrCleanupAfterSignup)
  yield* Saga.chainAction<SignupGen.SignedupPayload>(SignupGen.signedup, setEmailVisibilityAfterSignup)

  // actually make the signup call
  yield* Saga.chainGenerator<SignupGen.CheckedDevicenamePayload>(
    SignupGen.checkedDevicename,
    reallySignupOnNoErrors
  )
  yield* Saga.chainAction<SignupGen.GoBackAndClearErrorsPayload>(
    SignupGen.goBackAndClearErrors,
    goBackAndClearErrors
  )
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
