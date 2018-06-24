// @flow
import logger from '../logger'
import * as Constants from '../constants/signup'
import * as LoginGen from './login-gen'
import * as SignupGen from './signup-gen'
import * as Saga from '../util/saga'
import * as RPCTypes from '../constants/types/rpc-gen'
import HiddenString from '../util/hidden-string'
import {trim} from 'lodash-es'
import {isMobile} from '../constants/platform'
import {isValidEmail, isValidName, isValidUsername} from '../util/simple-validators'
import {loginTab} from '../constants/tabs'
import {navigateAppend, navigateTo} from '../actions/route-tree'
import type {RPCError} from '../engine/types'

function startRequestInvite() {
  return (dispatch: Dispatch) => {
    dispatch(SignupGen.createStartRequestInvite())
    dispatch(navigateAppend(['requestInvite'], [loginTab, 'signup']))
  }
}

function checkInviteCodeThenNextPhase(inviteCode: string) {
  return (dispatch: Dispatch) => {
    dispatch(SignupGen.createCheckInviteCode({inviteCode}))
    RPCTypes.signupCheckInvitationCodeRpcPromise({invitationCode: inviteCode}, Constants.waitingKey)
      .then(() => {
        dispatch(SignupGen.createCheckInviteCode({inviteCode}))
        dispatch(navigateTo([loginTab, 'signup', 'usernameAndEmail']))
      })
      .catch(err => {
        logger.warn('error in inviteCode:', err)
        dispatch(SignupGen.createCheckInviteCodeError({errorText: "Sorry, that's not a valid invite code."}))
      })
  }
}

const requestAutoInvite = () =>
  Saga.call(RPCTypes.signupGetInvitationCodeRpcPromise, undefined, Constants.waitingKey)
const requestAutoInviteSuccess = (inviteCode: string) => Saga.put(checkInviteCodeThenNextPhase(inviteCode))
const requestAutoInviteError = () => Saga.put(navigateTo([loginTab, 'signup', 'inviteCode']))

const requestInvite = (action: SignupGen.RequestInvitePayload) => {
  const {email, name} = action.payload
  const emailError = isValidEmail(email)
  const nameError = isValidName(name)
  if (emailError) {
    return Saga.put(SignupGen.createRequestInviteDoneError({email, emailError, name, nameError: ''}))
  }
  if (nameError) {
    return Saga.put(SignupGen.createRequestInviteDoneError({email, emailError: '', name, nameError}))
  }

  return Saga.call(
    RPCTypes.signupInviteRequestRpcPromise,
    {email: email, fullname: name, notes: 'Requested through GUI app'},
    Constants.waitingKey
  )
}

const requestInviteSuccess = (
  result: SignupGen.RequestInviteDonePayload | void,
  action: SignupGen.RequestInvitePayload
) => {
  // rpc returns undefined, dispatches above on error return the type
  if (result) {
    return
  }
  const {email, name} = action.payload
  return Saga.sequentially([
    Saga.put(SignupGen.createRequestInviteDone({email, name})),
    Saga.put(navigateAppend(['requestInvite'], [loginTab, 'signup'])),
  ])
}

const requestInviteError = (err, action: SignupGen.RequestInvitePayload) => {
  const {email, name} = action.payload
  return Saga.put(SignupGen.createRequestInviteDoneError({email, emailError: err, name, nameError: ''}))
}

const checkUsernameEmail = (action: SignupGen.CheckUsernameEmailPayload) => {
  const {email, username} = action.payload
  const emailError = isValidEmail(email)
  if (emailError) {
    return Saga.put(
      SignupGen.createCheckUsernameEmailDoneError({
        email,
        emailError,
        username,
        usernameError: '',
      })
    )
  }
  const usernameError = isValidUsername(username)
  if (usernameError) {
    return Saga.put(
      SignupGen.createCheckUsernameEmailDoneError({
        email,
        emailError: '',
        username,
        usernameError,
      })
    )
  }

  return Saga.call(RPCTypes.signupCheckUsernameAvailableRpcPromise, {username}, Constants.waitingKey)
}

const checkUsernameEmailSuccess = (
  result: SignupGen.CheckUsernameEmailDonePayloadError | void,
  action: SignupGen.CheckUsernameEmailPayload
) => {
  // rpc returns undefined, dispatches above on error return the type
  if (result) {
    return
  }
  const {email, username} = action.payload
  return Saga.sequentially([
    Saga.put(SignupGen.createCheckUsernameEmailDone({email, username})),
    Saga.put(navigateAppend(['passphraseSignup'], [loginTab, 'signup'])),
  ])
}

const checkUsernameEmailError = (
  err: {email: string, username: string} | RPCError,
  action: SignupGen.CheckUsernameEmailPayload
) => {
  const {email, username} = action.payload
  if (err.email) {
    const e: {email: string} = (err: any)
    return Saga.put(
      SignupGen.createCheckUsernameEmailDoneError({
        email,
        emailError: e.email,
        username,
        usernameError: '',
      })
    )
  } else if (err.username) {
    const e: {username: string} = (err: any)
    return Saga.put(
      SignupGen.createCheckUsernameEmailDoneError({
        email,
        emailError: '',
        username: username,
        usernameError: e.username,
      })
    )
  } else {
    const e: RPCError = (err: any)
    return Saga.put(
      SignupGen.createCheckUsernameEmailDoneError({
        email,
        emailError: '',
        username,
        usernameError: `Sorry, there was a problem: ${e.desc}`,
      })
    )
  }
}

