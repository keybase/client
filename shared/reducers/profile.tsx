import * as ProfileGen from '../actions/profile-gen'
import type * as Types from '../constants/types/profile'
import * as More from '../constants/types/more'
import * as Container from '../util/container'
import * as Constants from '../constants/profile'
import * as Validators from '../util/simple-validators'

const updateUsername = (draftState: Container.Draft<Types.State>) => {
  let username = draftState.username ?? ''
  let usernameValid = true

  switch (draftState.platform) {
    case 'http': // fallthrough
    case 'https':
      // Ensure that only the hostname is getting returned, with no
      // protocol, port, or path information
      username =
        username &&
        username
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

  draftState.username = username
  draftState.usernameValid = usernameValid
}

const clearErrors = (draftState: Container.Draft<Types.State>) => {
  draftState.errorCode = undefined
  draftState.errorText = ''
  draftState.platformGeneric = undefined
  draftState.platformGenericChecking = false
  draftState.platformGenericParams = undefined
  draftState.platformGenericURL = undefined
  draftState.username = ''
}

const initialState = Constants.makeInitialState()

export default Container.makeReducer<ProfileGen.Actions, Types.State>(initialState, {
  [ProfileGen.resetStore]: () => initialState,
  [ProfileGen.updatePlatform]: (draftState, action) => {
    draftState.platform = action.payload.platform
    updateUsername(draftState)
  },
  [ProfileGen.updateUsername]: (draftState, action) => {
    draftState.username = action.payload.username
    updateUsername(draftState)
  },
  [ProfileGen.cleanupUsername]: draftState => {
    updateUsername(draftState)
  },
  [ProfileGen.revokeFinish]: (draftState, action) => {
    draftState.revokeError = action.payload.error ?? ''
  },
  [ProfileGen.submitBlockUser]: draftState => {
    draftState.blockUserModal = 'waiting'
  },
  [ProfileGen.finishBlockUser]: (draftState, action) => {
    draftState.blockUserModal = action.payload.error ? {error: action.payload.error} : undefined
  },
  [ProfileGen.updateProofText]: (draftState, action) => {
    draftState.proofText = action.payload.proof
  },
  [ProfileGen.updateProofStatus]: (draftState, action) => {
    draftState.proofFound = action.payload.found
    draftState.proofStatus = action.payload.status
  },
  [ProfileGen.updateErrorText]: (draftState, action) => {
    draftState.errorCode = action.payload.errorCode
    draftState.errorText = action.payload.errorText
  },
  [ProfileGen.updateSigID]: (draftState, action) => {
    draftState.sigID = action.payload.sigID
  },
  [ProfileGen.updatePgpInfo]: (draftState, action) => {
    const valid1 = Validators.isValidEmail(draftState.pgpEmail1)
    const valid2 = draftState.pgpEmail2 && Validators.isValidEmail(draftState.pgpEmail2)
    const valid3 = draftState.pgpEmail3 && Validators.isValidEmail(draftState.pgpEmail3)
    draftState.pgpErrorEmail1 = !!valid1
    draftState.pgpErrorEmail2 = !!valid2
    draftState.pgpErrorEmail3 = !!valid3
    draftState.pgpErrorText = Validators.isValidName(draftState.pgpFullName) || valid1 || valid2 || valid3
    draftState.pgpFullName = action.payload.pgpFullName ?? draftState.pgpFullName
    draftState.pgpEmail1 = action.payload.pgpEmail1 ?? draftState.pgpEmail1
    draftState.pgpEmail2 = action.payload.pgpEmail2 ?? draftState.pgpEmail2
    draftState.pgpEmail3 = action.payload.pgpEmail3 ?? draftState.pgpEmail3
  },
  [ProfileGen.updatePgpPublicKey]: (draftState, action) => {
    draftState.pgpPublicKey = action.payload.publicKey
  },
  [ProfileGen.updatePromptShouldStoreKeyOnServer]: (draftState, action) => {
    draftState.promptShouldStoreKeyOnServer = action.payload.promptShouldStoreKeyOnServer
  },
  [ProfileGen.addProof]: (draftState, action) => {
    const {platform} = action.payload
    const maybeNotGeneric = More.asPlatformsExpandedType(platform)
    draftState.errorCode = undefined
    draftState.errorText = ''
    draftState.platform = maybeNotGeneric ?? undefined
    draftState.platformGeneric = maybeNotGeneric ? undefined : platform
    updateUsername(draftState)
  },
  [ProfileGen.proofParamsReceived]: (draftState, action) => {
    const {params} = action.payload
    draftState.platformGenericParams = params
  },
  [ProfileGen.updatePlatformGenericURL]: (draftState, action) => {
    draftState.platformGenericURL = action.payload.url
  },
  [ProfileGen.updatePlatformGenericChecking]: (draftState, action) => {
    draftState.platformGenericChecking = action.payload.checking
  },
  [ProfileGen.cancelAddProof]: draftState => {
    clearErrors(draftState)
  },
  [ProfileGen.clearPlatformGeneric]: draftState => {
    clearErrors(draftState)
  },
  [ProfileGen.recheckProof]: draftState => {
    draftState.errorCode = undefined
    draftState.errorText = ''
  },
  [ProfileGen.checkProof]: draftState => {
    draftState.errorCode = undefined
    draftState.errorText = ''
  },
  [ProfileGen.submitBTCAddress]: draftState => {
    updateUsername(draftState)
  },
  [ProfileGen.submitZcashAddress]: draftState => {
    updateUsername(draftState)
  },
  [ProfileGen.wotVouch]: draftState => {
    draftState.wotAuthorError = ''
  },
  [ProfileGen.wotVouchSetError]: (draftState, action) => {
    draftState.wotAuthorError = action.payload.error
  },
})
