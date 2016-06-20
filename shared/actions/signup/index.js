/* @flow */

import _ from 'lodash'
import * as Constants from '../../constants/signup'
import {Map} from 'immutable'
import HiddenString from '../../util/hidden-string'
import engine from '../../engine'
import {loginTab} from '../../constants/tabs'

import {routeAppend, navigateUp} from '../../actions/router'

import type {TypedAsyncAction, AsyncAction} from '../../constants/types/flux'
import type {RouteAppend} from '../../constants/router'
import type {CheckInviteCode, CheckUsernameEmail, CheckPassphrase, SubmitDeviceName, Signup, ShowPaperKey, ShowSuccess, ResetSignup, RequestInvite, StartRequestInvite, SignupWaiting} from '../../constants/signup'
import type {signupSignupRpc, signupCheckInvitationCodeRpc, signupCheckUsernameAvailableRpc,
  signupInviteRequestRpc, deviceCheckDeviceNameFormatRpc} from '../../constants/types/flow-types'

function nextPhase (): TypedAsyncAction<RouteAppend> {
  return (dispatch, getState) => {
    // TODO careful here since this will not be sync on a remote component!
    const phase: string = getState().signup.phase
    dispatch(routeAppend(phase))
  }
}

export function startRequestInvite (): TypedAsyncAction<StartRequestInvite | RouteAppend> {
  return dispatch => new Promise((resolve, reject) => {
    dispatch({type: Constants.startRequestInvite, payload: {}})
    dispatch(nextPhase())
  })
}

export function checkInviteCode (inviteCode: string): TypedAsyncAction<CheckInviteCode | RouteAppend | SignupWaiting> {
  return dispatch => new Promise((resolve, reject) => {
    dispatch({type: Constants.checkInviteCode, payload: {inviteCode}})

    const params: signupCheckInvitationCodeRpc = {
      method: 'signup.checkInvitationCode',
      param: {
        invitationCode: inviteCode,
      },
      incomingCallMap: {},
      waitingHandler: isWaiting => dispatch(waiting(isWaiting)),
      callback: err => {
        if (err) {
          console.warn('error in inviteCode:', err)
          dispatch({type: Constants.checkInviteCode, error: true, payload: {errorText: "Sorry, that's not a valid invite code."}})
          reject(err)
        } else {
          dispatch({type: Constants.checkInviteCode, payload: {inviteCode}})
          dispatch(nextPhase())
          resolve()
        }
      },
    }

    engine.rpc(params)
  })
}

