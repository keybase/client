// @flow
import type {PlatformsExpandedType} from './types/more'
import type {ProofStatus, SigID, KID} from './types/flow-types'
import type {TypedAction, NoErrorTypedAction} from './types/flux'

export type PgpInfo = {
  email1: ?string,
  email2: ?string,
  email3: ?string,
  errorText: ?string,
  fullName: ?string,
}

export type PgpInfoError = {
  errorText: ?string,
  errorEmail1: boolean,
  errorEmail2: boolean,
  errorEmail3: boolean,
}

export type State = {
  errorCode: ?number,
  errorText: ?string,
  pgpInfo: PgpInfo & PgpInfoError,
  pgpPublicKey: ?string,
  platform: ?PlatformsExpandedType,
  proofFound: boolean,
  proofStatus: ?ProofStatus,
  proofText: ?string,
  revoke: {
    error?: string,
    waiting?: boolean,
  },
  sigID: ?SigID,
  username: string,
  usernameValid: boolean,
  waiting: boolean,
  searchShowingSuggestions: boolean,
}

export const maxProfileBioChars = 256
export const addProof = 'profile:addProof'
export const backToProfile = 'profile:backToProfile'
export const cancelAddProof = 'profile:cancelAddProof'
export const cancelPgpGen = 'profile:cancelPgpGen'
export const checkProof = 'profile:checkProof'
export const cleanupUsername = 'profile:cleanupUsername'
export const dropPgp = 'profile:dropPgp'
export const editProfile = 'profile:editProfile'
export const finishRevokeProof = 'profile:revoke:finish'
export const finishRevoking = 'profile:finishRevoking'
export const finishedWithKeyGen = 'profile:FinishedWithKeyGen'
export const generatePgp = 'profile:generatePgp'
export const onClickAvatar = 'profile:onClickAvatar'
export const onClickFollowers = 'profile:onClickFollowers'
export const onClickFollowing = 'profile:onClickFollowing'
export const outputInstructionsActionLink = 'profile:outputInstructionsActionLink'
export const showUserProfile = 'profile:showUserProfile'
export const submitBTCAddress = 'profile:submitBTCAddress'
export const submitZcashAddress = 'profile:submitZcashAddress'
export const submitRevokeProof = 'profile:submitRevokeProof'
export const submitUsername = 'profile:submitUsername'
export const updateErrorText = 'profile:updateErrorText'
export const updatePgpInfo = 'profile:updatePgpInfo'
export const updatePgpPublicKey = 'profile:updatePgpPublicKey'
export const updatePlatform = 'profile:updatePlatform'
export const updateProofStatus = 'profile:updateProofStatus'
export const updateProofText = 'profile:updateProofText'
export const updateSigID = 'profile:updateSigID'
export const updateUsername = 'profile:updateUsername'
export const waiting = 'profile:waiting'
export const waitingRevokeProof = 'profile:revoke:waiting'

export type Actions =
  | CleanupUsername
  | FinishRevokeProof
  | UpdateErrorText
  | UpdatePlatform
  | UpdateProofStatus
  | UpdateProofText
  | UpdateSigID
  | UpdateUsername
  | Waiting
  | WaitingRevokeProof
