/* @flow */

import _ from 'lodash'
import * as Constants from '../../constants/signup'
import {Map} from 'immutable'
import HiddenString from '../../util/hidden-string'
import engine from '../../engine'
import {loginTab} from '../../constants/tabs'

import {take, call, put, cps, race, select, fork} from 'redux-saga/effects'
import {isCancelError} from 'redux-saga'

import {routeAppend, navigateUp} from '../../actions/router'

import type {CheckPassphrase, ResetSignup, RequestInvite, StartRequestInvite, SawPaperKey, RequestInviteCodeCheck, RequestSubmitDeviceName, RequestCheckUsernameEmail} from '../../constants/signup'
import type {signup_signup_rpc, signup_checkInvitationCode_rpc, signup_checkUsernameAvailable_rpc, signup_inviteRequest_rpc, device_checkDeviceNameFormat_rpc} from '../../constants/types/flow-types'

// TODO change waitingHandler to better fit saga model (put an action)

// helpers

const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

function checkRequestInvite (email, name): ?{emailError: ?string, nameError: ?string} {
  const emailError = isValidEmail(email)
  const nameError = isValidName(name)
  if (emailError || nameError || !email || !name) {
    return {emailError, nameError}
  }
}

export function requestInvite (email: string, name: string): RequestInvite {
  return {type: Constants.requestInvite, payload: {email, name}}
}

function isBlank (s: string): boolean {
  return _.trim(s).length === 0
}

function hasSpaces (s: string): boolean {
  return s.indexOf(' ') !== -1
}

function hasAtSign (s: string): boolean {
  return s.indexOf('@') !== -1
}

function isEmptyOrBlank (thing: ?string): boolean {
  if (!thing || isBlank(thing)) {
    return true
  }
  return false
}

// Returns an error string if not valid
function isValidCommon (thing: ?string): ?string {
  if (isEmptyOrBlank(thing)) return 'Cannot be blank'
  if (thing && hasSpaces(thing)) return 'No spaces allowed'
}

// Returns an error string if not valid
function isValidUsername (username: ?string): ?string {
  const commonError = isValidCommon(username)
  if (commonError) {
    return commonError
  }
}

// Returns an error string if not valid
function isValidEmail (email: ?string): ?string {
  const commonError = isValidCommon(email)
  if (commonError) {
    return commonError
  }

  if (email && !hasAtSign(email)) {
    return 'Invalid email address.'
  }
}

// Returns an error string if not valid
function isValidName (name: ?string): ?string {
  if (isEmptyOrBlank(name)) return 'Please provide your name.'
}

function usernameEmailErrors (username: ?string, email: ?string): ?{emailError: ?string, usernameError: ?string} {
  const emailError = isValidEmail(email)
  const usernameError = isValidUsername(username)

  if (emailError || usernameError || !username || !email) {
    return {emailError, usernameError}
  }

  return null
}

// Actions components use

export function startRequestInvite (): StartRequestInvite {
  return {type: Constants.startRequestInvite, payload: {}}
}

export function requestInviteCodeCheck (inviteCode: string): RequestInviteCodeCheck {
  return {type: Constants.requestInviteCodeCheck, payload: inviteCode}
}

export function requestSubmitDeviceName (name: string): RequestSubmitDeviceName {
  return {type: Constants.requestSubmitDeviceName, payload: name}
}

export function requestCheckUsernameEmail (username: string, email: string): RequestCheckUsernameEmail {
  return {type: Constants.requestCheckUsernameEmail, payload: {username, email}}
}

export function checkPassphrase (passphrase1: string, passphrase2: string): CheckPassphrase {
  let passphraseError = null
  if (!passphrase1 || !passphrase2) {
    passphraseError = new HiddenString('Fields cannot be blank')
  } else if (passphrase1 !== passphrase2) {
    passphraseError = new HiddenString('Passphrases must match')
  } else if (passphrase1.length < 12) {
    passphraseError = new HiddenString('Passphrase must be at least 12 Characters')
  }

  if (passphraseError) {
    return {
      type: Constants.checkPassphrase,
      error: true,
      payload: {passphraseError}
    }
  } else {
    return {
      type: Constants.checkPassphrase,
      payload: {passphrase: new HiddenString(passphrase1)}
    }
  }
}

