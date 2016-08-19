// @flow
import * as Constants from '../../constants/signup'
import HiddenString from '../../util/hidden-string'
import _ from 'lodash'
import type {CheckInviteCode, CheckUsernameEmail, CheckPassphrase, SubmitDeviceName,
  Signup, ShowPaperKey, ShowSuccess, ResetSignup, RestartSignup, RequestInvite,
  StartRequestInvite, SignupWaiting} from '../../constants/signup'
import type {RouteAppend} from '../../constants/router'
import type {TypedAsyncAction, AsyncAction} from '../../constants/types/flux'
import {Map} from 'immutable'
import {loginTab} from '../../constants/tabs'
import {routeAppend, navigateUp} from '../../actions/router'
import {signupSignupRpc, signupCheckInvitationCodeRpc, signupCheckUsernameAvailableRpc,
  signupInviteRequestRpc, deviceCheckDeviceNameFormatRpc} from '../../constants/types/flow-types'
import {isValidEmail, isValidName, isValidUsername} from '../../util/simple-validators'

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

    signupCheckInvitationCodeRpc({
      param: {invitationCode: inviteCode},
      waitingHandler: isWaiting => { dispatch(waiting(isWaiting)) },
      callback: err => {
        if (err) {
          console.warn('error in inviteCode:', err)
          dispatch(({type: Constants.checkInviteCode, error: true, payload: {errorText: "Sorry, that's not a valid invite code."}}: CheckInviteCode))
          reject(err)
        } else {
          dispatch({type: Constants.checkInviteCode, payload: {inviteCode}})
          dispatch(nextPhase())
          resolve()
        }
      },
    })
  })
}

export function requestInvite (email: string, name: string): TypedAsyncAction<RequestInvite | RouteAppend | SignupWaiting> {
  return dispatch => new Promise((resolve, reject) => {
    // Returns an error string if not valid
    const emailError = isValidEmail(email)
    const nameError = isValidName(name)
    if (emailError || nameError || !email || !name) {
      dispatch(({
        type: Constants.requestInvite,
        error: true,
        payload: {emailError, nameError, email, name},
      }: RequestInvite))
      resolve()
      return
    }

    signupInviteRequestRpc({
      param: {
        email: email,
        fullname: name,
        notes: 'Requested through GUI app',
      },
      waitingHandler: isWaiting => { dispatch(waiting(isWaiting)) },
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
    })
  })
}

export function checkUsernameEmail (username: ?string, email: ?string): TypedAsyncAction<CheckUsernameEmail | RouteAppend | SignupWaiting> {
  return dispatch => new Promise((resolve, reject) => {
    const emailError = isValidEmail(email)
    const usernameError = isValidUsername(username)

    if (emailError || usernameError || !username || !email) {
      dispatch(({
        type: Constants.checkUsernameEmail,
        error: true,
        payload: {emailError, usernameError, email, username},
      }: CheckUsernameEmail))
      resolve()
      return
    }

    signupCheckUsernameAvailableRpc({
      param: {username},
      waitingHandler: isWaiting => { dispatch(waiting(isWaiting)) },
      callback: err => {
        if (err) {
          console.warn("username isn't available:", err)
          dispatch(({
            type: Constants.checkUsernameEmail,
            error: true,
            payload: {emailError, usernameError: `Username error: ${err.message}`, email, username},
          }: CheckUsernameEmail))
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
    })
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
      dispatch(({
        type: Constants.checkPassphrase,
        error: true,
        payload: {passphraseError},
      }: CheckPassphrase))
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

export function submitDeviceName (deviceName: string, skipMail?: boolean, onDisplayPaperKey?: () => void): TypedAsyncAction<SubmitDeviceName | RouteAppend | Signup | ShowPaperKey | SignupWaiting> {
  return dispatch => new Promise((resolve, reject) => {
    // TODO do some checking on the device name - ideally this is done on the service side
    let deviceNameError = null
    if (_.trim(deviceName).length === 0) {
      deviceNameError = 'Device name must not be empty.'
    }

    if (deviceNameError) {
      dispatch(({
        type: Constants.submitDeviceName,
        error: true,
        payload: {deviceNameError: deviceNameError || '', deviceName},
      }: SubmitDeviceName))
    } else {
      deviceCheckDeviceNameFormatRpc({
        param: {name: deviceName},
        waitingHandler: isWaiting => { dispatch(waiting(isWaiting)) },
        callback: err => {
          if (err) {
            console.warn('device name is invalid: ', err)
            dispatch(({
              type: Constants.submitDeviceName,
              error: true,
              payload: {deviceNameError: `Device name is invalid: ${err.message}.`, deviceName},
            }: SubmitDeviceName))
            reject(err)
          } else {
            if (deviceName) {
              dispatch(({
                type: Constants.submitDeviceName,
                payload: {deviceName},
              }: SubmitDeviceName))

              const signupPromise = dispatch(signup(skipMail || false, onDisplayPaperKey))
              if (signupPromise) {
                signupPromise.then(resolve, reject)
              } else {
                throw new Error('did not get promise from signup')
              }
            }
          }
        },
      })
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
      signupSignupRpc({
        waitingHandler: isWaiting => { dispatch(waiting(isWaiting)) },
        param: {
          deviceName,
          email,
          genPGPBatch: false,
          inviteCode,
          passphrase: passphrase.stringValue(),
          skipMail,
          storeSecret: false,
          username,
        },
        incomingCallMap: {
          'keybase.1.loginUi.displayPrimaryPaperKey': ({sessionID, phrase}, response) => {
            paperKeyResponse = response
            dispatch(({
              type: Constants.showPaperKey,
              payload: {paperkey: new HiddenString(phrase)},
            }: ShowPaperKey))
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
            dispatch(({
              type: Constants.signup,
              error: true,
              payload: {signupError: new HiddenString(err + '')},
            }: Signup))
            dispatch(nextPhase())
            reject()
          } else {
            console.log('Successful signup', passphraseOk, postOk, writeOk)
            dispatch(waiting(true))
            resolve()
          }
        },
      })
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

export function resetSignup (): ResetSignup {
  return {
    type: Constants.resetSignup,
    payload: undefined,
  }
}

export function restartSignup (): TypedAsyncAction<RestartSignup | RouteAppend> {
  return dispatch => new Promise((resolve, reject) => {
    dispatch({type: Constants.restartSignup, payload: {}})
    dispatch(navigateUp(loginTab, Map({path: 'signup'})))
    dispatch(navigateUp())
    resolve()
  })
}

export function showSuccess (): ShowSuccess {
  return {type: Constants.showSuccess, payload: {}}
}
