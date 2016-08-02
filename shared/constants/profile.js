// @flow
import type {PlatformsExpanded} from '../constants/types/more'
import type {TypedAction} from '../constants/types/flux'
import type {ProofStatus} from '../constants/types/flow-types'

export const editingProfile = 'profile:editingProfile'
export const editedProfile = 'profile:editedProfile'

export const waiting = 'profile:waiting'
export type Waiting = TypedAction<'profile:waiting', {waiting: boolean}, void>

export const updatePlatform = 'profile:updatePlatform'
export type UpdatePlatform = TypedAction<'profile:updatePlatform', {platform: PlatformsExpanded}, void>

export const updateUsername = 'profile:updateUsername'
export type UpdateUsername = TypedAction<'profile:updateUsername', {username: string}, void>

export const updateProofText = 'profile:updateProofText'
export type UpdateProofText = TypedAction<'profile:updateProofText', {proof: string}, void>

export const updateError = 'profile:updateError'
export type UpdateError = TypedAction<'profile:updateError', {error: string}, void>

export const updateProofStatus = 'profile:updateProofStatus'
export type UpdateProofStatus = TypedAction<'profile:updateProofStatus', {found: boolean, status: ProofStatus}, void>

export const maxProfileBioChars = 256

export type Actions = Waiting
  | UpdatePlatform
  | UpdateUsername
  | UpdateProofText
  | UpdateError
  | UpdateProofStatus

export type State = {
  error: ?string,
  waiting: boolean,
  username: string,
  platform: ?PlatformsExpanded,
  usernameValid: boolean,
  proofFound: boolean,
  proofStatus: ?ProofStatus,
}
