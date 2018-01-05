// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier */

import * as I from 'immutable'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as More from '../constants/types/more'
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

// Action Creators
export const createCacheIdentify = (
  payload: $ReadOnly<{
    uid: string,
    goodTill: number,
  }>
) => ({error: false, payload, type: cacheIdentify})
export const createFollow = (
  payload: $ReadOnly<{
    username: string,
    localIgnore?: boolean,
  }>
) => ({error: false, payload, type: follow})
export const createGetMyProfile = (payload: $ReadOnly<{ignoreCache?: boolean}>) => ({error: false, payload, type: getMyProfile})
export const createGetProfile = (
  payload: $ReadOnly<{
    username: string,
    ignoreCache?: boolean,
    forceDisplay?: boolean,
  }>
) => ({error: false, payload, type: getProfile})
export const createIdentifyFinished = (payload: $ReadOnly<{username: string}>) => ({error: false, payload, type: identifyFinished})
export const createIdentifyFinishedError = (
  payload: $ReadOnly<{
    username: string,
    error: string,
  }>
) => ({error: true, payload, type: identifyFinished})
export const createIdentifyStarted = (payload: $ReadOnly<{username: string}>) => ({error: false, payload, type: identifyStarted})
export const createIgnore = (payload: $ReadOnly<{username: string}>) => ({error: false, payload, type: ignore})
export const createMarkActiveIdentifyUi = (
  payload: $ReadOnly<{
    username: string,
    active: boolean,
  }>
) => ({error: false, payload, type: markActiveIdentifyUi})
export const createOnClose = (payload: $ReadOnly<{username: string}>) => ({error: false, payload, type: onClose})
export const createOnError = (
  payload: $ReadOnly<{
    username: string,
    extraText: string,
  }>
) => ({error: false, payload, type: onError})
export const createOpenProofUrl = (payload: $ReadOnly<{proof: Types.Proof}>) => ({error: false, payload, type: openProofUrl})
export const createParseFriendship = (
  payload: $ReadOnly<{
    username: string,
    uid: string,
    fullname: string,
    followsYou: string,
    following: string,
  }>
) => ({error: false, payload, type: parseFriendship})
export const createPendingIdentify = (
  payload: $ReadOnly<{
    username: string,
    pending: boolean,
  }>
) => ({error: false, payload, type: pendingIdentify})
export const createRefollow = (payload: $ReadOnly<{username: string}>) => ({error: false, payload, type: refollow})
export const createRemoteDismiss = (payload: $ReadOnly<{username: string}>) => ({error: false, payload, type: remoteDismiss})
export const createReportLastTrack = (
  payload: $ReadOnly<{
    username: string,
    tracking?: boolean,
  }>
) => ({error: false, payload, type: reportLastTrack})
export const createResetProofs = (payload: $ReadOnly<{username: string}>) => ({error: false, payload, type: resetProofs})
export const createSetNeedTrackTokenDismiss = (
  payload: $ReadOnly<{
    username: string,
    needTrackTokenDismiss: boolean,
  }>
) => ({error: false, payload, type: setNeedTrackTokenDismiss})
export const createSetOnFollow = (payload: $ReadOnly<{username: string}>) => ({error: false, payload, type: setOnFollow})
export const createSetOnRefollow = (payload: $ReadOnly<{username: string}>) => ({error: false, payload, type: setOnRefollow})
export const createSetOnUnfollow = (payload: $ReadOnly<{username: string}>) => ({error: false, payload, type: setOnUnfollow})
export const createSetProofs = (
  payload: $ReadOnly<{
    username: string,
    identity: RPCTypes.Identity,
  }>
) => ({error: false, payload, type: setProofs})
export const createSetRegisterIdentifyUi = (payload: $ReadOnly<{started: boolean}>) => ({error: false, payload, type: setRegisterIdentifyUi})
export const createSetUpdateTrackers = (
  payload: $ReadOnly<{
    username: string,
    trackers: Array<{|username: string, uid: string, fullname: string, followsYou: boolean, following: boolean|}>,
    tracking: Array<{|username: string, uid: string, fullname: string, followsYou: boolean, following: boolean|}>,
  }>
) => ({error: false, payload, type: setUpdateTrackers})
export const createSetupTrackerHandlers = () => ({error: false, payload: undefined, type: setupTrackerHandlers})
export const createShowNonUser = (
  payload: $ReadOnly<{
    username: string,
    nonUser: RPCTypes.IdentifyUiDisplayTLFCreateWithInviteRpcParam,
  }>
) => ({error: false, payload, type: showNonUser})
export const createShowTracker = (payload: $ReadOnly<{username: string}>) => ({error: false, payload, type: showTracker})
export const createUnfollow = (payload: $ReadOnly<{username: string}>) => ({error: false, payload, type: unfollow})
export const createUpdateBTC = (
  payload: $ReadOnly<{
    username: string,
    address: string,
    sigID: string,
  }>
) => ({error: false, payload, type: updateBTC})
export const createUpdateEldestKidChanged = (payload: $ReadOnly<{username: string}>) => ({error: false, payload, type: updateEldestKidChanged})
export const createUpdateFolders = (
  payload: $ReadOnly<{
    username: string,
    tlfs: Array<FolderTypes.Folder>,
  }>
) => ({error: false, payload, type: updateFolders})
export const createUpdatePGPKey = (
  payload: $ReadOnly<{
    username: string,
    pgpFingerprint: Buffer,
    kid: string,
  }>
) => ({error: false, payload, type: updatePGPKey})
export const createUpdateProof = (
  payload: $ReadOnly<{
    remoteProof: RPCTypes.RemoteProof,
    linkCheckResult: RPCTypes.LinkCheckResult,
    username: string,
  }>
) => ({error: false, payload, type: updateProof})
export const createUpdateProofState = (payload: $ReadOnly<{username: string}>) => ({error: false, payload, type: updateProofState})
export const createUpdateReason = (
  payload: $ReadOnly<{
    username: string,
    reason: ?string,
  }>
) => ({error: false, payload, type: updateReason})
export const createUpdateSelectedTeam = (
  payload: $ReadOnly<{
    selectedTeam: string,
    username: string,
  }>
) => ({error: false, payload, type: updateSelectedTeam})
export const createUpdateTrackToken = (
  payload: $ReadOnly<{
    username: string,
    trackToken: RPCTypes.TrackToken,
  }>
) => ({error: false, payload, type: updateTrackToken})
export const createUpdateTrackers = (payload: $ReadOnly<{username: string}>) => ({error: false, payload, type: updateTrackers})
export const createUpdateUserInfo = (
  payload: $ReadOnly<{
    userCard: RPCTypes.UserCard,
    username: string,
  }>
) => ({error: false, payload, type: updateUserInfo})
export const createUpdateUsername = (payload: $ReadOnly<{username: string}>) => ({error: false, payload, type: updateUsername})
export const createUpdateZcash = (
  payload: $ReadOnly<{
    username: string,
    address: string,
    sigID: string,
  }>
) => ({error: false, payload, type: updateZcash})
export const createWaiting = (
  payload: $ReadOnly<{
    username: string,
    waiting: boolean,
  }>
) => ({error: false, payload, type: waiting})

