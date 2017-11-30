// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier */

import * as I from 'immutable'
import * as RPCTypes from '../constants/types/flow-types'
import * as More from '../constants/types/more'
import * as FolderConstants from '../constants/folders'

// Constants
export const resetStore = 'common:resetStore' // not a part of tracker but is handled by every reducer
export const cacheIdentify = 'tracker:cacheIdentify'
export const identifyFinished = 'tracker:identifyFinished'
export const identifyStarted = 'tracker:identifyStarted'
export const markActiveIdentifyUi = 'tracker:markActiveIdentifyUi'
export const onClose = 'tracker:onClose'
export const onError = 'tracker:onError'
export const parseFriendship = 'tracker:parseFriendship'
export const pendingIdentify = 'tracker:pendingIdentify'
export const remoteDismiss = 'tracker:remoteDismiss'
export const reportLastTrack = 'tracker:reportLastTrack'
export const resetProofs = 'tracker:resetProofs'
export const setNeedTrackTokenDismiss = 'tracker:setNeedTrackTokenDismiss'
export const setOnFollow = 'tracker:setOnFollow'
export const setOnRefollow = 'tracker:setOnRefollow'
export const setOnUnfollow = 'tracker:setOnUnfollow'
export const setProofs = 'tracker:setProofs'
export const setRegisterIdentifyUi = 'tracker:setRegisterIdentifyUi'
export const setStartTimer = 'tracker:setStartTimer'
export const setUpdateTrackers = 'tracker:setUpdateTrackers'
export const showNonUser = 'tracker:showNonUser'
export const showTracker = 'tracker:showTracker'
export const stopTimer = 'tracker:stopTimer'
export const updateBTC = 'tracker:updateBTC'
export const updateEldestKidChanged = 'tracker:updateEldestKidChanged'
export const updateFolders = 'tracker:updateFolders'
export const updatePGPKey = 'tracker:updatePGPKey'
export const updateProof = 'tracker:updateProof'
export const updateProofState = 'tracker:updateProofState'
export const updateReason = 'tracker:updateReason'
export const updateTrackToken = 'tracker:updateTrackToken'
export const updateUserInfo = 'tracker:updateUserInfo'
export const updateUsername = 'tracker:updateUsername'
export const updateZcash = 'tracker:updateZcash'
export const waiting = 'tracker:waiting'

