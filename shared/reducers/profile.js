// @flow
import * as ProfileGen from '../actions/profile-gen'
import * as Types from '../constants/types/profile'
import * as Constants from '../constants/profile'

export default function(state: Types.State = Constants.initialState, action: ProfileGen.Actions) {
  switch (action.type) {
    case ProfileGen.resetStore:
      return {...Constants.initialState}
    case ProfileGen.waiting:
      const {waiting} = action.payload
      return {
        ...state,
        waiting,
      }
    case ProfileGen.updatePlatform: {
      const {platform} = action.payload
      const usernameValid = Constants.checkUsernameValid(platform, state.username)
      return {
        ...state,
        platform,
        usernameValid,
      }
    }

    case ProfileGen.updateUsername: {
      const {username} = action.payload
      const usernameValid = Constants.checkUsernameValid(state.platform, username)
      return {
        ...state,
        username,
        usernameValid,
      }
    }
    case ProfileGen.cleanupUsername: {
      const username = Constants.cleanupUsername(state.platform, state.username)
      return {
        ...state,
        username,
      }
    }
    case ProfileGen.revokeWaiting: {
      const {waiting} = action.payload
      return {
        ...state,
        revoke: {
          ...state.revoke,
          waiting,
        },
      }
    }
    case ProfileGen.revokeFinish:
      return {
        ...state,
        revoke: {
          ...state.revoke,
          error: action.error ? action.payload.error : null,
          waiting: false,
        },
      }
    case ProfileGen.updateProofText:
      const {proof: proofText} = action.payload
      return {
        ...state,
        proofText,
      }
    case ProfileGen.updateProofStatus:
      const {found: proofFound, status: proofStatus} = action.payload
      return {
        ...state,
        proofFound,
        proofStatus,
      }
    case ProfileGen.updateErrorText:
      const {errorCode, errorText} = action.payload
      return {
        ...state,
        errorCode,
        errorText,
      }
    case ProfileGen.updateSigID:
      const {sigID} = action.payload
      return {
        ...state,
        sigID,
      }
    case ProfileGen.updatePgpInfo:
      if (action.error) {
        // TODO
        break
      }

      const {info} = action.payload
      return {
        ...state,
        pgpInfo: {
          ...state.pgpInfo,
          ...info,
        },
      }
    case ProfileGen.updatePgpPublicKey:
      const {publicKey: pgpPublicKey} = action.payload
      return {
        ...state,
        pgpPublicKey,
      }
  }

  return state
}
