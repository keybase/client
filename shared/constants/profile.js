// @flow
import type {PlatformsExpandedType} from '../constants/types/more'
import type {TypedAction} from '../constants/types/flux'
import type {ProofStatus, SigID} from '../constants/types/flow-types'

export const editingProfile = 'profile:editingProfile'
export const editedProfile = 'profile:editedProfile'

export const waiting = 'profile:waiting'
export type Waiting = TypedAction<'profile:waiting', {waiting: boolean}, void>

export const updatePlatform = 'profile:updatePlatform'
export type UpdatePlatform = TypedAction<'profile:updatePlatform', {platform: PlatformsExpandedType}, void>

export const updateUsername = 'profile:updateUsername'
export type UpdateUsername = TypedAction<'profile:updateUsername', {username: string}, void>

export const cleanupUsername = 'profile:cleanupUsername'
export type CleanupUsername = TypedAction<'profile:cleanupUsername', void, void>

export const waitingRevokeProof = 'profile:revoke:waiting'
export type WaitingRevokeProof = TypedAction<'profile:revoke:waiting', {waiting: boolean}, void>

export const finishRevokeProof = 'profile:revoke:finish'
export type FinishRevokeProof = TypedAction<'profile:revoke:finish', void, {error: string}>

export const updateProofText = 'profile:updateProofText'
export type UpdateProofText = TypedAction<'profile:updateProofText', {proof: string}, void>

export const updateErrorText = 'profile:updateErrorText'
export type UpdateErrorText = TypedAction<'profile:updateErrorText', {errorText: ?string, errorCode: ?number}, void>

export const updateProofStatus = 'profile:updateProofStatus'
export type UpdateProofStatus = TypedAction<'profile:updateProofStatus', {found: boolean, status: ProofStatus}, void>

export const updateSigID = 'profile:updateSigID'
export type UpdateSigID = TypedAction<'profile:updateSigID', {sigID: SigID}, void>

// $Shape is meant here instead of exact, because you can supply only the
// parts you want to update
export const updatePgpInfo = 'profile:updatePgpInfo'
export type UpdatePgpInfo = TypedAction<'profile:updatePgpInfo', $Shape<PgpInfo>, PgpInfoError>

export const generatePgp = 'profile:generatePgp'
export type GeneratePgp = TypedAction<'profile:generatePgp', void, void>

export const updatePgpPublicKey = 'profile:updatePgpPublicKey'
export type UpdatePgpPublicKey = TypedAction<'profile:updatePgpPublicKey', {publicKey: string}, {}>

export const finishedWithKeyGen = 'profile:FinishedWithKeyGen'
export type FinishedWithKeyGen = TypedAction<'profile:FinishedWithKeyGen', {shouldStoreKeyOnServer: boolean}, {}>

export const maxProfileBioChars = 256

export type Actions = Waiting
  | UpdatePlatform
  | UpdateUsername
  | CleanupUsername
  | WaitingRevokeProof
  | FinishRevokeProof
  | UpdateProofText
  | UpdateErrorText
  | UpdateProofStatus
  | UpdateSigID

export type PgpInfo = {
  fullName: ?string,
  errorText: ?string,
  email1: ?string,
  email2: ?string,
  email3: ?string,
}

export type PgpInfoError = {
  errorText: ?string,
  errorEmail1: boolean,
  errorEmail2: boolean,
  errorEmail3: boolean,
}

export type State = {
  errorText: ?string,
  errorCode: ?number,
  waiting: boolean,
  username: string,
  platform: ?PlatformsExpandedType,
  usernameValid: boolean,
  revoke: {
    waiting?: boolean,
    error?: string,
  },
  proofFound: boolean,
  proofStatus: ?ProofStatus,
  sigID: ?SigID,
  pgpInfo: PgpInfo & PgpInfoError,
  pgpPublicKey: ?string,
}
