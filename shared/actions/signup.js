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
import {navigateAppend, navigateTo} from '../actions/route-tree'
import {RPCError} from '../util/errors'
import type {TypedState} from '../constants/reducer'

const checkInviteCode = (action: SignupGen.CheckInviteCodePayload) =>
  Saga.call(function*() {
    yield Saga.put(
      yield RPCTypes.signupCheckInvitationCodeRpcPromise(
        {invitationCode: action.payload.inviteCode},
        Constants.waitingKey
      )
        .then(() => SignupGen.createCheckedInviteCode({inviteCode: action.payload.inviteCode}))
        .catch((err: RPCError) =>
          SignupGen.createCheckedInviteCodeError({error: err.desc, inviteCode: action.payload.inviteCode})
        )
    )
  })

const showErrorOrMoveToUserEmail = (action: SignupGen.CheckedInviteCodePayload) =>
  !action.error && Saga.put(navigateTo([loginTab, 'signup', 'usernameAndEmail']))

const requestAutoInvite = () =>
  Saga.call(function*() {
    yield Saga.put(
      yield RPCTypes.signupGetInvitationCodeRpcPromise(undefined, Constants.waitingKey)
        .then((inviteCode: string) => SignupGen.createRequestedAutoInvite({inviteCode}))
        .catch(() => SignupGen.createRequestedAutoInviteError())
    )
  })

const showInviteScreen = () => navigateTo([loginTab, 'signup', 'inviteCode'])

const requestInvite = (action: SignupGen.RequestInvitePayload, state: TypedState) =>
  !state.signup.emailError &&
  !state.signup.nameError &&
  Saga.call(function*() {
    yield Saga.put(
      yield RPCTypes.signupInviteRequestRpcPromise(
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
    )
  })

const showErrorOrMoveToInviteSuccess = () => navigateAppend(['requestInviteSuccess'], [loginTab, 'signup'])

const validateUsernameEmail = (action: SignupGen.CheckUsernameEmailPayload, state: TypedState) =>
  !state.signup.usernameError &&
  !state.signup.emailError &&
  Saga.call(function*() {
    yield Saga.put(
      yield RPCTypes.signupCheckUsernameAvailableRpcPromise(
        {username: state.signup.username},
        Constants.waitingKey
      )
        .then(r =>
          SignupGen.createValidatedUsernameEmail({
            email: action.payload.email,
            username: action.payload.username,
          })
        )
        .catch(err =>
          SignupGen.createValidatedUsernameEmailError({
            email: action.payload.email,
            emailError: '',
            username: action.payload.username,
            usernameError: `Sorry, there was a problem: ${err.desc}`,
          })
        )
    )
  })
const showErrorOrMoveToPassphrase = (
  action: SignupGen.ValidatedUsernameEmailPayload | SignupGen.ValidatedUsernameEmailPayloadError
) => !action.error && Saga.put(navigateAppend(['passphraseSignup'], [loginTab, 'signup']))

const moveToDeviceScreen = (_: SignupGen.CheckPassphrasePayload, state: TypedState) =>
  !state.signup.passphraseError.stringValue() &&
  Saga.put(navigateAppend(['deviceName'], [loginTab, 'signup']))

const submitDevicename = (_: SignupGen.SubmitDevicenamePayload, state: TypedState) =>
  !state.signup.devicenameError &&
  Saga.call(
    RPCTypes.deviceCheckDeviceNameFormatRpcPromise,
    {name: state.signup.devicename},
    Constants.waitingKey
  )
const submitDevicenameSuccess = () => Saga.put(SignupGen.createSignup())
const submitDevicenameError = (err: RPCError, action: SignupGen.SubmitDevicenamePayload) => {
  logger.warn('device name is invalid: ', err)
  return Saga.put(
    SignupGen.createSubmitDevicenameDoneError({
      devicename: action.payload.devicename,
      error: `Device name is invalid: ${err.desc}.`,
    })
  )
}

const signup = (action: SignupGen.SignupPayload, state: TypedState) => {
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

  return RPCTypes.signupSignupRpcSaga({
    incomingCallMap: {
      // Do not add a gpg key for now
      'keybase.1.gpgUi.wantToAddGPGKey': (params, response, state) => {
        response.result(false)
      },
      // We dont show the paperkey anymore
      'keybase.1.loginUi.displayPrimaryPaperKey': () =>
        Saga.put(navigateAppend(['success'], [loginTab, 'signup'])),
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
}
const signupSuccess = (result: RPCTypes.SignupRes) => {
  if (result) {
    logger.info('Successful signup', result.passphraseOk, result.postOk, result.writeOk)
    // we're done: clear out any signup data
    return Saga.put(SignupGen.createRestartSignup())
  } else {
    return Saga.sequentially([
      Saga.put(SignupGen.createSignupError({signupError: new HiddenString('Cant signup, try again?')})),
      Saga.put(navigateAppend(['signupError'], [loginTab, 'signup'])),
    ])
  }
}
const signupError = (err: RPCError) => {
  logger.warn('error in signup:', err)
  return Saga.sequentially([
    Saga.put(SignupGen.createSignupError({signupError: new HiddenString(err.desc)})),
    Saga.put(navigateAppend(['signupError'], [loginTab, 'signup'])),
  ])
}

const resetNav = () => Saga.put(LoginGen.createNavBasedOnLoginAndInitialState())

const signupSaga = function*(): Saga.SagaGenerator<any, any> {
  yield Saga.safeTakeEveryPure(SignupGen.restartSignup, resetNav)
  yield Saga.safeTakeEveryPure(SignupGen.checkUsernameEmail, validateUsernameEmail)
  yield Saga.safeTakeEveryPure(SignupGen.validatedUsernameEmail, showErrorOrMoveToPassphrase)

  yield Saga.safeTakeEveryPure(SignupGen.requestInvite, requestInvite)
  yield Saga.safeTakeEveryPure(SignupGen.requestedInvite, showErrorOrMoveToInviteSuccess)

  yield Saga.safeTakeEveryPure(SignupGen.requestAutoInvite, requestAutoInvite)
  yield Saga.safeTakeEveryPure(SignupGen.requestedAutoInvite, showInviteScreen)

  yield Saga.safeTakeEveryPure([SignupGen.requestedAutoInvite, SignupGen.checkInviteCode], checkInviteCode)
  yield Saga.safeTakeEveryPure(SignupGen.checkedInviteCode, showErrorOrMoveToUserEmail)

  yield Saga.safeTakeEveryPure(SignupGen.checkPassphrase, moveToDeviceScreen)
  yield Saga.safeTakeEveryPure(
    SignupGen.submitDevicename,
    submitDevicename,
    submitDevicenameSuccess,
    submitDevicenameError
  )
  yield Saga.safeTakeEveryPure(SignupGen.signup, signup, signupSuccess, signupError)
}

export default signupSaga
