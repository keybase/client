/* @flow */

import * as Constants from '../../constants/signup'
import SecureString from '../../util/secure-string'

import {routeAppend} from '../../actions/router'

import type {TypedAsyncAction} from '../../constants/types/flux'
import type {RouteAppend} from '../../constants/router'
import type {CheckInviteCode, CheckUsernameEmail, CheckPassphrase} from '../../constants/signup'

function nextPhase (): TypedAsyncAction<RouteAppend> {
  return (dispatch, getState) => {
    // TODO careful here since this will not be sync on a remote component!
    const phase: string = getState().signup.phase
    dispatch(routeAppend(phase))
  }
}

export function checkInviteCode (inviteCode: string): TypedAsyncAction<CheckInviteCode | RouteAppend> {
  return dispatch => {
    // TODO make service call
    dispatch({type: Constants.checkInviteCode, payload: {inviteCode}})
    dispatch(nextPhase())
  }
}

export function checkUsernameEmail (username: ?string, email: ?string): TypedAsyncAction<CheckUsernameEmail | RouteAppend> {
  return dispatch => {
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
      return
    }

    // TODO make service checking of email and username
    dispatch({
      type: Constants.checkUsernameEmail,
      payload: {username, email}
    })
    dispatch(nextPhase())
  }
}

// TODO when securestring is merged change these closed over texts to secure string
export function checkPassphrase (passphrase1: string, passphrase2: string): TypedAsyncAction<CheckPassphrase | RouteAppend> {
  return dispatch => {
    let passphraseError = null
    if (!passphrase1 || !passphrase2) {
      passphraseError = new SecureString('Fields cannot be blank')
    } else if (passphrase1 !== passphrase2) {
      passphraseError = new SecureString('Passphrases must match')
    } else if (passphrase1.length < 12) {
      passphraseError = new SecureString('Passphrase must be at least 12 Characters')
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
        payload: {passphrase: new SecureString(passphrase1)}
      })
      dispatch(nextPhase())
    }
  }
}
