// @flow
import * as Constants from '../constants/signup'
import HiddenString from '../util/hidden-string'
import trim from 'lodash/trim'
import {
  CommonDeviceType,
  signupGetInvitationCodeRpcPromise,
  signupSignupRpcPromise,
  signupCheckInvitationCodeRpcPromise,
  signupCheckUsernameAvailableRpcPromise,
  signupInviteRequestRpcPromise,
  deviceCheckDeviceNameFormatRpcPromise,
} from '../constants/types/flow-types'
import {isMobile} from '../constants/platform'
import {isValidEmail, isValidName, isValidUsername} from '../util/simple-validators'
import {loginTab} from '../constants/tabs'
import * as Creators from './login/creators'
import {navigateAppend, navigateTo} from '../actions/route-tree'

import type {
  CheckUsernameEmail,
  CheckPassphrase,
  SubmitDeviceName,
  Signup,
  ShowPaperKey,
  RequestInvite,
} from '../constants/signup'

function nextPhase() {
  return (dispatch, getState) => {
    // TODO careful here since this will not be sync on a remote component!
    const phase: string = getState().signup.phase
    dispatch(navigateAppend([phase], [loginTab, 'signup']))
  }
}

function startRequestInvite() {
  return (dispatch: Dispatch) => {
    dispatch({payload: {}, type: Constants.startRequestInvite})
    dispatch(nextPhase())
  }
}

function checkInviteCode(inviteCode: string) {
  return (dispatch: Dispatch) => {
    const p: Promise<*> = new Promise((resolve, reject) => {
      dispatch({payload: {inviteCode}, type: Constants.checkInviteCode})

      signupCheckInvitationCodeRpcPromise({
        param: {
          invitationCode: inviteCode,
        },
        waitingHandler: isWaiting => {
          dispatch(waiting(isWaiting))
        },
      })
        .then(() => {
          dispatch({
            payload: {inviteCode},
            type: Constants.checkInviteCode,
          })
          dispatch(nextPhase())
          resolve()
        })
        .catch(err => {
          console.warn('error in inviteCode:', err)
          dispatch({
            error: true,
            payload: {errorText: "Sorry, that's not a valid invite code."},
            type: Constants.checkInviteCode,
          })
          reject(err)
        })
    })
    return p
  }
}

function requestAutoInvite() {
  return (dispatch: Dispatch) => {
    dispatch(Creators.setLoginFromRevokedDevice(''))
    dispatch(Creators.setRevokedSelf(''))
    dispatch(Creators.setDeletedSelf(''))
    const p: Promise<*> = new Promise((resolve, reject) => {
      // TODO: It would be better to book-keep having asked for an auto
      // invite code, instead of just acting as if the one we receive
      // here had been typed, using the same store entry as a manual one.
      signupGetInvitationCodeRpcPromise({
        waitingHandler: isWaiting => {
          dispatch(waiting(isWaiting))
        },
      })
        .then(inviteCode => {
          dispatch(checkInviteCode(inviteCode))
          // For navigateAppend to work in nextPhase(), need the right path.
          dispatch(navigateTo([loginTab, 'signup']))
          inviteCode ? resolve() : reject(new Error('No invite code'))
        })
        .catch(err => {
          dispatch(navigateTo([loginTab, 'signup']))
          reject(err)
        })
    })
    return p
  }
}

function requestInvite(email: string, name: string) {
  return (dispatch: Dispatch) => {
    const p: Promise<*> = new Promise((resolve, reject) => {
      // Returns an error string if not valid
      const emailError = isValidEmail(email)
      const nameError = isValidName(name)
      if (emailError || nameError || !email || !name) {
        dispatch(
          ({
            error: true,
            payload: {
              email,
              emailError,
              name,
              nameError,
            },
            type: Constants.requestInvite,
          }: RequestInvite)
        )
        resolve()
        return
      }

      signupInviteRequestRpcPromise({
        param: {
          email: email,
          fullname: name,
          notes: 'Requested through GUI app',
        },
        waitingHandler: isWaiting => {
          dispatch(waiting(isWaiting))
        },
      })
        .then(() => {
          if (email && name) {
            dispatch({
              payload: {
                email,
                error: null,
                name,
              },
              type: Constants.requestInvite,
            })
            dispatch(nextPhase())
            resolve()
          } else {
            reject(new Error('No email or name'))
          }
        })
        .catch(err => {
          dispatch(
            ({
              error: true,
              payload: {
                email,
                emailError: err,
                name,
                nameError: null,
              },
              type: Constants.requestInvite,
            }: RequestInvite)
          )
          reject(err)
        })
    })
    return p
  }
}

function checkUsernameEmail(username: ?string, email: ?string) {
  return (dispatch: Dispatch) => {
    const p: Promise<*> = new Promise((resolve, reject) => {
      const emailError = isValidEmail(email)
      const usernameError = isValidUsername(username)

      if (emailError || usernameError || !username || !email) {
        dispatch(
          ({
            error: true,
            payload: {
              email,
              emailError,
              username,
              usernameError,
            },
            type: Constants.checkUsernameEmail,
          }: CheckUsernameEmail)
        )
        resolve()
        return
      }

      signupCheckUsernameAvailableRpcPromise({
        param: {username},
        waitingHandler: isWaiting => {
          dispatch(waiting(isWaiting))
        },
      })
        .then(() => {
          // We need this check to make flow happy. This should never be null
          if (username && email) {
            dispatch({
              payload: {
                email,
                username,
              },
              type: Constants.checkUsernameEmail,
            })
            dispatch(nextPhase())
            resolve()
          } else {
            reject(new Error('no user or email'))
          }
        })
        .catch(err => {
          console.warn("username isn't available:", err)
          dispatch(
            ({
              error: true,
              payload: {
                email,
                emailError,
                username,
                usernameError: err,
              },
              type: Constants.checkUsernameEmail,
            }: CheckUsernameEmail)
          )
          resolve()
        })
    })
    return p
  }
}

