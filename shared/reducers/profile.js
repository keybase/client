// @flow
import * as CommonConstants from '../constants/common'
import * as Constants from '../constants/profile'
import type {Actions, State} from '../constants/profile'

const {checkBTC, checkZcash} = Constants

const initialState: State = {
  errorText: null,
  errorCode: null,
  waiting: false,
  username: '',
  platform: null,
  usernameValid: true,
  revoke: {},
  proofFound: false,
  proofStatus: null,
  sigID: null,
  pgpInfo: {
    fullName: null,
    errorText: null,
    email1: null,
    email2: null,
    email3: null,
    errorEmail1: false,
    errorEmail2: false,
    errorEmail3: false,
  },
  pgpPublicKey: null,
  proofText: null,
}

function checkUsernameValid (platform, username): boolean {
  if (platform === 'btc') {
    return checkBTC(username)
  } else if (platform === 'zcash') {
    return checkZcash(username)
  } else {
    return true
  }
}

function cleanupUsername (platform, username): string {
  if (['http', 'https'].includes(platform)) {
    // Ensure that only the hostname is getting returned, with no
    // protocal, port, or path information
    return username && username
      .replace(/^.*?:\/\//, '') // Remove protocal information (if present)
      .replace(/:.*/, '') // Remove port information (if present)
      .replace(/\/.*/, '') // Remove path information (if present)
  }
  return username
}

export default function (state: State = initialState, action: Actions) {
  switch (action.type) {
    case CommonConstants.resetStore:
      return {...initialState}
    case Constants.waiting:
      if (action.error) { break }
      return {
        ...state,
        waiting: action.payload.waiting,
      }
    case Constants.updatePlatform: {
      if (action.error) { break }
      const usernameValid = checkUsernameValid(action.payload.platform, state.username)
      return {
        ...state,
        platform: action.payload.platform,
        usernameValid,
      }
    }

    case Constants.updateUsername: {
      if (action.error) { break }
      const usernameValid = checkUsernameValid(state.platform, action.payload.username)
      return {
        ...state,
        username: action.payload.username,
        usernameValid,
      }
    }
    case Constants.cleanupUsername: {
      if (action.error) { break }
      const username = cleanupUsername(state.platform, state.username)
      return {
        ...state,
        username,
      }
    }
    case Constants.waitingRevokeProof:
      if (action.error) {
        break
      }
      return {
        ...state,
        revoke: {
          ...state.revoke,
          waiting: action.payload.waiting,
        },
      }
    case Constants.finishRevokeProof:
      return {
        ...state,
        revoke: action.error
          ? {error: action.payload.error}
          : {},
      }
    case Constants.updateProofText:
      if (action.error) { break }
      return {
        ...state,
        proofText: action.payload.proof,
      }
    case Constants.updateProofStatus:
      if (action.error) { break }
      return {
        ...state,
        proofFound: action.payload.found,
        proofStatus: action.payload.status,
      }
    case Constants.updateErrorText:
      if (action.error) { break }
      return {
        ...state,
        errorText: action.payload.errorText,
        errorCode: action.payload.errorCode,
      }
    case Constants.updateSigID:
      if (action.error) { break }
      return {
        ...state,
        sigID: action.payload.sigID,
      }
    case Constants.updatePgpInfo:
      return {
        ...state,
        pgpInfo: {
          ...state.pgpInfo,
          ...action.payload,
        },
      }
    case Constants.updatePgpPublicKey:
      if (action.error) { break }
      return {
        ...state,
        pgpPublicKey: action.payload.publicKey,
      }
  }

  return state
}
