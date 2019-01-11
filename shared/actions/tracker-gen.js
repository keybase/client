// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier,no-use-before-define,import/no-duplicates */

import * as I from 'immutable'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Types from '../constants/types/tracker'
import * as FolderTypes from '../constants/types/folders'

// Constants
export const resetStore = 'common:resetStore' // not a part of tracker but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'tracker:'
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
export const updateStellarAddress = 'tracker:updateStellarAddress'
export const updateTrackToken = 'tracker:updateTrackToken'
export const updateTrackers = 'tracker:updateTrackers'
export const updateUserInfo = 'tracker:updateUserInfo'
export const updateUsername = 'tracker:updateUsername'
export const updateZcash = 'tracker:updateZcash'
export const waiting = 'tracker:waiting'

// Payload Types
type _CacheIdentifyPayload = $ReadOnly<{|uid: string, goodTill: number|}>
type _FollowPayload = $ReadOnly<{|username: string, localIgnore?: boolean|}>
type _GetMyProfilePayload = $ReadOnly<{|ignoreCache?: boolean|}>
type _GetProfilePayload = $ReadOnly<{|username: string, ignoreCache?: boolean, forceDisplay?: boolean|}>
type _IdentifyFinishedPayload = $ReadOnly<{|username: string|}>
type _IdentifyFinishedPayloadError = $ReadOnly<{|username: string, error: string|}>
type _IdentifyStartedPayload = $ReadOnly<{|username: string|}>
type _IgnorePayload = $ReadOnly<{|username: string|}>
type _MarkActiveIdentifyUiPayload = $ReadOnly<{|username: string, active: boolean|}>
type _OnClosePayload = $ReadOnly<{|username: string|}>
type _OnErrorPayload = $ReadOnly<{|username: string, extraText: string|}>
type _OpenProofUrlPayload = $ReadOnly<{|proof: Types.Proof|}>
type _ParseFriendshipPayload = $ReadOnly<{|username: string, uid: string, fullname: string, followsYou: string, following: string|}>
type _PendingIdentifyPayload = $ReadOnly<{|username: string, pending: boolean|}>
type _RefollowPayload = $ReadOnly<{|username: string|}>
type _RemoteDismissPayload = $ReadOnly<{|username: string|}>
type _ReportLastTrackPayload = $ReadOnly<{|username: string, tracking?: boolean|}>
type _ResetProofsPayload = $ReadOnly<{|username: string|}>
type _SetNeedTrackTokenDismissPayload = $ReadOnly<{|username: string, needTrackTokenDismiss: boolean|}>
type _SetOnFollowPayload = $ReadOnly<{|username: string|}>
type _SetOnRefollowPayload = $ReadOnly<{|username: string|}>
type _SetOnUnfollowPayload = $ReadOnly<{|username: string|}>
type _SetProofsPayload = $ReadOnly<{|username: string, identity: RPCTypes.Identity|}>
type _SetRegisterIdentifyUiPayload = $ReadOnly<{|started: boolean|}>
type _SetUpdateTrackersPayload = $ReadOnly<{|username: string, trackers: Array<{|username: string, uid: string, fullname: string, followsYou: boolean, following: boolean|}>, tracking: Array<{|username: string, uid: string, fullname: string, followsYou: boolean, following: boolean|}>|}>
type _ShowNonUserPayload = $ReadOnly<{|username: string, nonUser: {throttled: boolean, inviteLink: string, isPrivate: boolean, assertion: string, folderName: string, service: string}|}>
type _ShowTrackerPayload = $ReadOnly<{|username: string|}>
type _UnfollowPayload = $ReadOnly<{|username: string|}>
type _UpdateBTCPayload = $ReadOnly<{|username: string, address: string, sigID: string|}>
type _UpdateEldestKidChangedPayload = $ReadOnly<{|username: string|}>
type _UpdateFoldersPayload = $ReadOnly<{|username: string, tlfs: Array<FolderTypes.Folder>|}>
type _UpdatePGPKeyPayload = $ReadOnly<{|username: string, pgpFingerprint: Buffer, kid: string|}>
type _UpdateProofPayload = $ReadOnly<{|remoteProof: RPCTypes.RemoteProof, linkCheckResult: RPCTypes.LinkCheckResult, username: string|}>
type _UpdateProofStatePayload = $ReadOnly<{|username: string|}>
type _UpdateReasonPayload = $ReadOnly<{|username: string, reason: ?string|}>
type _UpdateSelectedTeamPayload = $ReadOnly<{|selectedTeam: string, username: string|}>
type _UpdateStellarAddressPayload = $ReadOnly<{|username: string, accountID: string, federationAddress: string, sigID: string|}>
type _UpdateTrackTokenPayload = $ReadOnly<{|username: string, trackToken: RPCTypes.TrackToken|}>
type _UpdateTrackersPayload = $ReadOnly<{|username: string|}>
type _UpdateUserInfoPayload = $ReadOnly<{|userCard: RPCTypes.UserCard, username: string|}>
type _UpdateUsernamePayload = $ReadOnly<{|username: string|}>
type _UpdateZcashPayload = $ReadOnly<{|username: string, address: string, sigID: string|}>
type _WaitingPayload = $ReadOnly<{|username: string, waiting: boolean|}>

