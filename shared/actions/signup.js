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

const showUserEmailOnNoErrors = (action: SignupGen.CheckedInviteCodePayload) =>
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

// TODO move to util/saga
function actionToRPC<Action, RPCResult>(
  pattern: Saga.Pattern,
  getOptions: () => {
    makeRPC: (Action, TypedState) => ?Promise<RPCResult> | false,
    onSuccess: (RPCResult, Action, TypedState) => ?Object,
    onError: (RPCError, Action, TypedState) => ?Object,
  }
) {
  return Saga.safeTakeEvery(pattern, function* actionToRPCWorker(action: Action) {
    const stateBeforeRPC: TypedState = yield Saga.select()
    const options = getOptions()
    try {
      const rpc = options.makeRPC(action, stateBeforeRPC)
      if (!rpc) {
        return
      }
      const result = yield rpc
      const stateBeforeOnSuccess: TypedState = yield Saga.select()
      const successAction = options.onSuccess(result, action, stateBeforeOnSuccess)
      if (successAction) {
        yield Saga.put(successAction)
      }
    } catch (e) {
      const stateBeforeOnError: TypedState = yield Saga.select()
      const errorAction = options.onError(e, action, stateBeforeOnError)
      if (errorAction) {
        yield Saga.put(errorAction)
      }
    }
  })
}

// const requestInvite = () => ({
// makeRPC: (action: SignupGen.RequestInvitePayload, stateBeforeRPC: TypedState) =>
// !stateBeforeRPC.signup.emailError &&
// !stateBeforeRPC.signup.nameError &&
// RPCTypes.signupInviteRequestRpcPromise(
// {
// email: stateBeforeRPC.signup.email,
// fullname: stateBeforeRPC.signup.name,
// notes: 'Requested through GUI app',
// },
// Constants.waitingKey
// ),
// onError: (err: RPCError, action: SignupGen.RequestInvitePayload, stateBeforeOnSuccess: TypedState) =>
// SignupGen.createRequestedInviteError({
// email: action.payload.email,
// emailError: `Sorry can't get an invite: ${err.desc}`,
// name: action.payload.name,
// nameError: '',
// }),
// onSuccess: (result: void, action: SignupGen.RequestInvitePayload, stateBeforeOnError: TypedState) =>
// SignupGen.createRequestedInvite({
// email: action.payload.email,
// name: action.payload.name,
// }),
// })

const requestInvite = (action: SignupGen.RequestInvitePayload, state: TypedState) =>
  !state.signup.emailError &&
  !state.signup.nameError &&
  // Saga.call(function*() {
    // yield Saga.put(
    Saga.put(
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
  // })

const showInviteSuccessOnNoErrors = (_, state: TypedState) =>
  !state.signup.emailError &&
  !state.signup.nameError &&
  navigateAppend(['requestInviteSuccess'], [loginTab, 'signup'])

const checkUsernameEmail = (action: SignupGen.CheckUsernameEmailPayload, state: TypedState) =>
  !state.signup.usernameError &&
  !state.signup.emailError &&
  Saga.call(function*() {
    yield Saga.put(
      yield RPCTypes.signupCheckUsernameAvailableRpcPromise(
        {username: state.signup.username},
        Constants.waitingKey
      )
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
    )
  })

const showPassphraseOnNoErrors = (_, state: TypedState) =>
  !state.signup.emailError &&
  !state.signup.usernameError &&
  Saga.put(navigateAppend(['passphraseSignup'], [loginTab, 'signup']))

const showDeviceScreenOnNoErrors = (_: SignupGen.CheckPassphrasePayload, state: TypedState) =>
  !state.signup.passphraseError.stringValue() &&
  Saga.put(navigateAppend(['deviceName'], [loginTab, 'signup']))

const checkDevicename = (action: SignupGen.CheckDevicenamePayload, state: TypedState) =>
  !state.signup.devicenameError &&
  Saga.call(function*() {
    yield Saga.put(
      yield RPCTypes.deviceCheckDeviceNameFormatRpcPromise(
        {name: state.signup.devicename},
        Constants.waitingKey
      )
        .then(() => SignupGen.createCheckedDevicename({devicename: action.payload.devicename}))
        .catch(error =>
          SignupGen.createCheckedDevicenameError({
            devicename: action.payload.devicename,
            error: `Device name is invalid: ${error.desc}.`,
          })
        )
    )
  })

const reallySignup = (_, state: TypedState) => {
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
      yield Saga.put(SignupGen.createSignedup())
    } catch (error) {
      yield Saga.put(
        SignupGen.createSignedupError({error: new HiddenString(`Cant signup, try again? ${error.desc}`)})
      )
    }
  })
}

const resetNav = () => Saga.put(LoginGen.createNavBasedOnLoginAndInitialState())
const cleanupSignupOnNoErrors = (_, state: TypedState) =>
  !!state.signup.signupError.stringValue() && Saga.put(SignupGen.createRestartSignup())

const signupSaga = function*(): Saga.SagaGenerator<any, any> {
  // validation actions
  yield Saga.safeTakeEveryPure(SignupGen.requestInvite, requestInvite)
  // yield actionToRPC(SignupGen.requestInvite, requestInvite)
  yield Saga.safeTakeEveryPure(SignupGen.checkUsernameEmail, checkUsernameEmail)
  yield Saga.safeTakeEveryPure(SignupGen.requestAutoInvite, requestAutoInvite)
  yield Saga.safeTakeEveryPure([SignupGen.requestedAutoInvite, SignupGen.checkInviteCode], checkInviteCode)
  yield Saga.safeTakeEveryPure(SignupGen.checkDevicename, checkDevicename)
  yield Saga.safeTakeEveryPure(SignupGen.checkedDevicename, reallySignup)

  // move to next screen actions
  yield Saga.safeTakeEveryPure(SignupGen.restartSignup, resetNav)
  yield Saga.safeTakeEveryPure(SignupGen.requestedInvite, showInviteSuccessOnNoErrors)
  yield Saga.safeTakeEveryPure(SignupGen.checkedUsernameEmail, showPassphraseOnNoErrors)
  yield Saga.safeTakeEveryPure(SignupGen.requestedAutoInvite, showInviteScreen)
  yield Saga.safeTakeEveryPure(SignupGen.checkedInviteCode, showUserEmailOnNoErrors)
  yield Saga.safeTakeEveryPure(SignupGen.checkPassphrase, showDeviceScreenOnNoErrors)
  yield Saga.safeTakeEveryPure(SignupGen.signedup, cleanupSignupOnNoErrors)
}

export default signupSaga
