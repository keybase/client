// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier,no-use-before-define */

import * as I from 'immutable'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Types from '../constants/types/tracker'
import * as FolderTypes from '../constants/types/folders'

// Constants
export const resetStore = 'common:resetStore' // not a part of tracker but is handled by every reducer
export const cacheIdentify = 'tracker:cacheIdentify'
export const follow = 'tracker:follow'
export const getMyProfile = 'tracker:getMyProfile'
export const getProfile = 'tracker:getProfile'
export const identifyFinished = 'tracker:identifyFinished'
export const identifyStarted = 'tracker:identifyStarted'
export const ignore = 'tracker:ignore'
export const markActiveIdentifyUi = 'tracker:markActiveIdentifyUi'
export const onClose = 'tracker:onClose'
export const onError = 'tracker:onError'
export const openProofUrl = 'tracker:openProofUrl'
export const parseFriendship = 'tracker:parseFriendship'
export const pendingIdentify = 'tracker:pendingIdentify'
export const refollow = 'tracker:refollow'
export const remoteDismiss = 'tracker:remoteDismiss'
export const reportLastTrack = 'tracker:reportLastTrack'
export const resetProofs = 'tracker:resetProofs'
export const setNeedTrackTokenDismiss = 'tracker:setNeedTrackTokenDismiss'
export const setOnFollow = 'tracker:setOnFollow'
export const setOnRefollow = 'tracker:setOnRefollow'
export const setOnUnfollow = 'tracker:setOnUnfollow'
export const setProofs = 'tracker:setProofs'
export const setRegisterIdentifyUi = 'tracker:setRegisterIdentifyUi'
export const setUpdateTrackers = 'tracker:setUpdateTrackers'
export const setupTrackerHandlers = 'tracker:setupTrackerHandlers'
export const showNonUser = 'tracker:showNonUser'
export const showTracker = 'tracker:showTracker'
export const unfollow = 'tracker:unfollow'
export const updateBTC = 'tracker:updateBTC'
export const updateEldestKidChanged = 'tracker:updateEldestKidChanged'
export const updateFolders = 'tracker:updateFolders'
export const updatePGPKey = 'tracker:updatePGPKey'
export const updateProof = 'tracker:updateProof'
export const updateProofState = 'tracker:updateProofState'
export const updateReason = 'tracker:updateReason'
export const updateSelectedTeam = 'tracker:updateSelectedTeam'
export const updateTrackToken = 'tracker:updateTrackToken'
export const updateTrackers = 'tracker:updateTrackers'
export const updateUserInfo = 'tracker:updateUserInfo'
export const updateUsername = 'tracker:updateUsername'
export const updateZcash = 'tracker:updateZcash'
export const waiting = 'tracker:waiting'