// Action Creators
export const createCacheIdentify = (payload: _CacheIdentifyPayload) => ({payload, type: cacheIdentify})
export const createFollow = (payload: _FollowPayload) => ({payload, type: follow})
export const createGetMyProfile = (payload: _GetMyProfilePayload) => ({payload, type: getMyProfile})
export const createGetProfile = (payload: _GetProfilePayload) => ({payload, type: getProfile})
export const createIdentifyFinished = (payload: _IdentifyFinishedPayload) => ({payload, type: identifyFinished})
export const createIdentifyFinishedError = (payload: _IdentifyFinishedPayloadError) => ({error: true, payload, type: identifyFinished})
export const createIdentifyStarted = (payload: _IdentifyStartedPayload) => ({payload, type: identifyStarted})
export const createIgnore = (payload: _IgnorePayload) => ({payload, type: ignore})
export const createMarkActiveIdentifyUi = (payload: _MarkActiveIdentifyUiPayload) => ({payload, type: markActiveIdentifyUi})
export const createOnClose = (payload: _OnClosePayload) => ({payload, type: onClose})
export const createOnError = (payload: _OnErrorPayload) => ({payload, type: onError})
export const createOpenProofUrl = (payload: _OpenProofUrlPayload) => ({payload, type: openProofUrl})
export const createParseFriendship = (payload: _ParseFriendshipPayload) => ({payload, type: parseFriendship})
export const createPendingIdentify = (payload: _PendingIdentifyPayload) => ({payload, type: pendingIdentify})
export const createRefollow = (payload: _RefollowPayload) => ({payload, type: refollow})
export const createRemoteDismiss = (payload: _RemoteDismissPayload) => ({payload, type: remoteDismiss})
export const createReportLastTrack = (payload: _ReportLastTrackPayload) => ({payload, type: reportLastTrack})
export const createResetProofs = (payload: _ResetProofsPayload) => ({payload, type: resetProofs})
export const createSetNeedTrackTokenDismiss = (payload: _SetNeedTrackTokenDismissPayload) => ({payload, type: setNeedTrackTokenDismiss})
export const createSetOnFollow = (payload: _SetOnFollowPayload) => ({payload, type: setOnFollow})
export const createSetOnRefollow = (payload: _SetOnRefollowPayload) => ({payload, type: setOnRefollow})
export const createSetOnUnfollow = (payload: _SetOnUnfollowPayload) => ({payload, type: setOnUnfollow})
export const createSetProofs = (payload: _SetProofsPayload) => ({payload, type: setProofs})
export const createSetRegisterIdentifyUi = (payload: _SetRegisterIdentifyUiPayload) => ({payload, type: setRegisterIdentifyUi})
export const createSetUpdateTrackers = (payload: _SetUpdateTrackersPayload) => ({payload, type: setUpdateTrackers})
export const createShowNonUser = (payload: _ShowNonUserPayload) => ({payload, type: showNonUser})
export const createShowTracker = (payload: _ShowTrackerPayload) => ({payload, type: showTracker})
export const createUnfollow = (payload: _UnfollowPayload) => ({payload, type: unfollow})
export const createUpdateBTC = (payload: _UpdateBTCPayload) => ({payload, type: updateBTC})
export const createUpdateEldestKidChanged = (payload: _UpdateEldestKidChangedPayload) => ({payload, type: updateEldestKidChanged})
export const createUpdateFolders = (payload: _UpdateFoldersPayload) => ({payload, type: updateFolders})
export const createUpdatePGPKey = (payload: _UpdatePGPKeyPayload) => ({payload, type: updatePGPKey})
export const createUpdateProof = (payload: _UpdateProofPayload) => ({payload, type: updateProof})
export const createUpdateProofState = (payload: _UpdateProofStatePayload) => ({payload, type: updateProofState})
export const createUpdateReason = (payload: _UpdateReasonPayload) => ({payload, type: updateReason})
export const createUpdateSelectedTeam = (payload: _UpdateSelectedTeamPayload) => ({payload, type: updateSelectedTeam})
export const createUpdateStellarAddress = (payload: _UpdateStellarAddressPayload) => ({payload, type: updateStellarAddress})
export const createUpdateTrackToken = (payload: _UpdateTrackTokenPayload) => ({payload, type: updateTrackToken})
export const createUpdateTrackers = (payload: _UpdateTrackersPayload) => ({payload, type: updateTrackers})
export const createUpdateUserInfo = (payload: _UpdateUserInfoPayload) => ({payload, type: updateUserInfo})
export const createUpdateUsername = (payload: _UpdateUsernamePayload) => ({payload, type: updateUsername})
export const createUpdateZcash = (payload: _UpdateZcashPayload) => ({payload, type: updateZcash})
export const createWaiting = (payload: _WaitingPayload) => ({payload, type: waiting})

