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

// returns true if there are no errors, we check all errors at every transition just to be extra careful
const noErrors = (state: TypedState) =>
  !state.signup.devicenameError &&
  !state.signup.emailError &&
  !state.signup.inviteCodeError &&
  !state.signup.nameError &&
  !state.signup.usernameError &&
  !state.signup.passphraseError.stringValue() &&
  !state.signup.signupError.stringValue()

const resetNav = () => Saga.put(LoginGen.createNavBasedOnLoginAndInitialState())
// When going back we clear all errors so we can fix things and move forward
const goBackAndClearErrors = () => Saga.put(navigateUp())

const showUserEmailOnNoErrors = (action: SignupGen.CheckedInviteCodePayload, state: TypedState) =>
  noErrors(state) && Saga.put(navigateTo([loginTab, 'signup', 'usernameAndEmail']))

const showInviteScreen = () => navigateTo([loginTab, 'signup', 'inviteCode'])

const showInviteSuccessOnNoErrors = (_, state: TypedState) =>
  noErrors(state) && navigateAppend(['requestInviteSuccess'], [loginTab, 'signup'])

const showPassphraseOnNoErrors = (_, state: TypedState) =>
  noErrors(state) && Saga.put(navigateAppend(['passphraseSignup'], [loginTab, 'signup']))

const showDeviceScreenOnNoErrors = (_: SignupGen.CheckPassphrasePayload, state: TypedState) =>
  noErrors(state) && Saga.put(navigateAppend(['deviceName'], [loginTab, 'signup']))

const checkInviteCode = (action: SignupGen.CheckInviteCodePayload) =>
  RPCTypes.signupCheckInvitationCodeRpcPromise(
    {invitationCode: action.payload.inviteCode},
    Constants.waitingKey
  )
    .then(() => SignupGen.createCheckedInviteCode({inviteCode: action.payload.inviteCode}))
    .catch((err: RPCError) =>
      SignupGen.createCheckedInviteCodeError({error: err.desc, inviteCode: action.payload.inviteCode})
    )

const requestAutoInvite = () =>
  RPCTypes.signupGetInvitationCodeRpcPromise(undefined, Constants.waitingKey)
    .then((inviteCode: string) => SignupGen.createRequestedAutoInvite({inviteCode}))
    .catch(() => SignupGen.createRequestedAutoInviteError())

const requestInvite = (action: SignupGen.RequestInvitePayload, state: TypedState) =>
  noErrors(state) &&
  RPCTypes.signupInviteRequestRpcPromise(
    {email: state.signup.email, fullname: state.signup.name, notes: 'Requested through GUI app'},
    Constants.waitingKey
  )
    .then(() =>
      SignupGen.createRequestedInvite({
        email: action.payload.email,
        name: action.payload.name,
      })
    )
    .catch(err =>
      SignupGen.createRequestedInviteError({
        email: action.payload.email,
        emailError: `Sorry can't get an invite: ${err.desc}`,
        name: action.payload.name,
        nameError: '',
      })
    )

const checkUsernameEmail = (action: SignupGen.CheckUsernameEmailPayload, state: TypedState) =>
  noErrors(state) &&
  RPCTypes.signupCheckUsernameAvailableRpcPromise({username: state.signup.username}, Constants.waitingKey)
    .then(r =>
      SignupGen.createCheckedUsernameEmail({
        email: action.payload.email,
        username: action.payload.username,
      })
    )
    .catch(err =>
      SignupGen.createCheckedUsernameEmailError({
        email: action.payload.email,
        emailError: '',
        username: action.payload.username,
        usernameError: `Sorry, there was a problem: ${err.desc}`,
      })
    )

const checkDevicename = (action: SignupGen.CheckDevicenamePayload, state: TypedState) =>
  noErrors(state) &&
  RPCTypes.deviceCheckDeviceNameFormatRpcPromise({name: state.signup.devicename}, Constants.waitingKey)
    .then(() => SignupGen.createCheckedDevicename({devicename: action.payload.devicename}))
    .catch(error =>
      SignupGen.createCheckedDevicenameError({
        devicename: action.payload.devicename,
        error: `Device name is invalid: ${error.desc}.`,
      })
    )

const reallySignupOnNoErrors = (_, state: TypedState) => {
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
      yield Saga.put(
        SignupGen.createSignedupError({error: new HiddenString(`Cant signup, try again? ${error.desc}`)})
      )
    }
  })
}

const showErrorOrCleanupAfterSignup = (_, state: TypedState) =>
  noErrors(state)
    ? Saga.put(SignupGen.createRestartSignup())
    : Saga.put(navigateAppend(['signupError'], [loginTab, 'signup']))

const signupSaga = function*(): Saga.SagaGenerator<any, any> {
  // validation actions
  yield Saga.safeTakeEveryPurePromise(SignupGen.requestInvite, requestInvite)
  yield Saga.safeTakeEveryPurePromise(SignupGen.checkUsernameEmail, checkUsernameEmail)
  yield Saga.safeTakeEveryPurePromise(SignupGen.requestAutoInvite, requestAutoInvite)
  yield Saga.safeTakeEveryPurePromise(
    [SignupGen.requestedAutoInvite, SignupGen.checkInviteCode],
    checkInviteCode
  )
  yield Saga.safeTakeEveryPurePromise(SignupGen.checkDevicename, checkDevicename)

  // move to next screen actions
  yield Saga.safeTakeEveryPure(SignupGen.restartSignup, resetNav)
  yield Saga.safeTakeEveryPure(SignupGen.requestedInvite, showInviteSuccessOnNoErrors)
  yield Saga.safeTakeEveryPure(SignupGen.checkedUsernameEmail, showPassphraseOnNoErrors)
  yield Saga.safeTakeEveryPure(SignupGen.requestedAutoInvite, showInviteScreen)
  yield Saga.safeTakeEveryPure(SignupGen.checkedInviteCode, showUserEmailOnNoErrors)
  yield Saga.safeTakeEveryPure(SignupGen.checkPassphrase, showDeviceScreenOnNoErrors)
  yield Saga.safeTakeEveryPure(SignupGen.signedup, showErrorOrCleanupAfterSignup)

  // actually make the signup call
  yield Saga.safeTakeEveryPure(SignupGen.checkedDevicename, reallySignupOnNoErrors)

  yield Saga.safeTakeEveryPure(SignupGen.goBackAndClearErrors, goBackAndClearErrors)
}

export default signupSaga
