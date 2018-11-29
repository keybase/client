// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier,no-use-before-define */

import * as I from 'immutable'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Types from '../constants/types/profile'
import * as More from '../constants/types/more'

// Constants
export const resetStore = 'common:resetStore' // not a part of profile but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'profile:'
export const addProof = 'profile:addProof'
export const backToProfile = 'profile:backToProfile'
export const cancelAddProof = 'profile:cancelAddProof'
export const cancelPgpGen = 'profile:cancelPgpGen'
export const checkProof = 'profile:checkProof'
export const cleanupUsername = 'profile:cleanupUsername'
export const dropPgp = 'profile:dropPgp'
export const editProfile = 'profile:editProfile'
export const finishRevoking = 'profile:finishRevoking'
export const finishedWithKeyGen = 'profile:finishedWithKeyGen'
export const generatePgp = 'profile:generatePgp'
export const onClickAvatar = 'profile:onClickAvatar'
export const onClickFollowers = 'profile:onClickFollowers'
export const onClickFollowing = 'profile:onClickFollowing'
export const outputInstructionsActionLink = 'profile:outputInstructionsActionLink'
export const revokeFinish = 'profile:revokeFinish'
export const revokeWaiting = 'profile:revokeWaiting'
export const showUserProfile = 'profile:showUserProfile'
export const submitBTCAddress = 'profile:submitBTCAddress'
export const submitRevokeProof = 'profile:submitRevokeProof'
export const submitUsername = 'profile:submitUsername'
export const submitZcashAddress = 'profile:submitZcashAddress'
export const updateErrorText = 'profile:updateErrorText'
export const updatePgpInfo = 'profile:updatePgpInfo'
export const updatePgpPublicKey = 'profile:updatePgpPublicKey'
export const updatePlatform = 'profile:updatePlatform'
export const updateProofStatus = 'profile:updateProofStatus'
export const updateProofText = 'profile:updateProofText'
export const updateSigID = 'profile:updateSigID'
export const updateUsername = 'profile:updateUsername'
export const uploadAvatar = 'profile:uploadAvatar'
export const waiting = 'profile:waiting'

// Payload Types
type _AddProofPayload = $ReadOnly<{|platform: More.PlatformsExpandedType|}>
type _BackToProfilePayload = void
type _CancelAddProofPayload = void
type _CancelPgpGenPayload = void
type _CheckProofPayload = void
type _CleanupUsernamePayload = void
type _DropPgpPayload = $ReadOnly<{|kid: RPCTypes.KID|}>
type _EditProfilePayload = $ReadOnly<{|bio: string, fullname: string, location: string|}>
type _FinishRevokingPayload = void
type _FinishedWithKeyGenPayload = $ReadOnly<{|shouldStoreKeyOnServer: boolean|}>
type _GeneratePgpPayload = void
type _OnClickAvatarPayload = $ReadOnly<{|username: string, openWebsite?: ?boolean|}>
type _OnClickFollowersPayload = $ReadOnly<{|username: string, openWebsite?: ?boolean|}>
type _OnClickFollowingPayload = $ReadOnly<{|username: string, openWebsite?: ?boolean|}>
type _OutputInstructionsActionLinkPayload = void
type _RevokeFinishPayload = void
type _RevokeFinishPayloadError = $ReadOnly<{|error: string|}>
type _RevokeWaitingPayload = $ReadOnly<{|waiting: boolean|}>
type _ShowUserProfilePayload = $ReadOnly<{|username: string|}>
type _SubmitBTCAddressPayload = void
type _SubmitRevokeProofPayload = $ReadOnly<{|proofId: string|}>
type _SubmitUsernamePayload = void
type _SubmitZcashAddressPayload = void
type _UpdateErrorTextPayload = $ReadOnly<{|errorText?: ?string, errorCode?: ?number|}>
type _UpdatePgpInfoPayload = $ReadOnly<{|info: $Shape<Types.PgpInfo>|}>
type _UpdatePgpInfoPayloadError = $ReadOnly<{|error: Types.PgpInfoError|}>
type _UpdatePgpPublicKeyPayload = $ReadOnly<{|publicKey: string|}>
type _UpdatePlatformPayload = $ReadOnly<{|platform: More.PlatformsExpandedType|}>
type _UpdateProofStatusPayload = $ReadOnly<{|found: boolean, status: RPCTypes.ProofStatus|}>
type _UpdateProofTextPayload = $ReadOnly<{|proof: string|}>
type _UpdateSigIDPayload = $ReadOnly<{|sigID: ?RPCTypes.SigID|}>
type _UpdateUsernamePayload = $ReadOnly<{|username: string|}>
type _UploadAvatarPayload = $ReadOnly<{|filename: string, crop?: RPCTypes.ImageCropRect|}>
type _WaitingPayload = $ReadOnly<{|waiting: boolean|}>