// Payload Types
type _CacheIdentifyPayload = $ReadOnly<{|
  uid: string,
  goodTill: number,
|}>
type _FollowPayload = $ReadOnly<{|
  username: string,
  localIgnore?: boolean,
|}>
type _GetMyProfilePayload = $ReadOnly<{|ignoreCache?: boolean|}>
type _GetProfilePayload = $ReadOnly<{|
  username: string,
  ignoreCache?: boolean,
  forceDisplay?: boolean,
|}>
type _IdentifyFinishedPayload = $ReadOnly<{|username: string|}>
type _IdentifyFinishedPayloadError = $ReadOnly<{|
  username: string,
  error: string,
|}>
type _IdentifyStartedPayload = $ReadOnly<{|username: string|}>
type _IgnorePayload = $ReadOnly<{|username: string|}>
type _MarkActiveIdentifyUiPayload = $ReadOnly<{|
  username: string,
  active: boolean,
|}>
type _OnClosePayload = $ReadOnly<{|username: string|}>
type _OnErrorPayload = $ReadOnly<{|
  username: string,
  extraText: string,
|}>
type _OpenProofUrlPayload = $ReadOnly<{|proof: Types.Proof|}>
type _ParseFriendshipPayload = $ReadOnly<{|
  username: string,
  uid: string,
  fullname: string,
  followsYou: string,
  following: string,
|}>
type _PendingIdentifyPayload = $ReadOnly<{|
  username: string,
  pending: boolean,
|}>
type _RefollowPayload = $ReadOnly<{|username: string|}>
type _RemoteDismissPayload = $ReadOnly<{|username: string|}>
type _ReportLastTrackPayload = $ReadOnly<{|
  username: string,
  tracking?: boolean,
|}>
type _ResetProofsPayload = $ReadOnly<{|username: string|}>
type _SetNeedTrackTokenDismissPayload = $ReadOnly<{|
  username: string,
  needTrackTokenDismiss: boolean,
|}>
type _SetOnFollowPayload = $ReadOnly<{|username: string|}>
type _SetOnRefollowPayload = $ReadOnly<{|username: string|}>
type _SetOnUnfollowPayload = $ReadOnly<{|username: string|}>
type _SetProofsPayload = $ReadOnly<{|
  username: string,
  identity: RPCTypes.Identity,
|}>
type _SetRegisterIdentifyUiPayload = $ReadOnly<{|started: boolean|}>
type _SetUpdateTrackersPayload = $ReadOnly<{|
  username: string,
  trackers: Array<{|username: string, uid: string, fullname: string, followsYou: boolean, following: boolean|}>,
  tracking: Array<{|username: string, uid: string, fullname: string, followsYou: boolean, following: boolean|}>,
|}>
type _SetupTrackerHandlersPayload = void
type _ShowNonUserPayload = $ReadOnly<{|
  username: string,
  nonUser: RPCTypes.IdentifyUiDisplayTLFCreateWithInviteRpcParam,
|}>
type _ShowTrackerPayload = $ReadOnly<{|username: string|}>
type _UnfollowPayload = $ReadOnly<{|username: string|}>
type _UpdateBTCPayload = $ReadOnly<{|
  username: string,
  address: string,
  sigID: string,
|}>
type _UpdateEldestKidChangedPayload = $ReadOnly<{|username: string|}>
type _UpdateFoldersPayload = $ReadOnly<{|
  username: string,
  tlfs: Array<FolderTypes.Folder>,
|}>
type _UpdatePGPKeyPayload = $ReadOnly<{|
  username: string,
  pgpFingerprint: Buffer,
  kid: string,
|}>
type _UpdateProofPayload = $ReadOnly<{|
  remoteProof: RPCTypes.RemoteProof,
  linkCheckResult: RPCTypes.LinkCheckResult,
  username: string,
|}>
type _UpdateProofStatePayload = $ReadOnly<{|username: string|}>
type _UpdateReasonPayload = $ReadOnly<{|
  username: string,
  reason: ?string,
|}>
type _UpdateSelectedTeamPayload = $ReadOnly<{|
  selectedTeam: string,
  username: string,
|}>
type _UpdateTrackTokenPayload = $ReadOnly<{|
  username: string,
  trackToken: RPCTypes.TrackToken,
|}>
type _UpdateTrackersPayload = $ReadOnly<{|username: string|}>
type _UpdateUserInfoPayload = $ReadOnly<{|
  userCard: RPCTypes.UserCard,
  username: string,
|}>
type _UpdateUsernamePayload = $ReadOnly<{|username: string|}>
type _UpdateZcashPayload = $ReadOnly<{|
  username: string,
  address: string,
  sigID: string,
|}>
type _WaitingPayload = $ReadOnly<{|
  username: string,
  waiting: boolean,
|}>

