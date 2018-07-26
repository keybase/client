// @flow
import logger from '../logger'
import * as Constants from '../constants/signup'
import * as LoginGen from './login-gen'
import * as SignupGen from './signup-gen'
import * as Saga from '../util/saga'
import * as RPCTypes from '../constants/types/rpc-gen'
import HiddenString from '../util/hidden-string'
import {isMobile} from '../constants/platform'
import {loginTab} from '../constants/tabs'
import {navigateAppend, navigateTo, navigateUp} from '../actions/route-tree'
import {RPCError} from '../util/errors'
import type {TypedState} from '../constants/reducer'

// Helpers ///////////////////////////////////////////////////////////
// returns true if there are no errors, we check all errors at every transition just to be extra careful
const noErrors = (state: TypedState) =>
  !state.signup.devicenameError &&
  !state.signup.emailError &&
  !state.signup.inviteCodeError &&
  !state.signup.nameError &&
  !state.signup.usernameError &&
  !state.signup.passphraseError.stringValue() &&
  !state.signup.signupError.stringValue()

// Navigation side effects ///////////////////////////////////////////////////////////
const resetNav = () => Saga.put(LoginGen.createNavBasedOnLoginAndInitialState())
// When going back we clear all errors so we can fix things and move forward
const goBackAndClearErrors = () => Saga.put(navigateUp())

const showUserEmailOnNoErrors = (state: TypedState) =>
  noErrors(state) && Saga.put(navigateTo([loginTab, 'signup', 'usernameAndEmail']))

const showInviteScreen = () => navigateTo([loginTab, 'signup', 'inviteCode'])

const showInviteSuccessOnNoErrors = (state: TypedState) =>
  noErrors(state) && navigateAppend(['requestInviteSuccess'], [loginTab, 'signup'])

const showPassphraseOnNoErrors = (state: TypedState) =>
  noErrors(state) && Saga.put(navigateAppend(['passphraseSignup'], [loginTab, 'signup']))

const showDeviceScreenOnNoErrors = (state: TypedState) =>
  noErrors(state) && Saga.put(navigateAppend(['deviceName'], [loginTab, 'signup']))

const showErrorOrCleanupAfterSignup = (state: TypedState) =>
  noErrors(state)
    ? Saga.put(SignupGen.createRestartSignup())
    : Saga.put(navigateAppend(['signupError'], [loginTab, 'signup']))

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

const checkUsernameEmail = (state: TypedState) =>
  noErrors(state) &&
  RPCTypes.signupCheckUsernameAvailableRpcPromise({username: state.signup.username}, Constants.waitingKey)
    .then(r =>
      SignupGen.createCheckedUsernameEmail({
        email: state.signup.email,
        username: state.signup.username,
      })
    )
    .catch(err =>
      SignupGen.createCheckedUsernameEmailError({
        email: state.signup.email,
        emailError: '',
        username: state.signup.username,
        usernameError: `Sorry, there was a problem: ${err.desc}`,
      })
    )

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
const reallySignupOnNoErrors = (state: TypedState) => {
  if (!noErrors(state)) {
    logger.warn('Still has errors, bailing on really signing up')
    return
  }

  const {email, username, inviteCode, passphrase, devicename} = state.signup

  if (!email || !username || !inviteCode || !passphrase || !passphrase.stringValue() || !devicename) {
    logger.warn(
      'Missing data during signup phase',
      email,
      username,
      inviteCode,
      devicename,
      !!passphrase,
      passphrase && !!passphrase.stringValue()
    )
    throw new Error('Missing data for signup')
  }

  return Saga.call(function*() {
    try {
      yield RPCTypes.signupSignupRpcSaga({
        incomingCallMap: {
          // Do not add a gpg key for now
          'keybase.1.gpgUi.wantToAddGPGKey': (params, response, state) => {
            response.result(false)
          },
          // We dont show the paperkey anymore
          'keybase.1.loginUi.displayPrimaryPaperKey': () => {},
        },
        params: {
          deviceName: devicename,
          deviceType: isMobile ? RPCTypes.commonDeviceType.mobile : RPCTypes.commonDeviceType.desktop,
          email,
          genPGPBatch: false,
          genPaper: false,
          inviteCode,
          passphrase: passphrase.stringValue(),
          skipMail: false,
          storeSecret: true,
          username,
        },
        waitingKey: Constants.waitingKey,
      })
      yield Saga.put(SignupGen.createSignedup())
    } catch (error) {
      yield Saga.put(SignupGen.createSignedupError({error: new HiddenString(error.desc)}))
    }
  })
}

const signupSaga = function*(): Saga.SagaGenerator<any, any> {
  // validation actions
  yield Saga.actionToPromise(SignupGen.requestInvite, requestInvite)
  yield Saga.actionToPromise(SignupGen.checkUsernameEmail, checkUsernameEmail)
  yield Saga.actionToPromise(SignupGen.requestAutoInvite, requestAutoInvite)
  yield Saga.actionToPromise([SignupGen.requestedAutoInvite, SignupGen.checkInviteCode], checkInviteCode)
  yield Saga.actionToPromise(SignupGen.checkDevicename, checkDevicename)

  // move to next screen actions
  yield Saga.actionToAction(SignupGen.restartSignup, resetNav)
  yield Saga.actionToAction(SignupGen.requestedInvite, showInviteSuccessOnNoErrors)
  yield Saga.actionToAction(SignupGen.checkedUsernameEmail, showPassphraseOnNoErrors)
  yield Saga.actionToAction(SignupGen.requestedAutoInvite, showInviteScreen)
  yield Saga.actionToAction(SignupGen.checkedInviteCode, showUserEmailOnNoErrors)
  yield Saga.actionToAction(SignupGen.checkPassphrase, showDeviceScreenOnNoErrors)
  yield Saga.actionToAction(SignupGen.signedup, showErrorOrCleanupAfterSignup)

  // actually make the signup call
  yield Saga.actionToAction(SignupGen.checkedDevicename, reallySignupOnNoErrors)

  yield Saga.actionToAction(SignupGen.goBackAndClearErrors, goBackAndClearErrors)
}

export default signupSaga

export const _testing = {
  checkDevicename,
  checkInviteCode,
  checkUsernameEmail,
  goBackAndClearErrors,
  reallySignupOnNoErrors,
  requestAutoInvite,
  requestInvite,
  resetNav,
  showDeviceScreenOnNoErrors,
  showErrorOrCleanupAfterSignup,
  showInviteScreen,
  showInviteSuccessOnNoErrors,
  showPassphraseOnNoErrors,
  showUserEmailOnNoErrors,
}
