// @flow
import * as SearchConstants from './searchv3'
import {List} from 'immutable'
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
  searchPending: boolean,
  searchResults: ?List<SearchConstants.SearchResultId>,
  searchShowingSuggestions: boolean,
}

export const addProof = 'profile:addProof'
export const backToProfile = 'profile:backToProfile'
export const cancelAddProof = 'profile:cancelAddProof'
export const cancelPgpGen = 'profile:cancelPgpGen'
export const checkProof = 'profile:checkProof'
export const cleanupUsername = 'profile:cleanupUsername'
export const clearSearchResults = 'profile:clearSearchResults'
export const dropPgp = 'profile:dropPgp'
export const editProfile = 'profile:editProfile'
export const finishRevokeProof = 'profile:revoke:finish'
export const finishRevoking = 'profile:finishRevoking'
export const finishedWithKeyGen = 'profile:FinishedWithKeyGen'
export const generatePgp = 'profile:generatePgp'
export const maxProfileBioChars = 256
export const onClickAvatar = 'profile:onClickAvatar'
export const onClickFollowers = 'profile:onClickFollowers'
export const onClickFollowing = 'profile:onClickFollowing'
export const onUserClick = 'profile:onUserClick'
export const outputInstructionsActionLink = 'profile:outputInstructionsActionLink'
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
export type AddProof = NoErrorTypedAction<'profile:addProof', {platform: PlatformsExpandedType}>
export type BackToProfile = NoErrorTypedAction<'profile:backToProfile', void>
export type CancelAddProof = NoErrorTypedAction<'profile:cancelAddProof', void>
export type CancelPgpGen = NoErrorTypedAction<'profile:cancelPgpGen', {}>
export type CheckProof = NoErrorTypedAction<'profile:checkProof', void>
export type CleanupUsername = TypedAction<'profile:cleanupUsername', void, void>
export type ClearSearchResults = NoErrorTypedAction<'profile:clearSearchResults', void>
export type DropPgp = TypedAction<'profile:dropPgp', {kid: KID}, {}>
export type EditProfile = NoErrorTypedAction<
  'profile:editProfile',
  {bio: string, fullName: string, location: string}
>
export type FinishRevokeProof = TypedAction<'profile:revoke:finish', void, {error: string}>
export type FinishRevoking = NoErrorTypedAction<'profile:finishRevoking', void>
export type FinishedWithKeyGen = NoErrorTypedAction<
  'profile:FinishedWithKeyGen',
  {shouldStoreKeyOnServer: boolean}
>
export type GeneratePgp = TypedAction<'profile:generatePgp', void, void>
export type OnClickAvatar = NoErrorTypedAction<
  'profile:onClickAvatar',
  {username: string, openWebsite: ?boolean}
>
export type OnClickFollowers = NoErrorTypedAction<
  'profile:onClickFollowers',
  {username: string, openWebsite: ?boolean}
>
export type OnClickFollowing = NoErrorTypedAction<
  'profile:onClickFollowing',
  {username: string, openWebsite: ?boolean}
>
export type OnUserClick = NoErrorTypedAction<'profile:onUserClick', {username: string}>
export type OutputInstructionsActionLink = NoErrorTypedAction<'profile:outputInstructionsActionLink', void>
export type SubmitZcashAddress = NoErrorTypedAction<'profile:submitZcashAddress', void>
export type SubmitBTCAddress = NoErrorTypedAction<'profile:submitBTCAddress', void>
export type SubmitRevokeProof = NoErrorTypedAction<'profile:submitRevokeProof', {proofId: string}>
export type SubmitUsername = NoErrorTypedAction<'profile:submitUsername', void>
export type UpdateErrorText = TypedAction<
  'profile:updateErrorText',
  {errorText: ?string, errorCode: ?number},
  void
>
export type UpdatePgpInfo = TypedAction<'profile:updatePgpInfo', $Shape<PgpInfo>, PgpInfoError> // $Shape is meant here instead of exact, because you can supply only the parts you want to update
export type UpdatePgpPublicKey = TypedAction<'profile:updatePgpPublicKey', {publicKey: string}, {}>
export type UpdatePlatform = TypedAction<'profile:updatePlatform', {platform: PlatformsExpandedType}, void>
export type UpdateProofStatus = TypedAction<
  'profile:updateProofStatus',
  {found: boolean, status: ProofStatus},
  void
>
export type UpdateProofText = TypedAction<'profile:updateProofText', {proof: string}, void>
export type UpdateSigID = TypedAction<'profile:updateSigID', {sigID: ?SigID}, void>
export type UpdateUsername = TypedAction<'profile:updateUsername', {username: string}, void>
export type Waiting = TypedAction<'profile:waiting', {waiting: boolean}, void>
export type WaitingRevokeProof = TypedAction<'profile:revoke:waiting', {waiting: boolean}, void>

export type PendingSearch = SearchConstants.PendingSearchGeneric<'profile:searchPending'>
export type UpdateSearchResults = SearchConstants.UpdateSearchResultsGeneric<'profile:updateSearchResults'>

export type Actions =
  | CleanupUsername
  | FinishRevokeProof
  | PendingSearch
  | UpdateErrorText
  | UpdatePlatform
  | UpdateProofStatus
  | UpdateProofText
  | UpdateSigID
  | UpdateUsername
  | Waiting
  | WaitingRevokeProof
  | UpdateSearchResults