// Action Creators
export const createCacheIdentify = (payload: _CacheIdentifyPayload) => ({error: false, payload, type: cacheIdentify})
export const createFollow = (payload: _FollowPayload) => ({error: false, payload, type: follow})
export const createGetMyProfile = (payload: _GetMyProfilePayload) => ({error: false, payload, type: getMyProfile})
export const createGetProfile = (payload: _GetProfilePayload) => ({error: false, payload, type: getProfile})
export const createIdentifyFinished = (payload: _IdentifyFinishedPayload) => ({error: false, payload, type: identifyFinished})
export const createIdentifyFinishedError = (payload: _IdentifyFinishedPayloadError) => ({error: true, payload, type: identifyFinished})
export const createIdentifyStarted = (payload: _IdentifyStartedPayload) => ({error: false, payload, type: identifyStarted})
export const createIgnore = (payload: _IgnorePayload) => ({error: false, payload, type: ignore})
export const createMarkActiveIdentifyUi = (payload: _MarkActiveIdentifyUiPayload) => ({error: false, payload, type: markActiveIdentifyUi})
export const createOnClose = (payload: _OnClosePayload) => ({error: false, payload, type: onClose})
export const createOnError = (payload: _OnErrorPayload) => ({error: false, payload, type: onError})
export const createOpenProofUrl = (payload: _OpenProofUrlPayload) => ({error: false, payload, type: openProofUrl})
export const createParseFriendship = (payload: _ParseFriendshipPayload) => ({error: false, payload, type: parseFriendship})
export const createPendingIdentify = (payload: _PendingIdentifyPayload) => ({error: false, payload, type: pendingIdentify})
export const createRefollow = (payload: _RefollowPayload) => ({error: false, payload, type: refollow})
export const createRemoteDismiss = (payload: _RemoteDismissPayload) => ({error: false, payload, type: remoteDismiss})
export const createReportLastTrack = (payload: _ReportLastTrackPayload) => ({error: false, payload, type: reportLastTrack})
export const createResetProofs = (payload: _ResetProofsPayload) => ({error: false, payload, type: resetProofs})
export const createSetNeedTrackTokenDismiss = (payload: _SetNeedTrackTokenDismissPayload) => ({error: false, payload, type: setNeedTrackTokenDismiss})
export const createSetOnFollow = (payload: _SetOnFollowPayload) => ({error: false, payload, type: setOnFollow})
export const createSetOnRefollow = (payload: _SetOnRefollowPayload) => ({error: false, payload, type: setOnRefollow})
export const createSetOnUnfollow = (payload: _SetOnUnfollowPayload) => ({error: false, payload, type: setOnUnfollow})
export const createSetProofs = (payload: _SetProofsPayload) => ({error: false, payload, type: setProofs})
export const createSetRegisterIdentifyUi = (payload: _SetRegisterIdentifyUiPayload) => ({error: false, payload, type: setRegisterIdentifyUi})
export const createSetUpdateTrackers = (payload: _SetUpdateTrackersPayload) => ({error: false, payload, type: setUpdateTrackers})
export const createSetupTrackerHandlers = (payload: _SetupTrackerHandlersPayload) => ({error: false, payload, type: setupTrackerHandlers})
export const createShowNonUser = (payload: _ShowNonUserPayload) => ({error: false, payload, type: showNonUser})
export const createShowTracker = (payload: _ShowTrackerPayload) => ({error: false, payload, type: showTracker})
export const createUnfollow = (payload: _UnfollowPayload) => ({error: false, payload, type: unfollow})
export const createUpdateBTC = (payload: _UpdateBTCPayload) => ({error: false, payload, type: updateBTC})
export const createUpdateEldestKidChanged = (payload: _UpdateEldestKidChangedPayload) => ({error: false, payload, type: updateEldestKidChanged})
export const createUpdateFolders = (payload: _UpdateFoldersPayload) => ({error: false, payload, type: updateFolders})
export const createUpdatePGPKey = (payload: _UpdatePGPKeyPayload) => ({error: false, payload, type: updatePGPKey})
export const createUpdateProof = (payload: _UpdateProofPayload) => ({error: false, payload, type: updateProof})
export const createUpdateProofState = (payload: _UpdateProofStatePayload) => ({error: false, payload, type: updateProofState})
export const createUpdateReason = (payload: _UpdateReasonPayload) => ({error: false, payload, type: updateReason})
export const createUpdateSelectedTeam = (payload: _UpdateSelectedTeamPayload) => ({error: false, payload, type: updateSelectedTeam})
export const createUpdateTrackToken = (payload: _UpdateTrackTokenPayload) => ({error: false, payload, type: updateTrackToken})
export const createUpdateTrackers = (payload: _UpdateTrackersPayload) => ({error: false, payload, type: updateTrackers})
export const createUpdateUserInfo = (payload: _UpdateUserInfoPayload) => ({error: false, payload, type: updateUserInfo})
export const createUpdateUsername = (payload: _UpdateUsernamePayload) => ({error: false, payload, type: updateUsername})
export const createUpdateZcash = (payload: _UpdateZcashPayload) => ({error: false, payload, type: updateZcash})
export const createWaiting = (payload: _WaitingPayload) => ({error: false, payload, type: waiting})