// Action Creators
export const createAddProof = (payload: _AddProofPayload) => ({payload, type: addProof})
export const createBackToProfile = (payload: _BackToProfilePayload) => ({payload, type: backToProfile})
export const createCancelAddProof = (payload: _CancelAddProofPayload) => ({payload, type: cancelAddProof})
export const createCancelPgpGen = (payload: _CancelPgpGenPayload) => ({payload, type: cancelPgpGen})
export const createCheckProof = (payload: _CheckProofPayload) => ({payload, type: checkProof})
export const createCleanupUsername = (payload: _CleanupUsernamePayload) => ({payload, type: cleanupUsername})
export const createDropPgp = (payload: _DropPgpPayload) => ({payload, type: dropPgp})
export const createEditProfile = (payload: _EditProfilePayload) => ({payload, type: editProfile})
export const createFinishRevoking = (payload: _FinishRevokingPayload) => ({payload, type: finishRevoking})
export const createFinishedWithKeyGen = (payload: _FinishedWithKeyGenPayload) => ({payload, type: finishedWithKeyGen})
export const createGeneratePgp = (payload: _GeneratePgpPayload) => ({payload, type: generatePgp})
export const createOnClickAvatar = (payload: _OnClickAvatarPayload) => ({payload, type: onClickAvatar})
export const createOnClickFollowers = (payload: _OnClickFollowersPayload) => ({payload, type: onClickFollowers})
export const createOnClickFollowing = (payload: _OnClickFollowingPayload) => ({payload, type: onClickFollowing})
export const createOutputInstructionsActionLink = (payload: _OutputInstructionsActionLinkPayload) => ({payload, type: outputInstructionsActionLink})
export const createRevokeFinish = (payload: _RevokeFinishPayload) => ({payload, type: revokeFinish})
export const createRevokeFinishError = (payload: _RevokeFinishPayloadError) => ({error: true, payload, type: revokeFinish})
export const createRevokeWaiting = (payload: _RevokeWaitingPayload) => ({payload, type: revokeWaiting})
export const createShowUserProfile = (payload: _ShowUserProfilePayload) => ({payload, type: showUserProfile})
export const createSubmitBTCAddress = (payload: _SubmitBTCAddressPayload) => ({payload, type: submitBTCAddress})
export const createSubmitRevokeProof = (payload: _SubmitRevokeProofPayload) => ({payload, type: submitRevokeProof})
export const createSubmitUsername = (payload: _SubmitUsernamePayload) => ({payload, type: submitUsername})
export const createSubmitZcashAddress = (payload: _SubmitZcashAddressPayload) => ({payload, type: submitZcashAddress})
export const createUpdateErrorText = (payload: _UpdateErrorTextPayload) => ({payload, type: updateErrorText})
export const createUpdatePgpInfo = (payload: _UpdatePgpInfoPayload) => ({payload, type: updatePgpInfo})
export const createUpdatePgpInfoError = (payload: _UpdatePgpInfoPayloadError) => ({error: true, payload, type: updatePgpInfo})
export const createUpdatePgpPublicKey = (payload: _UpdatePgpPublicKeyPayload) => ({payload, type: updatePgpPublicKey})
export const createUpdatePlatform = (payload: _UpdatePlatformPayload) => ({payload, type: updatePlatform})
export const createUpdateProofStatus = (payload: _UpdateProofStatusPayload) => ({payload, type: updateProofStatus})
export const createUpdateProofText = (payload: _UpdateProofTextPayload) => ({payload, type: updateProofText})
export const createUpdateSigID = (payload: _UpdateSigIDPayload) => ({payload, type: updateSigID})
export const createUpdateUsername = (payload: _UpdateUsernamePayload) => ({payload, type: updateUsername})
export const createUploadAvatar = (payload: _UploadAvatarPayload) => ({payload, type: uploadAvatar})
export const createWaiting = (payload: _WaitingPayload) => ({payload, type: waiting})