function checkPassphrase(passphrase1: string, passphrase2: string) {
  return (dispatch: Dispatch) => {
    const p: Promise<*> = new Promise((resolve, reject) => {
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
          ({
            error: true,
            payload: {passphraseError},
            type: Constants.checkPassphrase,
          }: CheckPassphrase)
        )
      } else {
        dispatch({
          payload: {passphrase: new HiddenString(passphrase1)},
          type: Constants.checkPassphrase,
        })
        dispatch(nextPhase())
      }

      resolve()
    })
    return p
  }
}

function submitDeviceName(deviceName: string, skipMail?: boolean, onDisplayPaperKey?: () => void) {
  return (dispatch: Dispatch) => {
    const p: Promise<*> = new Promise((resolve, reject) => {
      // TODO do some checking on the device name - ideally this is done on the service side
      let deviceNameError = null
      if (trim(deviceName).length === 0) {
        deviceNameError = 'Device name must not be empty.'
      }

      if (deviceNameError) {
        dispatch(
          ({
            error: true,
            payload: {
              deviceName,
              deviceNameError: deviceNameError || '',
            },
            type: Constants.submitDeviceName,
          }: SubmitDeviceName)
        )
      } else {
        deviceCheckDeviceNameFormatRpcPromise({
          param: {name: deviceName},
          waitingHandler: isWaiting => {
            dispatch(waiting(isWaiting))
          },
        })
          .then(() => {
            if (deviceName) {
              dispatch(
                ({
                  payload: {deviceName},
                  type: Constants.submitDeviceName,
                }: SubmitDeviceName)
              )

              const signupPromise = dispatch(signup(skipMail || false, onDisplayPaperKey))
              if (signupPromise) {
                signupPromise.then(resolve, reject)
              } else {
                throw new Error('did not get promise from signup')
              }
            }
          })
          .catch(err => {
            console.warn('device name is invalid: ', err)
            dispatch(
              ({
                error: true,
                payload: {
                  deviceName,
                  deviceNameError: `Device name is invalid: ${err.desc}.`,
                },
                type: Constants.submitDeviceName,
              }: SubmitDeviceName)
            )
            resolve()
          })
      }
    })
    return p
  }
}

let paperKeyResponse = null
function sawPaperKey() {
  return () => {
    if (paperKeyResponse) {
      paperKeyResponse.result()
      paperKeyResponse = null
    }
  }
}

function signup(skipMail: boolean, onDisplayPaperKey?: () => void) {
  return (dispatch, getState) => {
    const p: Promise<*> = new Promise((resolve, reject) => {
      const {email, username, inviteCode, passphrase, deviceName} = getState().signup
      paperKeyResponse = null
      const deviceType = isMobile ? CommonDeviceType.mobile : CommonDeviceType.desktop

      if (email && username && inviteCode && passphrase && deviceName) {
        signupSignupRpcPromise({
          incomingCallMap: {
            'keybase.1.gpgUi.wantToAddGPGKey': (params, response) => {
              // Do not add a gpg key for now
              response.result(false)
            },
            'keybase.1.loginUi.displayPrimaryPaperKey': ({sessionID, phrase}, response) => {
              paperKeyResponse = response
              dispatch(
                ({
                  payload: {paperkey: new HiddenString(phrase)},
                  type: Constants.showPaperKey,
                }: ShowPaperKey)
              )
              onDisplayPaperKey && onDisplayPaperKey()
              dispatch(nextPhase())
            },
          },
          param: {
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
          waitingHandler: isWaiting => {
            dispatch(waiting(isWaiting))
          },
        })
          .then(({passphraseOk, postOk, writeOk}) => {
            console.log('Successful signup', passphraseOk, postOk, writeOk)
            dispatch(waiting(true))
            resolve()
          })
          .catch(err => {
            console.warn('error in signup:', err)
            dispatch(
              ({
                error: true,
                payload: {signupError: new HiddenString(err.desc)},
                type: Constants.signup,
              }: Signup)
            )
            dispatch(nextPhase())
            reject(new Error(err))
          })
      } else {
        console.warn('Entered signup action with a null required field')
        reject(new Error('null required field'))
      }
    })
    return p
  }
}

function waiting(isWaiting: boolean) {
  return {
    payload: isWaiting,
    type: Constants.signupWaiting,
  }
}

function resetSignup() {
  return {
    payload: undefined,
    type: Constants.resetSignup,
  }
}

function restartSignup() {
  return (dispatch: Dispatch) => {
    const p: Promise<*> = new Promise((resolve, reject) => {
      dispatch({
        payload: {},
        type: Constants.restartSignup,
      })
      dispatch(Creators.navBasedOnLoginAndInitialState())
      resolve()
    })
    return p
  }
}

function showSuccess() {
  return {
    payload: {},
    type: Constants.showSuccess,
  }
}

function setDeviceNameError(deviceNameError: string) {
  return {
    payload: {deviceNameError},
    type: Constants.setDeviceNameError,
  }
}

function clearDeviceNameError() {
  return {payload: {}, type: Constants.clearDeviceNameError}
}

export {
  checkInviteCode,
  checkPassphrase,
  checkUsernameEmail,
  clearDeviceNameError,
  requestAutoInvite,
  requestInvite,
  resetSignup,
  restartSignup,
  sawPaperKey,
  setDeviceNameError,
  showSuccess,
  startRequestInvite,
  submitDeviceName,
}
