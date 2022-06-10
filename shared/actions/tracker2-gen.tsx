// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate

import type * as Types from '../constants/types/tracker2'

// Constants
export const resetStore = 'common:resetStore' // not a part of tracker2 but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'tracker2:'
export const changeFollow = 'tracker2:changeFollow'
export const closeTracker = 'tracker2:closeTracker'
export const getProofSuggestions = 'tracker2:getProofSuggestions'
export const ignore = 'tracker2:ignore'
export const load = 'tracker2:load'
export const loadNonUserProfile = 'tracker2:loadNonUserProfile'
export const loadedNonUserProfile = 'tracker2:loadedNonUserProfile'
export const proofSuggestionsUpdated = 'tracker2:proofSuggestionsUpdated'
export const showUser = 'tracker2:showUser'
export const updateFollows = 'tracker2:updateFollows'
export const updateResult = 'tracker2:updateResult'
export const updateWotEntries = 'tracker2:updateWotEntries'
export const updatedDetails = 'tracker2:updatedDetails'

// Action Creators
/**
 * Short term until new nav, a convenience to show a card from inside the app
 */
export const createShowUser = (payload: {
  readonly asTracker: boolean
  readonly username: string
  readonly skipNav?: boolean
}) => ({payload, type: showUser as typeof showUser})
export const createChangeFollow = (payload: {readonly guiID: string; readonly follow: boolean}) => ({
  payload,
  type: changeFollow as typeof changeFollow,
})
export const createCloseTracker = (payload: {readonly guiID: string}) => ({
  payload,
  type: closeTracker as typeof closeTracker,
})
export const createGetProofSuggestions = (payload?: undefined) => ({
  payload,
  type: getProofSuggestions as typeof getProofSuggestions,
})
export const createIgnore = (payload: {readonly guiID: string}) => ({payload, type: ignore as typeof ignore})
export const createLoad = (payload: {
  readonly assertion: string
  readonly forceDisplay?: boolean
  readonly fromDaemon?: boolean
  readonly guiID: string
  readonly ignoreCache?: boolean
  readonly reason: string
  readonly inTracker: boolean
}) => ({payload, type: load as typeof load})
export const createLoadNonUserProfile = (payload: {readonly assertion: string}) => ({
  payload,
  type: loadNonUserProfile as typeof loadNonUserProfile,
})
export const createLoadedNonUserProfile = (payload: {
  readonly assertion: string
  readonly assertionKey: string
  readonly assertionValue: string
  readonly formattedName?: string
  readonly bio?: string
  readonly description: string
  readonly fullName?: string
  readonly location?: string
  readonly pictureUrl?: string
  readonly siteIcon: Array<Types.SiteIcon>
  readonly siteIconDarkmode: Array<Types.SiteIcon>
  readonly siteIconFull: Array<Types.SiteIcon>
  readonly siteIconFullDarkmode: Array<Types.SiteIcon>
}) => ({payload, type: loadedNonUserProfile as typeof loadedNonUserProfile})
export const createProofSuggestionsUpdated = (payload: {
  readonly suggestions: ReadonlyArray<Types.Assertion>
}) => ({payload, type: proofSuggestionsUpdated as typeof proofSuggestionsUpdated})
export const createUpdateFollows = (payload: {
  readonly username: string
  readonly following?: Array<{fullname: string; username: string}>
  readonly followers?: Array<{fullname: string; username: string}>
}) => ({payload, type: updateFollows as typeof updateFollows})
export const createUpdateResult = (payload: {
  readonly guiID: string
  readonly result: Types.DetailsState
  readonly reason?: string
}) => ({payload, type: updateResult as typeof updateResult})
export const createUpdateWotEntries = (payload: {
  readonly voucheeUsername: string
  readonly entries: Array<Types.WebOfTrustEntry>
}) => ({payload, type: updateWotEntries as typeof updateWotEntries})
export const createUpdatedDetails = (payload: {
  readonly guiID: string
  readonly bio: string
  readonly fullname: string
  readonly location: string
  readonly unverifiedFollowersCount: number
  readonly unverifiedFollowingCount: number
  readonly stellarHidden: boolean
  readonly username: string
  readonly teamShowcase: Array<Types.TeamShowcase>
  readonly blocked: boolean
  readonly hidFromFollowers: boolean
}) => ({payload, type: updatedDetails as typeof updatedDetails})

// Action Payloads
export type ChangeFollowPayload = ReturnType<typeof createChangeFollow>
export type CloseTrackerPayload = ReturnType<typeof createCloseTracker>
export type GetProofSuggestionsPayload = ReturnType<typeof createGetProofSuggestions>
export type IgnorePayload = ReturnType<typeof createIgnore>
export type LoadNonUserProfilePayload = ReturnType<typeof createLoadNonUserProfile>
export type LoadPayload = ReturnType<typeof createLoad>
export type LoadedNonUserProfilePayload = ReturnType<typeof createLoadedNonUserProfile>
export type ProofSuggestionsUpdatedPayload = ReturnType<typeof createProofSuggestionsUpdated>
export type ShowUserPayload = ReturnType<typeof createShowUser>
export type UpdateFollowsPayload = ReturnType<typeof createUpdateFollows>
export type UpdateResultPayload = ReturnType<typeof createUpdateResult>
export type UpdateWotEntriesPayload = ReturnType<typeof createUpdateWotEntries>
export type UpdatedDetailsPayload = ReturnType<typeof createUpdatedDetails>

// All Actions
// prettier-ignore
export type Actions =
  | ChangeFollowPayload
  | CloseTrackerPayload
  | GetProofSuggestionsPayload
  | IgnorePayload
  | LoadNonUserProfilePayload
  | LoadPayload
  | LoadedNonUserProfilePayload
  | ProofSuggestionsUpdatedPayload
  | ShowUserPayload
  | UpdateFollowsPayload
  | UpdateResultPayload
  | UpdateWotEntriesPayload
  | UpdatedDetailsPayload
  | {readonly type: 'common:resetStore', readonly payload: undefined}
