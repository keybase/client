// @flow
import * as CommonConstants from '../constants/common'
import * as Constants from '../constants/profile'
import type {Actions, State} from '../constants/profile'

const initialState: State = {
  errorCode: null,
  errorText: null,
  pgpInfo: {
    email1: null,
    email2: null,
    email3: null,
    errorEmail1: false,
    errorEmail2: false,
    errorEmail3: false,
    errorText: null,
    fullName: null,
  },
  pgpPublicKey: null,
  platform: null,
  proofFound: false,
  proofStatus: null,
  proofText: null,
  revoke: {},
  sigID: null,
  username: '',
  usernameValid: true,
  waiting: false,
}

// A simple check, the server does a fuller check
function checkBTC(address: string): boolean {
  return !!address.match(/^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/)
}

// A simple check, the server does a fuller check
function checkZcash(address: string): boolean {
  return true // !!address.match(/^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/)
}

function checkUsernameValid(platform, username): boolean {
  if (platform === 'btc') {
    return checkBTC(username)
  } else if (platform === 'zcash') {
    return checkZcash(username)
  } else {
    return true
  }
}

function cleanupUsername(platform, username): string {
  if (['http', 'https'].includes(platform)) {
    // Ensure that only the hostname is getting returned, with no
    // protocal, port, or path information
    return (
      username &&
      username
        .replace(/^.*?:\/\//, '') // Remove protocal information (if present)
        .replace(/:.*/, '') // Remove port information (if present)
        .replace(/\/.*/, '')
    ) // Remove path information (if present)
  }
  return username
}

export default function(state: State = initialState, action: Actions) {
  switch (action.type) {
    case CommonConstants.resetStore:
      return {...initialState}
    case Constants.waiting:
      if (action.error) {
        break
      }
      return {
        ...state,
        waiting: action.payload.waiting,
      }
    case Constants.updatePlatform: {
      if (action.error) {
        break
      }
      const usernameValid = checkUsernameValid(action.payload.platform, state.username)
      return {
        ...state,
        platform: action.payload.platform,
        usernameValid,
      }
    }

    case Constants.updateUsername: {
      if (action.error) {
        break
      }
      const usernameValid = checkUsernameValid(state.platform, action.payload.username)
      return {
        ...state,
        username: action.payload.username,
        usernameValid,
      }
    }
    case Constants.cleanupUsername: {
      if (action.error) {
        break
      }
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
        revoke: action.error ? {error: action.payload.error} : {},
      }
    case Constants.updateProofText:
      if (action.error) {
        break
      }
      return {
        ...state,
        proofText: action.payload.proof,
      }
    case Constants.updateProofStatus:
      if (action.error) {
        break
      }
      return {
        ...state,
        proofFound: action.payload.found,
        proofStatus: action.payload.status,
      }
    case Constants.updateErrorText:
      if (action.error) {
        break
      }
      return {
        ...state,
        errorCode: action.payload.errorCode,
        errorText: action.payload.errorText,
      }
    case Constants.updateSigID:
      if (action.error) {
        break
      }
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
      if (action.error) {
        break
      }
      return {
        ...state,
        pgpPublicKey: action.payload.publicKey,
      }
  }

  return state
}
