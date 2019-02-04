// @flow
import * as ProfileGen from '../actions/profile-gen'
import * as Types from '../constants/types/profile'
import * as Constants from '../constants/profile'
import * as Flow from '../util/flow'
import * as Validators from '../util/simple-validators'

const updateUsername = state => {
  let username = state.username || ''
  let usernameValid = true

  switch (state.platform) {
    case 'http': // fallthrough
    case 'https':
      // Ensure that only the hostname is getting returned, with no
      // protocol, port, or path information
      username =
        state.username &&
        state.username
          // Remove protocol information (if present)
          .replace(/^.*?:\/\//, '')
          // Remove port information (if present)
          .replace(/:.*/, '')
          // Remove path information (if present)
          .replace(/\/.*/, '')
      break
    case 'btc':
      // A simple check, the server does a fuller check
      usernameValid = !!username.match(/^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/)
      break
  }

  return state.merge({username, usernameValid})
}

const initialState = Constants.makeInitialState()

export default function(state: Types.State = initialState, action: ProfileGen.Actions): Types.State {
  switch (action.type) {
    case ProfileGen.resetStore:
      return initialState
    case ProfileGen.updatePlatform:
      return updateUsername(state.merge({platform: action.payload.platform}))
    case ProfileGen.updateUsername:
      return updateUsername(state.merge({username: action.payload.username}))
    case ProfileGen.cleanupUsername:
      return updateUsername(state)
    case ProfileGen.revokeFinish:
      return state.merge({revokeError: action.error ? action.payload.error : ''})
    case ProfileGen.updateProofText:
      return state.merge({proofText: action.payload.proof})
    case ProfileGen.updateProofStatus:
      return state.merge({
        proofFound: action.payload.found,
        proofStatus: action.payload.status,
      })
    case ProfileGen.updateErrorText:
      const {errorCode, errorText} = action.payload
      return state.merge({errorCode, errorText})
    case ProfileGen.updateSigID:
      return state.merge({sigID: action.payload.sigID})
    case ProfileGen.updatePgpInfo:
      const valid1 = Validators.isValidEmail(state.pgpEmail1)
      const valid2 = state.pgpEmail2 && Validators.isValidEmail(state.pgpEmail2)
      const valid3 = state.pgpEmail3 && Validators.isValidEmail(state.pgpEmail3)
      return state.merge({
        ...action.payload,
        pgpErrorEmail1: !!valid1,
        pgpErrorEmail2: !!valid2,
        pgpErrorEmail3: !!valid3,
        pgpErrorText: Validators.isValidName(state.pgpFullName) || valid1 || valid2 || valid3,
      })
    case ProfileGen.updatePgpPublicKey:
      return state.merge({pgpPublicKey: action.payload.publicKey})
    case ProfileGen.addProof:
      return updateUsername(
        state.merge({
          errorCode: null,
          errorText: '',
          platform: action.payload.platform,
        })
      )
    case ProfileGen.cancelAddProof: // fallthrough
    case ProfileGen.recheckProof: // fallthrough
    case ProfileGen.checkProof:
      return state.merge({errorCode: null, errorText: ''})
    case ProfileGen.submitBTCAddress:
    case ProfileGen.submitZcashAddress:
      return updateUsername(state)
    // Saga only actions
    case ProfileGen.backToProfile:
    case ProfileGen.cancelPgpGen:
    case ProfileGen.dropPgp:
    case ProfileGen.editProfile:
    case ProfileGen.finishRevoking:
    case ProfileGen.finishedWithKeyGen:
    case ProfileGen.generatePgp:
    case ProfileGen.onClickAvatar:
    case ProfileGen.outputInstructionsActionLink:
    case ProfileGen.showUserProfile:
    case ProfileGen.submitRevokeProof:
    case ProfileGen.submitUsername:
    case ProfileGen.uploadAvatar:
    case ProfileGen.editAvatar:
      return state
    default:
      Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(action)
      return state
  }
}