// Action Payloads
export type CacheIdentifyPayload = More.ReturnType<typeof createCacheIdentify>
export type FollowPayload = More.ReturnType<typeof createFollow>
export type GetMyProfilePayload = More.ReturnType<typeof createGetMyProfile>
export type GetProfilePayload = More.ReturnType<typeof createGetProfile>
export type IdentifyFinishedPayload = More.ReturnType<typeof createIdentifyFinished>
export type IdentifyStartedPayload = More.ReturnType<typeof createIdentifyStarted>
export type IgnorePayload = More.ReturnType<typeof createIgnore>
export type MarkActiveIdentifyUiPayload = More.ReturnType<typeof createMarkActiveIdentifyUi>
export type OnClosePayload = More.ReturnType<typeof createOnClose>
export type OnErrorPayload = More.ReturnType<typeof createOnError>
export type OpenProofUrlPayload = More.ReturnType<typeof createOpenProofUrl>
export type ParseFriendshipPayload = More.ReturnType<typeof createParseFriendship>
export type PendingIdentifyPayload = More.ReturnType<typeof createPendingIdentify>
export type RefollowPayload = More.ReturnType<typeof createRefollow>
export type RemoteDismissPayload = More.ReturnType<typeof createRemoteDismiss>
export type ReportLastTrackPayload = More.ReturnType<typeof createReportLastTrack>
export type ResetProofsPayload = More.ReturnType<typeof createResetProofs>
export type SetNeedTrackTokenDismissPayload = More.ReturnType<typeof createSetNeedTrackTokenDismiss>
export type SetOnFollowPayload = More.ReturnType<typeof createSetOnFollow>
export type SetOnRefollowPayload = More.ReturnType<typeof createSetOnRefollow>
export type SetOnUnfollowPayload = More.ReturnType<typeof createSetOnUnfollow>
export type SetProofsPayload = More.ReturnType<typeof createSetProofs>
export type SetRegisterIdentifyUiPayload = More.ReturnType<typeof createSetRegisterIdentifyUi>
export type SetUpdateTrackersPayload = More.ReturnType<typeof createSetUpdateTrackers>
export type SetupTrackerHandlersPayload = More.ReturnType<typeof createSetupTrackerHandlers>
export type ShowNonUserPayload = More.ReturnType<typeof createShowNonUser>
export type ShowTrackerPayload = More.ReturnType<typeof createShowTracker>
export type UnfollowPayload = More.ReturnType<typeof createUnfollow>
export type UpdateBTCPayload = More.ReturnType<typeof createUpdateBTC>
export type UpdateEldestKidChangedPayload = More.ReturnType<typeof createUpdateEldestKidChanged>
export type UpdateFoldersPayload = More.ReturnType<typeof createUpdateFolders>
export type UpdatePGPKeyPayload = More.ReturnType<typeof createUpdatePGPKey>
export type UpdateProofPayload = More.ReturnType<typeof createUpdateProof>
export type UpdateProofStatePayload = More.ReturnType<typeof createUpdateProofState>
export type UpdateReasonPayload = More.ReturnType<typeof createUpdateReason>
export type UpdateSelectedTeamPayload = More.ReturnType<typeof createUpdateSelectedTeam>
export type UpdateTrackTokenPayload = More.ReturnType<typeof createUpdateTrackToken>
export type UpdateTrackersPayload = More.ReturnType<typeof createUpdateTrackers>
export type UpdateUserInfoPayload = More.ReturnType<typeof createUpdateUserInfo>
export type UpdateUsernamePayload = More.ReturnType<typeof createUpdateUsername>
export type UpdateZcashPayload = More.ReturnType<typeof createUpdateZcash>
export type WaitingPayload = More.ReturnType<typeof createWaiting>