// Action Payloads
export type AddProofPayload = $Call<typeof createAddProof, _AddProofPayload>
export type BackToProfilePayload = $Call<typeof createBackToProfile, _BackToProfilePayload>
export type CancelAddProofPayload = $Call<typeof createCancelAddProof, _CancelAddProofPayload>
export type CancelPgpGenPayload = $Call<typeof createCancelPgpGen, _CancelPgpGenPayload>
export type CheckProofPayload = $Call<typeof createCheckProof, _CheckProofPayload>
export type CleanupUsernamePayload = $Call<typeof createCleanupUsername, _CleanupUsernamePayload>
export type DropPgpPayload = $Call<typeof createDropPgp, _DropPgpPayload>
export type EditProfilePayload = $Call<typeof createEditProfile, _EditProfilePayload>
export type FinishRevokingPayload = $Call<typeof createFinishRevoking, _FinishRevokingPayload>
export type FinishedWithKeyGenPayload = $Call<typeof createFinishedWithKeyGen, _FinishedWithKeyGenPayload>
export type GeneratePgpPayload = $Call<typeof createGeneratePgp, _GeneratePgpPayload>
export type OnClickAvatarPayload = $Call<typeof createOnClickAvatar, _OnClickAvatarPayload>
export type OnClickFollowersPayload = $Call<typeof createOnClickFollowers, _OnClickFollowersPayload>
export type OnClickFollowingPayload = $Call<typeof createOnClickFollowing, _OnClickFollowingPayload>
export type OutputInstructionsActionLinkPayload = $Call<typeof createOutputInstructionsActionLink, _OutputInstructionsActionLinkPayload>
export type RevokeFinishPayload = $Call<typeof createRevokeFinish, _RevokeFinishPayload>
export type RevokeFinishPayloadError = $Call<typeof createRevokeFinishError, _RevokeFinishPayloadError>
export type RevokeWaitingPayload = $Call<typeof createRevokeWaiting, _RevokeWaitingPayload>
export type ShowUserProfilePayload = $Call<typeof createShowUserProfile, _ShowUserProfilePayload>
export type SubmitBTCAddressPayload = $Call<typeof createSubmitBTCAddress, _SubmitBTCAddressPayload>
export type SubmitRevokeProofPayload = $Call<typeof createSubmitRevokeProof, _SubmitRevokeProofPayload>
export type SubmitUsernamePayload = $Call<typeof createSubmitUsername, _SubmitUsernamePayload>
export type SubmitZcashAddressPayload = $Call<typeof createSubmitZcashAddress, _SubmitZcashAddressPayload>
export type UpdateErrorTextPayload = $Call<typeof createUpdateErrorText, _UpdateErrorTextPayload>
export type UpdatePgpInfoPayload = $Call<typeof createUpdatePgpInfo, _UpdatePgpInfoPayload>
export type UpdatePgpInfoPayloadError = $Call<typeof createUpdatePgpInfoError, _UpdatePgpInfoPayloadError>
export type UpdatePgpPublicKeyPayload = $Call<typeof createUpdatePgpPublicKey, _UpdatePgpPublicKeyPayload>
export type UpdatePlatformPayload = $Call<typeof createUpdatePlatform, _UpdatePlatformPayload>
export type UpdateProofStatusPayload = $Call<typeof createUpdateProofStatus, _UpdateProofStatusPayload>
export type UpdateProofTextPayload = $Call<typeof createUpdateProofText, _UpdateProofTextPayload>
export type UpdateSigIDPayload = $Call<typeof createUpdateSigID, _UpdateSigIDPayload>
export type UpdateUsernamePayload = $Call<typeof createUpdateUsername, _UpdateUsernamePayload>
export type UploadAvatarPayload = $Call<typeof createUploadAvatar, _UploadAvatarPayload>
export type WaitingPayload = $Call<typeof createWaiting, _WaitingPayload>

// All Actions
// prettier-ignore
export type Actions =
  | AddProofPayload
  | BackToProfilePayload
  | CancelAddProofPayload
  | CancelPgpGenPayload
  | CheckProofPayload
  | CleanupUsernamePayload
  | DropPgpPayload
  | EditProfilePayload
  | FinishRevokingPayload
  | FinishedWithKeyGenPayload
  | GeneratePgpPayload
  | OnClickAvatarPayload
  | OnClickFollowersPayload
  | OnClickFollowingPayload
  | OutputInstructionsActionLinkPayload
  | RevokeFinishPayload
  | RevokeFinishPayloadError
  | RevokeWaitingPayload
  | ShowUserProfilePayload
  | SubmitBTCAddressPayload
  | SubmitRevokeProofPayload
  | SubmitUsernamePayload
  | SubmitZcashAddressPayload
  | UpdateErrorTextPayload
  | UpdatePgpInfoPayload
  | UpdatePgpInfoPayloadError
  | UpdatePgpPublicKeyPayload
  | UpdatePlatformPayload
  | UpdateProofStatusPayload
  | UpdateProofTextPayload
  | UpdateSigIDPayload
  | UpdateUsernamePayload
  | UploadAvatarPayload
  | WaitingPayload
  | {type: 'common:resetStore', payload: void}