// Action Payloads
export type CacheIdentifyPayload = {|+payload: _CacheIdentifyPayload, +type: 'tracker:cacheIdentify'|}
export type FollowPayload = {|+payload: _FollowPayload, +type: 'tracker:follow'|}
export type GetMyProfilePayload = {|+payload: _GetMyProfilePayload, +type: 'tracker:getMyProfile'|}
export type GetProfilePayload = {|+payload: _GetProfilePayload, +type: 'tracker:getProfile'|}
export type IdentifyFinishedPayload = {|+payload: _IdentifyFinishedPayload, +type: 'tracker:identifyFinished'|}
export type IdentifyFinishedPayloadError = {|+error: true, +payload: _IdentifyFinishedPayloadError, +type: 'tracker:identifyFinished'|}
export type IdentifyStartedPayload = {|+payload: _IdentifyStartedPayload, +type: 'tracker:identifyStarted'|}
export type IgnorePayload = {|+payload: _IgnorePayload, +type: 'tracker:ignore'|}
export type MarkActiveIdentifyUiPayload = {|+payload: _MarkActiveIdentifyUiPayload, +type: 'tracker:markActiveIdentifyUi'|}
export type OnClosePayload = {|+payload: _OnClosePayload, +type: 'tracker:onClose'|}
export type OnErrorPayload = {|+payload: _OnErrorPayload, +type: 'tracker:onError'|}
export type OpenProofUrlPayload = {|+payload: _OpenProofUrlPayload, +type: 'tracker:openProofUrl'|}
export type ParseFriendshipPayload = {|+payload: _ParseFriendshipPayload, +type: 'tracker:parseFriendship'|}
export type PendingIdentifyPayload = {|+payload: _PendingIdentifyPayload, +type: 'tracker:pendingIdentify'|}
export type RefollowPayload = {|+payload: _RefollowPayload, +type: 'tracker:refollow'|}
export type RemoteDismissPayload = {|+payload: _RemoteDismissPayload, +type: 'tracker:remoteDismiss'|}
export type ReportLastTrackPayload = {|+payload: _ReportLastTrackPayload, +type: 'tracker:reportLastTrack'|}
export type ResetProofsPayload = {|+payload: _ResetProofsPayload, +type: 'tracker:resetProofs'|}
export type SetNeedTrackTokenDismissPayload = {|+payload: _SetNeedTrackTokenDismissPayload, +type: 'tracker:setNeedTrackTokenDismiss'|}
export type SetOnFollowPayload = {|+payload: _SetOnFollowPayload, +type: 'tracker:setOnFollow'|}
export type SetOnRefollowPayload = {|+payload: _SetOnRefollowPayload, +type: 'tracker:setOnRefollow'|}
export type SetOnUnfollowPayload = {|+payload: _SetOnUnfollowPayload, +type: 'tracker:setOnUnfollow'|}
export type SetProofsPayload = {|+payload: _SetProofsPayload, +type: 'tracker:setProofs'|}
export type SetRegisterIdentifyUiPayload = {|+payload: _SetRegisterIdentifyUiPayload, +type: 'tracker:setRegisterIdentifyUi'|}
export type SetUpdateTrackersPayload = {|+payload: _SetUpdateTrackersPayload, +type: 'tracker:setUpdateTrackers'|}
export type ShowNonUserPayload = {|+payload: _ShowNonUserPayload, +type: 'tracker:showNonUser'|}
export type ShowTrackerPayload = {|+payload: _ShowTrackerPayload, +type: 'tracker:showTracker'|}
export type UnfollowPayload = {|+payload: _UnfollowPayload, +type: 'tracker:unfollow'|}
export type UpdateBTCPayload = {|+payload: _UpdateBTCPayload, +type: 'tracker:updateBTC'|}
export type UpdateEldestKidChangedPayload = {|+payload: _UpdateEldestKidChangedPayload, +type: 'tracker:updateEldestKidChanged'|}
export type UpdateFoldersPayload = {|+payload: _UpdateFoldersPayload, +type: 'tracker:updateFolders'|}
export type UpdatePGPKeyPayload = {|+payload: _UpdatePGPKeyPayload, +type: 'tracker:updatePGPKey'|}
export type UpdateProofPayload = {|+payload: _UpdateProofPayload, +type: 'tracker:updateProof'|}
export type UpdateProofStatePayload = {|+payload: _UpdateProofStatePayload, +type: 'tracker:updateProofState'|}
export type UpdateReasonPayload = {|+payload: _UpdateReasonPayload, +type: 'tracker:updateReason'|}
export type UpdateSelectedTeamPayload = {|+payload: _UpdateSelectedTeamPayload, +type: 'tracker:updateSelectedTeam'|}
export type UpdateStellarAddressPayload = {|+payload: _UpdateStellarAddressPayload, +type: 'tracker:updateStellarAddress'|}
export type UpdateTrackTokenPayload = {|+payload: _UpdateTrackTokenPayload, +type: 'tracker:updateTrackToken'|}
export type UpdateTrackersPayload = {|+payload: _UpdateTrackersPayload, +type: 'tracker:updateTrackers'|}
export type UpdateUserInfoPayload = {|+payload: _UpdateUserInfoPayload, +type: 'tracker:updateUserInfo'|}
export type UpdateUsernamePayload = {|+payload: _UpdateUsernamePayload, +type: 'tracker:updateUsername'|}
export type UpdateZcashPayload = {|+payload: _UpdateZcashPayload, +type: 'tracker:updateZcash'|}
export type WaitingPayload = {|+payload: _WaitingPayload, +type: 'tracker:waiting'|}

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
  | UpdateStellarAddressPayload
  | UpdateTrackTokenPayload
  | UpdateTrackersPayload
  | UpdateUserInfoPayload
  | UpdateUsernamePayload
  | UpdateZcashPayload
  | WaitingPayload
  | {type: 'common:resetStore', payload: null}