// All Actions
// prettier-ignore
export type Actions =
  | More.ReturnType<typeof createCacheIdentify>
  | More.ReturnType<typeof createFollow>
  | More.ReturnType<typeof createGetMyProfile>
  | More.ReturnType<typeof createGetProfile>
  | More.ReturnType<typeof createIdentifyFinished>
  | More.ReturnType<typeof createIdentifyFinishedError>
  | More.ReturnType<typeof createIdentifyStarted>
  | More.ReturnType<typeof createIgnore>
  | More.ReturnType<typeof createMarkActiveIdentifyUi>
  | More.ReturnType<typeof createOnClose>
  | More.ReturnType<typeof createOnError>
  | More.ReturnType<typeof createOpenProofUrl>
  | More.ReturnType<typeof createParseFriendship>
  | More.ReturnType<typeof createPendingIdentify>
  | More.ReturnType<typeof createRefollow>
  | More.ReturnType<typeof createRemoteDismiss>
  | More.ReturnType<typeof createReportLastTrack>
  | More.ReturnType<typeof createResetProofs>
  | More.ReturnType<typeof createSetNeedTrackTokenDismiss>
  | More.ReturnType<typeof createSetOnFollow>
  | More.ReturnType<typeof createSetOnRefollow>
  | More.ReturnType<typeof createSetOnUnfollow>
  | More.ReturnType<typeof createSetProofs>
  | More.ReturnType<typeof createSetRegisterIdentifyUi>
  | More.ReturnType<typeof createSetUpdateTrackers>
  | More.ReturnType<typeof createSetupTrackerHandlers>
  | More.ReturnType<typeof createShowNonUser>
  | More.ReturnType<typeof createShowTracker>
  | More.ReturnType<typeof createUnfollow>
  | More.ReturnType<typeof createUpdateBTC>
  | More.ReturnType<typeof createUpdateEldestKidChanged>
  | More.ReturnType<typeof createUpdateFolders>
  | More.ReturnType<typeof createUpdatePGPKey>
  | More.ReturnType<typeof createUpdateProof>
  | More.ReturnType<typeof createUpdateProofState>
  | More.ReturnType<typeof createUpdateReason>
  | More.ReturnType<typeof createUpdateSelectedTeam>
  | More.ReturnType<typeof createUpdateTrackToken>
  | More.ReturnType<typeof createUpdateTrackers>
  | More.ReturnType<typeof createUpdateUserInfo>
  | More.ReturnType<typeof createUpdateUsername>
  | More.ReturnType<typeof createUpdateZcash>
  | More.ReturnType<typeof createWaiting>
  | {type: 'common:resetStore', payload: void}
