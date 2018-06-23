// @flow
import logger from '../logger'
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

function nextPhase() {
  return (dispatch, getState) => {
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
      })
      .catch(err => {
        logger.warn('error in inviteCode:', err)
        dispatch(SignupGen.createCheckInviteCodeError({errorText: "Sorry, that's not a valid invite code."}))
      })
  }
}

function requestAutoInvite() {
  return (dispatch: Dispatch) => {
    dispatch(LoginGen.createSetRevokedSelf({revoked: ''}))
    dispatch(LoginGen.createSetDeletedSelf({deletedUsername: ''}))
    dispatch(SignupGen.createWaiting({waiting: true}))
    RPCTypes.signupGetInvitationCodeRpcPromise()
      .then(inviteCode => {
        dispatch(SignupGen.createWaiting({waiting: false}))
        dispatch(checkInviteCodeThenNextPhase(inviteCode))
      })
      .catch(_ => {
        dispatch(SignupGen.createWaiting({waiting: false}))
        dispatch(navigateTo([loginTab, 'signup']))
      })
  }
}

function requestInvite(email: string, name: string) {
  return (dispatch: Dispatch) => {
    // Returns an error string if not valid
    const emailError = isValidEmail(email)
    const nameError = isValidName(name)
    if (emailError || nameError || !email || !name) {
      dispatch(SignupGen.createRequestInviteError({email, emailError, name, nameError}))
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
          dispatch(SignupGen.createRequestInvite({email, name}))
          dispatch(nextPhase())
        }
      })
      .catch(err => {
        dispatch(
          SignupGen.createRequestInviteError({
            email,
            emailError: err,
            name,
            nameError: '',
          })
        )
      })
  }
}

const checkUsernameEmail = (action: SignupGen.CheckUsernameEmailPayload) => {
  const {email, username} = action.payload
  const emailError = isValidEmail(email)
  if (emailError) {
    const toThrow = {email: 'Invalid email'}
    throw toThrow
  }
  const usernameError = isValidUsername(username)
  if (usernameError) {
    const toThrow = {username: 'Invalid username'}
    throw toThrow
  }

  return Saga.call(RPCTypes.signupCheckUsernameAvailableRpcPromise, {
    username,
    waitingHandler: isWaiting => SignupGen.createWaiting({waiting: isWaiting}),
  })
}

const checkUsernameEmailSuccess = (result: any, action: SignupGen.CheckUsernameEmailPayload) => {
  const {email, username} = action.payload
  return Saga.sequentially([
    Saga.put(SignupGen.createCheckUsernameEmailDone({email, username})),
    Saga.put(nextPhase()),
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
      dispatch(nextPhase())
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
        })
    }
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
        })
        .catch(err => {
          logger.warn('error in signup:', err)
          dispatch(SignupGen.createSignupError({signupError: new HiddenString(err.desc)}))
          dispatch(nextPhase())
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
}

export {
  checkInviteCodeThenNextPhase,
  checkPassphrase,
  requestAutoInvite,
  requestInvite,
  sawPaperKey,
  startRequestInvite,
  submitDeviceName,
}
export default signupSaga