export function resetSignup (): ResetSignup {
  return {type: Constants.resetSignup, payload: {}}
}

export function sawPaperKey (): SawPaperKey {
  return {type: Constants.sawPaperKey, payload: undefined}
}

type NodeCB = (err: ?any, result: ?any) => void

// Wrappers around service calls
function checkInviteCodeWithService (invitationCode: string, callback: NodeCB) {
  const params: signup_checkInvitationCode_rpc = {
    method: 'signup.checkInvitationCode',
    param: {invitationCode},
    incomingCallMap: {},
    // TODO figure out waiting handler
    waitingHandler: () => {},
    callback
  }
  engine.rpc(params)
}

function checkUsernameAvailable (username: string, callback: NodeCB) {
  const params: signup_checkUsernameAvailable_rpc = {
    method: 'signup.checkUsernameAvailable',
    param: {username},
    waitingHandler: () => {},
    incomingCallMap: {},
    callback
  }

  engine.rpc(params)
}

function checkDeviceNameFormat (name: string, callback: NodeCB) {
  const params: device_checkDeviceNameFormat_rpc = {
    method: 'device.checkDeviceNameFormat',
    param: {name},
    waitingHandler: () => {},
    incomingCallMap: {},
    callback
  }
  engine.rpc(params)
}

// This one is a bit different, since we don't want to change how everything in engine works just yet.
// It's still a thunked actions
function signupWithService (email: string, username: string, inviteCode: string, passphrase: HiddenString, deviceName: string, skipMail: boolean) {
  return (dispatch, getState) => {
    const params: signup_signup_rpc = {
      method: 'signup.signup',
      waitingHandler: () => {},
      param: {
        email,
        inviteCode,
        username,
        deviceName,
        passphrase: passphrase.stringValue(),
        storeSecret: false,
        skipMail
      },
      incomingCallMap: {
        'keybase.1.loginUi.displayPrimaryPaperKey': ({sessionID, phrase}, response) => {
          dispatch({type: 'keybase.1.loginUi.displayPrimaryPaperKey', payload: {phrase, response}})
        },
        'keybase.1.gpgUi.wantToAddGPGKey': (params, {error, result}) => {
          // Do not add a gpg key for now
          result(false)
        }
      },
      callback: (error, result) => {
        dispatch({type: 'keybase.1.signup.signup', payload: {error, result}})
      }
    }
    engine.rpc(params)
  }
}

function requestInviteWithService (email: string, name: string, callback: NodeCB) {
  const params: signup_inviteRequest_rpc = {
    method: 'signup.inviteRequest',
    param: {
      email: email,
      fullname: name,
      notes: 'Requested through GUI app'
    },
    waitingHandler: () => {},
    incomingCallMap: {},
    callback
  }
  engine.rpc(params)
}

// Sagas

function * requestInviteSaga () {
  while (true) {
    yield take(Constants.startRequestInvite)
    yield put(routeAppend('requestInvite'))
    // $FlowIssue
    const {payload: {email, name}} = yield take(Constants.requestInvite)
    const errors = checkRequestInvite(email, name)
    if (errors) {
      yield put({type: Constants.requestInvite, error: true, payload: {...errors, email, name}})
      continue
    }

    try {
      yield cps(requestInviteWithService, email, name)
      yield put(routeAppend('requestInviteSuccess'))
      return
    } catch (err) {
      yield put({
        type: Constants.requestInvite,
        payload: {error: true, emailError: err.message, nameError: null, email, name}
      })
    }
  }
}

function * checkInviteCodeSaga (): any {
  while (true) {
    yield take(Constants.requestInviteCodeCheck)

    // $FlowIssue sagas aren't typed
    const {payload: inviteCode} = yield take(Constants.requestInviteCodeCheck)
    try {
      yield cps(checkInviteCodeWithService, inviteCode)
      yield put({type: Constants.checkInviteCode, payload: {inviteCode}})
      return
    } catch (e) {
      yield put({type: Constants.checkInviteCode, error: true, payload: {errorText: "Sorry, that's not a valid invite code."}})
    }
  }
}