export function requestInvite (email: string, name: string): TypedAsyncAction<RequestInvite | RouteAppend | SignupWaiting> {
  return dispatch => new Promise((resolve, reject) => {
    // Returns an error string if not valid
    const emailError = isValidEmail(email)
    const nameError = isValidName(name)
    if (emailError || nameError || !email || !name) {
      dispatch({
        type: Constants.requestInvite,
        error: true,
        payload: {emailError, nameError, email, name},
      })
      resolve()
      return
    }

    const params: signupInviteRequestRpc = {
      method: 'signup.inviteRequest',
      param: {
        email: email,
        fullname: name,
        notes: 'Requested through GUI app',
      },
      waitingHandler: isWaiting => dispatch(waiting(isWaiting)),
      incomingCallMap: {},
      callback: err => {
        if (err) {
          dispatch({
            type: Constants.requestInvite,
            payload: {error: true, emailError: err.message, nameError: null, email, name},
          })
          reject(err)
        } else {
          if (email && name) {
            dispatch({
              type: Constants.requestInvite,
              payload: {error: null, email, name},
            })
            dispatch(nextPhase())
            resolve()
          } else {
            reject(err)
          }
        }
      },
    }
    engine.rpc(params)
  })
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

export function checkUsernameEmail (username: ?string, email: ?string): TypedAsyncAction<CheckUsernameEmail | RouteAppend | SignupWaiting> {
  return dispatch => new Promise((resolve, reject) => {
    const emailError = isValidEmail(email)
    const usernameError = isValidUsername(username)

    if (emailError || usernameError || !username || !email) {
      dispatch({
        type: Constants.checkUsernameEmail,
        error: true,
        payload: {emailError, usernameError, email, username},
      })
      resolve()
      return
    }

    const params: signupCheckUsernameAvailableRpc = {
      method: 'signup.checkUsernameAvailable',
      param: {username},
      waitingHandler: isWaiting => dispatch(waiting(isWaiting)),
      incomingCallMap: {},
      callback: err => {
        if (err) {
          console.warn("username isn't available:", err)
          dispatch({
            type: Constants.checkUsernameEmail,
            error: true,
            payload: {emailError, usernameError: `Username error: ${err.message}`, email, username},
          })
          resolve()
        } else {
          // We need this check to make flow happy. This should never be null
          if (username && email) {
            dispatch({
              type: Constants.checkUsernameEmail,
              payload: {username, email},
            })
            dispatch(nextPhase())
            resolve()
          } else {
            reject()
          }
        }
      },
    }

    engine.rpc(params)
  })
}

export function checkPassphrase (passphrase1: string, passphrase2: string): TypedAsyncAction<CheckPassphrase | RouteAppend> {
  return dispatch => new Promise((resolve, reject) => {
    let passphraseError = null
    if (!passphrase1 || !passphrase2) {
      passphraseError = new HiddenString('Fields cannot be blank')
    } else if (passphrase1 !== passphrase2) {
      passphraseError = new HiddenString('Passphrases must match')
    } else if (passphrase1.length < 12) {
      passphraseError = new HiddenString('Passphrase must be at least 12 Characters')
    }

    if (passphraseError) {
      dispatch({
        type: Constants.checkPassphrase,
        error: true,
        payload: {passphraseError},
      })
    } else {
      dispatch({
        type: Constants.checkPassphrase,
        payload: {passphrase: new HiddenString(passphrase1)},
      })
      dispatch(nextPhase())
    }

    resolve()
  })
}

export function submitDeviceName (deviceName: string, skipMail?: boolean, onDisplayPaperKey?: () => void): TypedAsyncAction<SubmitDeviceName | RouteAppend | Signup | ShowPaperKey> {
  return dispatch => new Promise((resolve, reject) => {
    // TODO do some checking on the device name - ideally this is done on the service side
    let deviceNameError = null
    if (_.trim(deviceName).length === 0) {
      deviceNameError = 'Device name must not be empty.'
    }

    if (deviceNameError) {
      dispatch({
        type: Constants.submitDeviceName,
        error: true,
        payload: {deviceNameError},
      })
    } else {
      const params: deviceCheckDeviceNameFormatRpc = {
        method: 'device.checkDeviceNameFormat',
        param: {name: deviceName},
        waitingHandler: isWaiting => dispatch(waiting(isWaiting)),
        incomingCallMap: {},
        callback: err => {
          if (err) {
            console.warn('device name is invalid: ', err)
            dispatch({
              type: Constants.submitDeviceName,
              error: true,
              payload: {deviceNameError: `Device name is invalid: ${err.message}.`, deviceName},
            })
            reject(err)
          } else {
            if (deviceName) {
              dispatch({
                type: Constants.submitDeviceName,
                payload: {deviceName},
              })

              const signupPromise = dispatch(signup(skipMail || false, onDisplayPaperKey))
              if (signupPromise) {
                resolve(signupPromise.then(() => dispatch(nextPhase()) || Promise.resolve()))
              } else {
                throw new Error('did not get promise from signup')
              }
            }
          }
        },
      }
      engine.rpc(params)
    }
  })
}

let paperKeyResponse = null
export function sawPaperKey (): AsyncAction {
  return () => {
    if (paperKeyResponse) {
      paperKeyResponse.result()
      paperKeyResponse = null
    }
  }
}

function signup (skipMail: boolean, onDisplayPaperKey?: () => void): TypedAsyncAction<Signup | ShowPaperKey | RouteAppend | SignupWaiting> {
  return (dispatch, getState) => new Promise((resolve, reject) => {
    const {email, username, inviteCode, passphrase, deviceName} = getState().signup
    paperKeyResponse = null

    if (email && username && inviteCode && passphrase && deviceName) {
      const params: signupSignupRpc = {
        method: 'signup.signup',
        waitingHandler: isWaiting => dispatch(waiting(isWaiting)),
        param: {
          email,
          inviteCode,
          username,
          deviceName,
          passphrase: passphrase.stringValue(),
          storeSecret: false,
          skipMail,
        },
        incomingCallMap: {
          'keybase.1.loginUi.displayPrimaryPaperKey': ({sessionID, phrase}, response) => {
            paperKeyResponse = response
            dispatch({
              type: Constants.showPaperKey,
              payload: {paperkey: new HiddenString(phrase)},
            })
            onDisplayPaperKey && onDisplayPaperKey()
            dispatch(nextPhase())
          },
          'keybase.1.gpgUi.wantToAddGPGKey': (params, {error, result}) => {
            // Do not add a gpg key for now
            result(false)
          },
        },
        callback: (err, {passphraseOk, postOk, writeOk}) => {
          if (err) {
            console.warn('error in signup:', err)
            dispatch({
              type: Constants.signup,
              error: true,
              payload: {signupError: new HiddenString(err + '')},
            })
            dispatch(nextPhase())
            reject()
          } else {
            console.log('Successful signup', passphraseOk, postOk, writeOk)
            resolve()
          }
        },
      }

      engine.rpc(params)
    } else {
      console.warn('Entered signup action with a null required field')
      reject()
    }
  })
}

function waiting (isWaiting: boolean): SignupWaiting {
  return {
    type: Constants.signupWaiting,
    payload: isWaiting,
  }
}

export function resetSignup (): TypedAsyncAction<ResetSignup | RouteAppend> {
  return dispatch => new Promise((resolve, reject) => {
    dispatch({type: Constants.resetSignup, payload: {}})
    dispatch(navigateUp(loginTab, Map({path: 'signup'})))
    dispatch(navigateUp())
    resolve()
  })
}

export function showSuccess (): ShowSuccess {
  return {type: Constants.showSuccess, payload: {}}
}