// Action Creators
export const createCacheIdentify = (payload: {|+uid: string, +goodTill: number|}) => ({error: false, payload, type: cacheIdentify})
export const createIdentifyFinished = (payload: {|+username: string|}) => ({error: false, payload, type: identifyFinished})
export const createIdentifyFinishedError = (payload: {|+username: string, +error: string|}) => ({error: true, payload, type: identifyFinished})
export const createIdentifyStarted = (payload: {|+username: string|}) => ({error: false, payload, type: identifyStarted})
export const createMarkActiveIdentifyUi = (payload: {|+username: string, +active: boolean|}) => ({error: false, payload, type: markActiveIdentifyUi})
export const createOnClose = (payload: {|+username: string|}) => ({error: false, payload, type: onClose})
export const createOnError = (payload: {|+username: string, +extraText: string|}) => ({error: false, payload, type: onError})
export const createParseFriendship = (payload: {|+username: string, +uid: string, +fullname: string, +followsYou: string, +following: string|}) => ({error: false, payload, type: parseFriendship})
export const createPendingIdentify = (payload: {|+username: string, +pending: boolean|}) => ({error: false, payload, type: pendingIdentify})
export const createRemoteDismiss = (payload: {|+username: string|}) => ({error: false, payload, type: remoteDismiss})
export const createReportLastTrack = (payload: {|+username: string, +tracking?: boolean|}) => ({error: false, payload, type: reportLastTrack})
export const createResetProofs = (payload: {|+username: string|}) => ({error: false, payload, type: resetProofs})
export const createSetNeedTrackTokenDismiss = (payload: {|+username: string, +needTrackTokenDismiss: boolean|}) => ({error: false, payload, type: setNeedTrackTokenDismiss})
export const createSetOnFollow = (payload: {|+username: string|}) => ({error: false, payload, type: setOnFollow})
export const createSetOnRefollow = (payload: {|+username: string|}) => ({error: false, payload, type: setOnRefollow})
export const createSetOnUnfollow = (payload: {|+username: string|}) => ({error: false, payload, type: setOnUnfollow})
export const createSetProofs = (payload: {|+username: string, +identity: RPCTypes.Identity|}) => ({error: false, payload, type: setProofs})
export const createSetRegisterIdentifyUi = (payload: {|+started: boolean|}) => ({error: false, payload, type: setRegisterIdentifyUi})
export const createSetStartTimer = () => ({error: false, payload: undefined, type: setStartTimer})
export const createSetUpdateTrackers = (payload: {|+username: string, +trackers: Array<{|username: string, uid: string, fullname: string, followsYou: boolean, following: boolean|}>, +tracking: Array<{|username: string, uid: string, fullname: string, followsYou: boolean, following: boolean|}>|}) => ({error: false, payload, type: setUpdateTrackers})
export const createShowNonUser = (payload: {|+username: string, +nonUser: RPCTypes.IdentifyUiDisplayTLFCreateWithInviteRpcParam|}) => ({error: false, payload, type: showNonUser})
export const createShowTracker = (payload: {|+username: string|}) => ({error: false, payload, type: showTracker})
export const createStopTimer = () => ({error: false, payload: undefined, type: stopTimer})
export const createUpdateBTC = (payload: {|+username: string, +address: string, +sigID: string|}) => ({error: false, payload, type: updateBTC})
export const createUpdateEldestKidChanged = (payload: {|+username: string|}) => ({error: false, payload, type: updateEldestKidChanged})
export const createUpdateFolders = (payload: {|+username: string, +tlfs: Array<FolderConstants.Folder>|}) => ({error: false, payload, type: updateFolders})
export const createUpdatePGPKey = (payload: {|+username: string, +pgpFingerprint: Buffer, +kid: string|}) => ({error: false, payload, type: updatePGPKey})
export const createUpdateProof = (payload: {|+remoteProof: RPCTypes.RemoteProof, +linkCheckResult: RPCTypes.LinkCheckResult, +username: string|}) => ({error: false, payload, type: updateProof})
export const createUpdateProofState = (payload: {|+username: string|}) => ({error: false, payload, type: updateProofState})
export const createUpdateReason = (payload: {|+username: string, +reason: ?string|}) => ({error: false, payload, type: updateReason})
export const createUpdateTrackToken = (payload: {|+username: string, +trackToken: RPCTypes.TrackToken|}) => ({error: false, payload, type: updateTrackToken})
export const createUpdateUserInfo = (payload: {|+userCard: RPCTypes.UserCard, +username: string|}) => ({error: false, payload, type: updateUserInfo})
export const createUpdateUsername = (payload: {|+username: string|}) => ({error: false, payload, type: updateUsername})
export const createUpdateZcash = (payload: {|+username: string, +address: string, +sigID: string|}) => ({error: false, payload, type: updateZcash})
export const createWaiting = (payload: {|+username: string, +waiting: boolean|}) => ({error: false, payload, type: waiting})