function * checkUsernameEmailSaga (): any {
  while (true) {
    // $FlowIssue sagas aren't typed
    const {payload: {username, email}} = yield take(Constants.requestCheckUsernameEmail)
    try {
      const errors = usernameEmailErrors(username, email)
      if (errors) {
        yield put({
          type: Constants.checkUsernameEmail,
          error: true,
          payload: {email, username, ...errors}
        })
        continue
      }
      yield cps(checkUsernameAvailable, username)
      // Looks good, lets save the username email in the store and move on
      yield put({type: Constants.checkUsernameEmail, payload: {username, email}})
      return
    } catch (err) {
      yield put({
        type: Constants.checkUsernameEmail,
        error: true,
        payload: {emailError: undefined, usernameError: `Username error: ${err.message || 'Unknown'}`, email, username}
      })
    }
  }
}

function * checkPassphraseSaga (): any {
  while (true) {
    const checkPassphraseAction = yield take(Constants.checkPassphrase)
    if (checkPassphraseAction && !checkPassphraseAction.error) {
      return
    }
  }
}

function * deviceNameSaga (): any {
  while (true) {
    // $FlowIssue
    const {payload: deviceName} = yield take(Constants.requestSubmitDeviceName)

    if (_.trim(deviceName).length === 0) {
      const deviceNameError = 'Device name must not be empty.'
      yield put({
        type: Constants.submitDeviceName,
        error: true,
        payload: {deviceNameError}
      })
      continue
    }

    try {
      yield cps(checkDeviceNameFormat, deviceName)
      yield put({
        type: Constants.submitDeviceName,
        payload: {deviceName}
      })
      return
    } catch (err) {
      yield put({
        type: Constants.submitDeviceName,
        error: true,
        payload: {deviceNameError: `Device name is invalid: ${err.message}.`, deviceName}
      })
    }
  }
}

function * paperKeySaga (): any {
  // $FlowIssue
  const {paperKey, timedout} = yield race({
    paperKey: take('keybase.1.loginUi.displayPrimaryPaperKey'),
    timedout: call(delay, 5e3)
  })

  if (timedout) {
    console.log('timed out waiting to show paper key')
    yield put({type: Constants.resetSignup, payload: undefined})
    return
  }

  yield put({
    type: Constants.showPaperKey,
    payload: {paperkey: new HiddenString(paperKey.payload.phrase)}
  })
  yield put(routeAppend('paperkey'))
  yield take(Constants.sawPaperKey)
  paperKey.payload.response.result()
}

function * signupFinish (): any {
  // $FlowIssue
  const {payload: {error}} = yield take('keybase.1.signup.signup')
  if (error) {
    yield put({type: Constants.signup, error: true, payload: {signupError: new HiddenString(error + '')}})
    yield put(routeAppend('signupError'))
    return
  }
  console.log('Successful signup')
}

function signupArgsSelector (state) {
  const {email, username, inviteCode, passphrase, deviceName} = state.signup
  return {email, username, inviteCode, passphrase, deviceName}
}

// The real meat, this describes how the signup flow
function * signupFlow (): any {
  try {
    // $FlowIssue
    const {requestInvite} = yield race({
      requestInvite: call(requestInviteSaga),
      checkInviteCode: call(checkInviteCodeSaga)
    })

    // The user requested an invite we're done with the signup flow
    if (requestInvite) {
      return
    }

    yield put(routeAppend('usernameAndEmail'))
    yield call(checkUsernameEmailSaga)
    yield put(routeAppend('passphraseSignup'))
    yield call(checkPassphraseSaga)
    yield put(routeAppend('deviceName'))
    yield call(deviceNameSaga)
    // $FlowIssue
    const {email, username, inviteCode, passphrase, deviceName} = yield select(signupArgsSelector)
    yield put(signupWithService(email, username, inviteCode, passphrase, deviceName, false))
    yield fork(paperKeySaga)
    yield call(signupFinish)
  } catch (e) {
    if (isCancelError(e)) {}
  }
}

function * resetSignupSaga (): any {
  yield take(Constants.resetSignup)
  yield put(navigateUp(loginTab, Map({path: 'signup'})))
  yield put(navigateUp())
}

export function * signupSaga (): any {
  while (true) {
    yield race({
      success: call(signupFlow),
      reset: call(resetSignupSaga)
    })
  }
}
