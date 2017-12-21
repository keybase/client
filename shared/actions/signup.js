// @flow
import logger from '../logger'
import * as LoginGen from './login-gen'
import * as SignupGen from './signup-gen'
import * as RPCTypes from '../constants/types/flow-types'
import HiddenString from '../util/hidden-string'
import trim from 'lodash/trim'
import {isMobile} from '../constants/platform'
import {isValidEmail, isValidName, isValidUsername} from '../util/simple-validators'
import {loginTab} from '../constants/tabs'
import {navigateAppend, navigateTo} from '../actions/route-tree'

function nextPhase() {
  return (dispatch, getState) => {
    // TODO careful here since this will not be sync on a remote component!
    const phase: string = getState().signup.phase
    dispatch(navigateAppend([phase], [loginTab, 'signup']))
  }
}

function startRequestInvite() {
  return (dispatch: Dispatch) => {
    dispatch(SignupGen.createStartRequestInvite())
    dispatch(nextPhase())
  }
}

function checkInviteCodeThenNextPhase(inviteCode: string) {
  return (dispatch: Dispatch) => {
    const p: Promise<*> = new Promise((resolve, reject) => {
      dispatch(SignupGen.createCheckInviteCode({inviteCode}))

      RPCTypes.signupCheckInvitationCodeRpcPromise({
        invitationCode: inviteCode,
        waitingHandler: isWaiting => {
          dispatch(SignupGen.createWaiting({waiting: isWaiting}))
        },
      })
        .then(() => {
          dispatch(SignupGen.createCheckInviteCode({inviteCode}))
          dispatch(nextPhase())
          resolve()
        })
        .catch(err => {
          logger.warn('error in inviteCode:', err)
          dispatch(
            SignupGen.createCheckInviteCodeError({errorText: "Sorry, that's not a valid invite code."})
          )
          reject(err)
        })
    })
    return p
  }
}

function requestAutoInvite() {
  return (dispatch: Dispatch) => {
    dispatch(LoginGen.createSetRevokedSelf({revoked: ''}))
    dispatch(LoginGen.createSetDeletedSelf({deletedUsername: ''}))
    const p: Promise<*> = new Promise((resolve, reject) => {
      // TODO: It would be better to book-keep having asked for an auto
      // invite code, instead of just acting as if the one we receive
      // here had been typed, using the same store entry as a manual one.
      RPCTypes.signupGetInvitationCodeRpcPromise({
        waitingHandler: isWaiting => {
          dispatch(SignupGen.createWaiting({waiting: isWaiting}))
        },
      })
        .then(inviteCode => {
          dispatch(checkInviteCodeThenNextPhase(inviteCode))
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
          SignupGen.createRequestInviteError({
            email,
            emailError,
            name,
            nameError,
          })
        )
        resolve()
        return
      }

      RPCTypes.signupInviteRequestRpcPromise({
        email: email,
        fullname: name,
        notes: 'Requested through GUI app',
        waitingHandler: isWaiting => {
          dispatch(SignupGen.createWaiting({waiting: isWaiting}))
        },
      })
        .then(() => {
          if (email && name) {
            dispatch(
              SignupGen.createRequestInvite({
                email,
                name,
              })
            )
            dispatch(nextPhase())
            resolve()
          } else {
            reject(new Error('No email or name'))
          }
        })
        .catch(err => {
          dispatch(
            SignupGen.createRequestInviteError({
              email,
              emailError: err,
              name,
              nameError: null,
            })
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
          SignupGen.createCheckUsernameEmailError({
            email,
            emailError,
            username,
            usernameError,
          })
        )
        resolve()
        return
      }

      RPCTypes.signupCheckUsernameAvailableRpcPromise({
        username,
        waitingHandler: isWaiting => {
          dispatch(SignupGen.createWaiting({waiting: isWaiting}))
        },
      })
        .then(() => {
          // We need this check to make flow happy. This should never be null
          if (username && email) {
            dispatch(
              SignupGen.createCheckUsernameEmail({
                email,
                username,
              })
            )
            dispatch(nextPhase())
            resolve()
          } else {
            reject(new Error('no user or email'))
          }
        })
        .catch(err => {
          logger.warn("username isn't available:", err)
          dispatch(
            SignupGen.createCheckUsernameEmailError({
              email,
              emailError,
              username,
              usernameError: err,
            })
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
          SignupGen.createSubmitDeviceNameError({
            deviceNameError: deviceNameError || '',
          })
        )
      } else {
        RPCTypes.deviceCheckDeviceNameFormatRpcPromise({
          name: deviceName,
          waitingHandler: isWaiting => {
            dispatch(SignupGen.createWaiting({waiting: isWaiting}))
          },
        })
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
      const deviceType = isMobile ? RPCTypes.commonDeviceType.mobile : RPCTypes.commonDeviceType.desktop

      if (email && username && inviteCode && passphrase && deviceName) {
        RPCTypes.signupSignupRpcPromise({
          incomingCallMap: {
            'keybase.1.gpgUi.wantToAddGPGKey': (params, response) => {
              // Do not add a gpg key for now
              response.result(false)
            },
            'keybase.1.loginUi.displayPrimaryPaperKey': ({sessionID, phrase}, response) => {
              paperKeyResponse = response
              dispatch(SignupGen.createShowPaperKey({paperkey: new HiddenString(phrase)}))
              onDisplayPaperKey && onDisplayPaperKey()
              dispatch(nextPhase())
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
          waitingHandler: isWaiting => {
            dispatch(SignupGen.createWaiting({waiting: isWaiting}))
          },
        })
          .then(({passphraseOk, postOk, writeOk}) => {
            logger.info('Successful signup', passphraseOk, postOk, writeOk)
            dispatch(SignupGen.createWaiting({waiting: true}))
            resolve()
          })
          .catch(err => {
            logger.warn('error in signup:', err)
            dispatch(SignupGen.createSignupError({signupError: new HiddenString(err.desc)}))
            dispatch(nextPhase())
            reject(new Error(err))
          })
      } else {
        logger.warn('Entered signup action with a null required field')
        reject(new Error('null required field'))
      }
    })
    return p
  }
}

function restartSignup() {
  return (dispatch: Dispatch) => {
    const p: Promise<*> = new Promise((resolve, reject) => {
      dispatch(SignupGen.createRestartSignup())
      dispatch(LoginGen.createNavBasedOnLoginAndInitialState())
      resolve()
    })
    return p
  }
}

export {
  checkInviteCodeThenNextPhase,
  checkPassphrase,
  checkUsernameEmail,
  requestAutoInvite,
  requestInvite,
  restartSignup,
  sawPaperKey,
  startRequestInvite,
  submitDeviceName,
}
