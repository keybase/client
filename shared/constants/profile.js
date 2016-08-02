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

export const waitingRevokeProof = 'profile:revoke:waiting'
export type WaitingRevokeProof = TypedAction<'profile:revoke:waiting', {waiting: boolean}, void>

export const finishRevokeProof = 'profile:revoke:finish'
export type FinishRevokeProof = TypedAction<'profile:revoke:finish', void, {error: string}>

export const updateProofText = 'profile:updateProofText'
export type UpdateProofText = TypedAction<'profile:updateProofText', {proof: string}, void>

export const updateError = 'profile:updateError'
export type UpdateError = TypedAction<'profile:updateError', {error: ?string, errorCode: number}, void>

export const updateProofStatus = 'profile:updateProofStatus'
export type UpdateProofStatus = TypedAction<'profile:updateProofStatus', {found: boolean, status: ProofStatus}, void>

export const updateSigID = 'profile:updateSigID'
export type UpdateSigID = TypedAction<'profile:updateSigID', {sigID: SigID}, void>

export const maxProfileBioChars = 256

export type Actions = Waiting
  | UpdatePlatform
  | UpdateUsername
  | WaitingRevokeProof
  | FinishRevokeProof
  | UpdateProofText
  | UpdateError
  | UpdateProofStatus
  | UpdateSigID

export type State = {
  error: ?string,
  errorCode: number,
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
}