// Action Payloads
export type CacheIdentifyPayload = More.ReturnType<typeof createCacheIdentify>
export type IdentifyFinishedPayload = More.ReturnType<typeof createIdentifyFinished>
export type IdentifyStartedPayload = More.ReturnType<typeof createIdentifyStarted>
export type MarkActiveIdentifyUiPayload = More.ReturnType<typeof createMarkActiveIdentifyUi>
export type OnClosePayload = More.ReturnType<typeof createOnClose>
export type OnErrorPayload = More.ReturnType<typeof createOnError>
export type ParseFriendshipPayload = More.ReturnType<typeof createParseFriendship>
export type PendingIdentifyPayload = More.ReturnType<typeof createPendingIdentify>
export type RemoteDismissPayload = More.ReturnType<typeof createRemoteDismiss>
export type ReportLastTrackPayload = More.ReturnType<typeof createReportLastTrack>
export type ResetProofsPayload = More.ReturnType<typeof createResetProofs>
export type SetNeedTrackTokenDismissPayload = More.ReturnType<typeof createSetNeedTrackTokenDismiss>
export type SetOnFollowPayload = More.ReturnType<typeof createSetOnFollow>
export type SetOnRefollowPayload = More.ReturnType<typeof createSetOnRefollow>
export type SetOnUnfollowPayload = More.ReturnType<typeof createSetOnUnfollow>
export type SetProofsPayload = More.ReturnType<typeof createSetProofs>
export type SetRegisterIdentifyUiPayload = More.ReturnType<typeof createSetRegisterIdentifyUi>
export type SetStartTimerPayload = More.ReturnType<typeof createSetStartTimer>
export type SetUpdateTrackersPayload = More.ReturnType<typeof createSetUpdateTrackers>
export type ShowNonUserPayload = More.ReturnType<typeof createShowNonUser>
export type ShowTrackerPayload = More.ReturnType<typeof createShowTracker>
export type StopTimerPayload = More.ReturnType<typeof createStopTimer>
export type UpdateBTCPayload = More.ReturnType<typeof createUpdateBTC>
export type UpdateEldestKidChangedPayload = More.ReturnType<typeof createUpdateEldestKidChanged>
export type UpdateFoldersPayload = More.ReturnType<typeof createUpdateFolders>
export type UpdatePGPKeyPayload = More.ReturnType<typeof createUpdatePGPKey>
export type UpdateProofPayload = More.ReturnType<typeof createUpdateProof>
export type UpdateProofStatePayload = More.ReturnType<typeof createUpdateProofState>
export type UpdateReasonPayload = More.ReturnType<typeof createUpdateReason>
export type UpdateTrackTokenPayload = More.ReturnType<typeof createUpdateTrackToken>
export type UpdateUserInfoPayload = More.ReturnType<typeof createUpdateUserInfo>
export type UpdateUsernamePayload = More.ReturnType<typeof createUpdateUsername>
export type UpdateZcashPayload = More.ReturnType<typeof createUpdateZcash>
export type WaitingPayload = More.ReturnType<typeof createWaiting>

// All Actions
// prettier-ignore
export type Actions =
  | More.ReturnType<typeof createCacheIdentify>
  | More.ReturnType<typeof createIdentifyFinished>
  | More.ReturnType<typeof createIdentifyFinishedError>
  | More.ReturnType<typeof createIdentifyStarted>
  | More.ReturnType<typeof createMarkActiveIdentifyUi>
  | More.ReturnType<typeof createOnClose>
  | More.ReturnType<typeof createOnError>
  | More.ReturnType<typeof createParseFriendship>
  | More.ReturnType<typeof createPendingIdentify>
  | More.ReturnType<typeof createRemoteDismiss>
  | More.ReturnType<typeof createReportLastTrack>
  | More.ReturnType<typeof createResetProofs>
  | More.ReturnType<typeof createSetNeedTrackTokenDismiss>
  | More.ReturnType<typeof createSetOnFollow>
  | More.ReturnType<typeof createSetOnRefollow>
  | More.ReturnType<typeof createSetOnUnfollow>
  | More.ReturnType<typeof createSetProofs>
  | More.ReturnType<typeof createSetRegisterIdentifyUi>
  | More.ReturnType<typeof createSetStartTimer>
  | More.ReturnType<typeof createSetUpdateTrackers>
  | More.ReturnType<typeof createShowNonUser>
  | More.ReturnType<typeof createShowTracker>
  | More.ReturnType<typeof createStopTimer>
  | More.ReturnType<typeof createUpdateBTC>
  | More.ReturnType<typeof createUpdateEldestKidChanged>
  | More.ReturnType<typeof createUpdateFolders>
  | More.ReturnType<typeof createUpdatePGPKey>
  | More.ReturnType<typeof createUpdateProof>
  | More.ReturnType<typeof createUpdateProofState>
  | More.ReturnType<typeof createUpdateReason>
  | More.ReturnType<typeof createUpdateTrackToken>
  | More.ReturnType<typeof createUpdateUserInfo>
  | More.ReturnType<typeof createUpdateUsername>
  | More.ReturnType<typeof createUpdateZcash>
  | More.ReturnType<typeof createWaiting>
  | {type: 'common:resetStore', payload: void}