// Action Payloads
export type CacheIdentifyPayload = $Call<typeof createCacheIdentify, _CacheIdentifyPayload>
export type FollowPayload = $Call<typeof createFollow, _FollowPayload>
export type GetMyProfilePayload = $Call<typeof createGetMyProfile, _GetMyProfilePayload>
export type GetProfilePayload = $Call<typeof createGetProfile, _GetProfilePayload>
export type IdentifyFinishedPayload = $Call<typeof createIdentifyFinished, _IdentifyFinishedPayload>
export type IdentifyFinishedPayloadError = $Call<typeof createIdentifyFinishedError, _IdentifyFinishedPayloadError>
export type IdentifyStartedPayload = $Call<typeof createIdentifyStarted, _IdentifyStartedPayload>
export type IgnorePayload = $Call<typeof createIgnore, _IgnorePayload>
export type MarkActiveIdentifyUiPayload = $Call<typeof createMarkActiveIdentifyUi, _MarkActiveIdentifyUiPayload>
export type OnClosePayload = $Call<typeof createOnClose, _OnClosePayload>
export type OnErrorPayload = $Call<typeof createOnError, _OnErrorPayload>
export type OpenProofUrlPayload = $Call<typeof createOpenProofUrl, _OpenProofUrlPayload>
export type ParseFriendshipPayload = $Call<typeof createParseFriendship, _ParseFriendshipPayload>
export type PendingIdentifyPayload = $Call<typeof createPendingIdentify, _PendingIdentifyPayload>
export type RefollowPayload = $Call<typeof createRefollow, _RefollowPayload>
export type RemoteDismissPayload = $Call<typeof createRemoteDismiss, _RemoteDismissPayload>
export type ReportLastTrackPayload = $Call<typeof createReportLastTrack, _ReportLastTrackPayload>
export type ResetProofsPayload = $Call<typeof createResetProofs, _ResetProofsPayload>
export type SetNeedTrackTokenDismissPayload = $Call<typeof createSetNeedTrackTokenDismiss, _SetNeedTrackTokenDismissPayload>
export type SetOnFollowPayload = $Call<typeof createSetOnFollow, _SetOnFollowPayload>
export type SetOnRefollowPayload = $Call<typeof createSetOnRefollow, _SetOnRefollowPayload>
export type SetOnUnfollowPayload = $Call<typeof createSetOnUnfollow, _SetOnUnfollowPayload>
export type SetProofsPayload = $Call<typeof createSetProofs, _SetProofsPayload>
export type SetRegisterIdentifyUiPayload = $Call<typeof createSetRegisterIdentifyUi, _SetRegisterIdentifyUiPayload>
export type SetUpdateTrackersPayload = $Call<typeof createSetUpdateTrackers, _SetUpdateTrackersPayload>
export type SetupTrackerHandlersPayload = $Call<typeof createSetupTrackerHandlers, _SetupTrackerHandlersPayload>
export type ShowNonUserPayload = $Call<typeof createShowNonUser, _ShowNonUserPayload>
export type ShowTrackerPayload = $Call<typeof createShowTracker, _ShowTrackerPayload>
export type UnfollowPayload = $Call<typeof createUnfollow, _UnfollowPayload>
export type UpdateBTCPayload = $Call<typeof createUpdateBTC, _UpdateBTCPayload>
export type UpdateEldestKidChangedPayload = $Call<typeof createUpdateEldestKidChanged, _UpdateEldestKidChangedPayload>
export type UpdateFoldersPayload = $Call<typeof createUpdateFolders, _UpdateFoldersPayload>
export type UpdatePGPKeyPayload = $Call<typeof createUpdatePGPKey, _UpdatePGPKeyPayload>
export type UpdateProofPayload = $Call<typeof createUpdateProof, _UpdateProofPayload>
export type UpdateProofStatePayload = $Call<typeof createUpdateProofState, _UpdateProofStatePayload>
export type UpdateReasonPayload = $Call<typeof createUpdateReason, _UpdateReasonPayload>
export type UpdateSelectedTeamPayload = $Call<typeof createUpdateSelectedTeam, _UpdateSelectedTeamPayload>
export type UpdateTrackTokenPayload = $Call<typeof createUpdateTrackToken, _UpdateTrackTokenPayload>
export type UpdateTrackersPayload = $Call<typeof createUpdateTrackers, _UpdateTrackersPayload>
export type UpdateUserInfoPayload = $Call<typeof createUpdateUserInfo, _UpdateUserInfoPayload>
export type UpdateUsernamePayload = $Call<typeof createUpdateUsername, _UpdateUsernamePayload>
export type UpdateZcashPayload = $Call<typeof createUpdateZcash, _UpdateZcashPayload>
export type WaitingPayload = $Call<typeof createWaiting, _WaitingPayload>

// All Actions
// prettier-ignore
export type Actions =
  | CacheIdentifyPayload
  | FollowPayload
  | GetMyProfilePayload
  | GetProfilePayload
  | IdentifyFinishedPayload
  | IdentifyFinishedPayloadError
  | IdentifyStartedPayload
  | IgnorePayload
  | MarkActiveIdentifyUiPayload
  | OnClosePayload
  | OnErrorPayload
  | OpenProofUrlPayload
  | ParseFriendshipPayload
  | PendingIdentifyPayload
  | RefollowPayload
  | RemoteDismissPayload
  | ReportLastTrackPayload
  | ResetProofsPayload
  | SetNeedTrackTokenDismissPayload
  | SetOnFollowPayload
  | SetOnRefollowPayload
  | SetOnUnfollowPayload
  | SetProofsPayload
  | SetRegisterIdentifyUiPayload
  | SetUpdateTrackersPayload
  | SetupTrackerHandlersPayload
  | ShowNonUserPayload
  | ShowTrackerPayload
  | UnfollowPayload
  | UpdateBTCPayload
  | UpdateEldestKidChangedPayload
  | UpdateFoldersPayload
  | UpdatePGPKeyPayload
  | UpdateProofPayload
  | UpdateProofStatePayload
  | UpdateReasonPayload
  | UpdateSelectedTeamPayload
  | UpdateTrackTokenPayload
  | UpdateTrackersPayload
  | UpdateUserInfoPayload
  | UpdateUsernamePayload
  | UpdateZcashPayload
  | WaitingPayload
  | {type: 'common:resetStore', payload: void}