function checkPassphrase(passphrase1: string, passphrase2: string) {
  return (dispatch: Dispatch) => {
    let passphraseError = null
    if (!passphrase1 || !passphrase2) {
      passphraseError = new HiddenString('Fields cannot be blank')
    } else if (passphrase1 !== passphrase2) {
      passphraseError = new HiddenString('Passphrases must match')
    } else if (passphrase1.length < 6) {
      passphraseError = new HiddenString('Passphrase must be at least 6 characters long')
    }

    if (passphraseError) {
      dispatch(
        SignupGen.createCheckPassphraseError({
          passphraseError,
        })
      )
    } else {
      dispatch(
        SignupGen.createCheckPassphrase({
          passphrase: new HiddenString(passphrase1),
        })
      )
      dispatch(navigateAppend(['deviceName'], [loginTab, 'signup']))
    }
  }
}

function submitDeviceName(deviceName: string, skipMail?: boolean, onDisplayPaperKey?: () => void) {
  return (dispatch: Dispatch) => {
    // TODO do some checking on the device name - ideally this is done on the service side
    let deviceNameError = null
    if (trim(deviceName).length === 0) {
      deviceNameError = 'Device name must not be empty.'
    }

    if (deviceNameError) {
      dispatch(
        SignupGen.createSubmitDeviceNameError({
          deviceNameError: deviceNameError || '',
        })
      )
    } else {
      RPCTypes.deviceCheckDeviceNameFormatRpcPromise({name: deviceName}, Constants.waitingKey)
        .then(() => {
          if (deviceName) {
            dispatch(SignupGen.createSubmitDeviceName({deviceName}))

            const signupPromise = dispatch(signup(skipMail || false, onDisplayPaperKey))
            if (signupPromise) {
              signupPromise.then(resolve, reject)
            } else {
              throw new Error('did not get promise from signup')
            }
          }
        })
        .catch(err => {
          logger.warn('device name is invalid: ', err)
          dispatch(
            SignupGen.createSubmitDeviceNameError({
              deviceNameError: `Device name is invalid: ${err.desc}.`,
            })
          )
        })
    }
  }
}

function signup(skipMail: boolean, onDisplayPaperKey?: () => void) {
  return (dispatch, getState) => {
    const {email, username, inviteCode, passphrase, deviceName} = getState().signup
    const deviceType = isMobile ? RPCTypes.commonDeviceType.mobile : RPCTypes.commonDeviceType.desktop

    if (email && username && inviteCode && passphrase && deviceName) {
      // TODO engine saga
      RPCTypes.signupSignupRpcPromise(
        {
          incomingCallMap: {
            'keybase.1.gpgUi.wantToAddGPGKey': (params, response) => {
              // Do not add a gpg key for now
              response.result(false)
            },
            'keybase.1.loginUi.displayPrimaryPaperKey': ({sessionID, phrase}, response) => {
              // We dont show the paperkey anymore
              response.result()
              dispatch(navigateAppend(['success'], [loginTab, 'signup']))
            },
          },
          deviceName,
          deviceType,
          email,
          genPGPBatch: false,
          genPaper: false,
          inviteCode,
          passphrase: passphrase.stringValue(),
          skipMail,
          storeSecret: true,
          username,
        },
        Constants.waitingKey
      )
        .then(({passphraseOk, postOk, writeOk}) => {
          logger.info('Successful signup', passphraseOk, postOk, writeOk)
        })
        .catch(err => {
          logger.warn('error in signup:', err)
          dispatch(SignupGen.createSignupError({signupError: new HiddenString(err.desc)}))
          dispatch(navigateAppend(['signupError'], [loginTab, 'signup']))
        })
    } else {
      logger.warn('Entered signup action with a null required field')
    }
  }
}

const resetNav = () => Saga.put(LoginGen.createNavBasedOnLoginAndInitialState())

const signupSaga = function*(): Saga.SagaGenerator<any, any> {
  yield Saga.safeTakeEveryPure(SignupGen.restartSignup, resetNav)
  yield Saga.safeTakeEveryPure(
    SignupGen.checkUsernameEmail,
    checkUsernameEmail,
    checkUsernameEmailSuccess,
    checkUsernameEmailError
  )
  yield Saga.safeTakeEveryPure(
    SignupGen.requestInvite,
    requestInvite,
    requestInviteSuccess,
    requestInviteError
  )
  yield Saga.safeTakeEveryPure(
    SignupGen.requestAutoInvite,
    requestAutoInvite,
    requestAutoInviteSuccess,
    requestAutoInviteError
  )
}

export {checkInviteCodeThenNextPhase, checkPassphrase, startRequestInvite, submitDeviceName}
export default signupSaga
