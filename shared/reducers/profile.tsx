import * as ProfileGen from '../actions/profile-gen'
import * as Types from '../constants/types/profile'
import * as More from '../constants/types/more'
import * as Container from '../util/container'
import * as Constants from '../constants/profile'
import * as Validators from '../util/simple-validators'

const updateUsername = (state: Types.State) => {
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
      {
        // A simple check, the server does a fuller check
        const legacyFormat = !!username.match(/^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/)
        const segwitFormat = !!username
          .toLowerCase()
          .match(/^(bc1)[qpzry9x8gf2tvdw0s3jn54khce6mua7l]{11,71}$/)
        usernameValid = legacyFormat || segwitFormat
      }
      break
  }

  return state.merge({username, usernameValid})
}

const initialState = Constants.makeInitialState()

export default Container.makeReducer<ProfileGen.Actions, Types.State>(initialState, {
  [ProfileGen.resetStore]: (draftState, actions) => {
    return initialState
  },
  [ProfileGen.updatePlatform]: (draftState, actions) => {
    return updateUsername(state.merge({platform: action.payload.platform}))
  },
  [ProfileGen.updateUsername]: (draftState, actions) => {
    return updateUsername(state.merge({username: action.payload.username}))
  },
  [ProfileGen.cleanupUsername]: (draftState, actions) => {
    return updateUsername(state)
  },
  [ProfileGen.revokeFinish]: (draftState, actions) => {
    return state.merge({revokeError: action.payload.error ? action.payload.error : ''})
  },
  [ProfileGen.submitBlockUser]: (draftState, actions) => {
    return state.merge({blockUserModal: 'waiting'})
  },
  [ProfileGen.finishBlockUser]: (draftState, actions) => {
    return state.merge({blockUserModal: action.payload.error ? {error: action.payload.error} : null})
  },
  [ProfileGen.updateProofText]: (draftState, actions) => {
    return state.merge({proofText: action.payload.proof})
  },
  [ProfileGen.updateProofStatus]: (draftState, actions) => {
    return state.merge({
      proofFound: action.payload.found,
      proofStatus: action.payload.status,
    })
  },
  [ProfileGen.updateErrorText]: (draftState, actions) => {
    const {errorCode, errorText} = action.payload
    return state.merge({errorCode, errorText})
  },
  [ProfileGen.updateSigID]: (draftState, actions) => {
    return state.merge({sigID: action.payload.sigID})
  },
  [ProfileGen.updatePgpInfo]: (draftState, actions) => {
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
  },
  [ProfileGen.updatePgpPublicKey]: (draftState, actions) => {
    return state.merge({pgpPublicKey: action.payload.publicKey})
  },
  [ProfileGen.updatePromptShouldStoreKeyOnServer]: (draftState, actions) => {
    return state.merge({promptShouldStoreKeyOnServer: action.payload.promptShouldStoreKeyOnServer})
  },
  [ProfileGen.addProof]: (draftState, actions) => {
    const platform = action.payload.platform
    const maybeNotGeneric = More.asPlatformsExpandedType(platform)
    return updateUsername(
      state.merge({
        errorCode: null,
        errorText: '',
        platform: maybeNotGeneric,
        platformGeneric: maybeNotGeneric ? null : platform,
      })
    )
  },
  [ProfileGen.proofParamsReceived]: (draftState, actions) => {
    return state.merge({
      platformGenericParams: action.payload.params,
    })
  },
  [ProfileGen.updatePlatformGenericURL]: (draftState, actions) => {
    return state.merge({
      platformGenericURL: action.payload.url,
    })
  },
  [ProfileGen.updatePlatformGenericChecking]: (draftState, actions) => {
    return state.merge({
      platformGenericChecking: action.payload.checking,
    })
  },
  [ProfileGen.cancelAddProof]: (draftState, actions) => {
    // fall
  },
  [ProfileGen.clearPlatformGeneric]: (draftState, actions) => {
    return state.merge({
      errorCode: null,
      errorText: '',
      platformGeneric: null,
      platformGenericChecking: false,
      platformGenericParams: null,
      platformGenericURL: null,
      username: '',
    })
  },
  [ProfileGen.recheckProof]: (draftState, actions) => {
    // fall
  },
  [ProfileGen.checkProof]: (draftState, actions) => {
    return state.merge({errorCode: null, errorText: ''})
  },
  [ProfileGen.submitBTCAddress]: (draftState, actions) => {
    // fall
  },
  [ProfileGen.submitZcashAddress]: (draftState, actions) => {
    return updateUsername(state)
  },
})
