/* @flow */

import _ from 'lodash'
import * as Constants from '../../constants/signup'
import HiddenString from '../../util/hidden-string'
import engine from '../../engine'

import {routeAppend} from '../../actions/router'

import type {TypedAsyncAction} from '../../constants/types/flux'
import type {RouteAppend} from '../../constants/router'
import type {CheckInviteCode, CheckUsernameEmail, CheckPassphrase, SubmitDeviceName, Signup, ShowPaperKey, ShowSuccess} from '../../constants/signup'
import type {signup_signup_rpc} from '../../constants/types/flow-types'

function nextPhase (): TypedAsyncAction<RouteAppend> {
  return (dispatch, getState) => {
    // TODO careful here since this will not be sync on a remote component!
    const phase: string = getState().signup.phase
    dispatch(routeAppend(phase))
  }
}

export function checkInviteCode (inviteCode: string): TypedAsyncAction<CheckInviteCode | RouteAppend> {
  return dispatch => new Promise((resolve, reject) => {
    // TODO make service call
    dispatch({type: Constants.checkInviteCode, payload: {inviteCode}})
    dispatch(nextPhase())
    resolve()
  })
}

export function checkUsernameEmail (username: ?string, email: ?string): TypedAsyncAction<CheckUsernameEmail | RouteAppend> {
  return dispatch => new Promise((resolve, reject) => {
    console.log('username is', username)
    console.log('email is', email)
    if (!username || !email) {
      const emailError = email ? undefined : 'cannot be blank'
      const usernameError = username ? undefined : 'cannot be blank'
      dispatch({
        type: Constants.checkUsernameEmail,
        error: true,
        payload: {emailError, usernameError, email, username}
      })
      resolve()
      return
    }

    // TODO make service checking of email and username
    dispatch({
      type: Constants.checkUsernameEmail,
      payload: {username, email}
    })
    dispatch(nextPhase())
    resolve()
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
        payload: {passphraseError}
      })
    } else {
      dispatch({
        type: Constants.checkPassphrase,
        payload: {passphrase: new HiddenString(passphrase1)}
      })
      dispatch(nextPhase())
    }

    resolve()
  })
}

export function submitDeviceName (deviceName: string, skipMail?: boolean): TypedAsyncAction<SubmitDeviceName | RouteAppend | Signup | ShowPaperKey> {
  return dispatch => {
    // TODO do some checking on the device name - ideally this is done on the service side
    let deviceNameError = null
    if (_.trim(deviceName).length === 0) {
      deviceNameError = 'Device name must not be empty'
    }

    if (deviceNameError) {
      dispatch({
        type: Constants.submitDeviceName,
        error: true,
        payload: {deviceNameError}
      })
    } else {
      dispatch({
        type: Constants.submitDeviceName,
        payload: {deviceName}
      })

      const signupPromise = dispatch(signup(skipMail || false))
      if (signupPromise) {
        return signupPromise.then(() => dispatch(nextPhase()) || Promise.resolve())
      } else {
        throw new Error('did not get promise from signup')
      }
    }
  }
}

function signup (skipMail): TypedAsyncAction<Signup | ShowPaperKey> {
  return (dispatch, getState) => new Promise((resolve, reject) => {
    const {email, username, inviteCode, passphrase, deviceName} = getState().signup

    if (email && username && inviteCode && passphrase && deviceName) {
      const params: signup_signup_rpc = {
        method: 'signup.signup',
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
          'keybase.1.loginUi.displayPrimaryPaperKey': ({sessionID, phrase}, {error, result}) => {
            // TODO if the user doesn't Ack the paper key we should error
            dispatch({
              type: Constants.showPaperKey,
              payload: {paperkey: new HiddenString(phrase)}
            })
            result()
          },
          'keybase.1.gpgUi.wantToAddGPGKey': (params, {error, result}) => {
            // Do not add a gpg key for now
            result(false)
          }
        },
        callback: (err, {passphraseOk, postOk, writeOk}) => {
          if (err) {
            console.error('error in signup:', err)
            reject()
          } else {
            console.log('Successful signup', passphraseOk, postOk, writeOk)
            resolve()
          }
        }
      }

      engine.rpc(params)
    } else {
      console.error('Entered signup action with a null required field')
      reject()
    }
  })
}

export function showSuccess (): ShowSuccess {
  return {type: Constants.showSuccess, payload: {}}
}
