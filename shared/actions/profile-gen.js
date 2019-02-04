// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier,no-use-before-define,import/no-duplicates */

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
export const editAvatar = 'profile:editAvatar'
export const editProfile = 'profile:editProfile'
export const finishRevoking = 'profile:finishRevoking'
export const finishedWithKeyGen = 'profile:finishedWithKeyGen'
export const generatePgp = 'profile:generatePgp'
export const onClickAvatar = 'profile:onClickAvatar'
export const outputInstructionsActionLink = 'profile:outputInstructionsActionLink'
export const recheckProof = 'profile:recheckProof'
export const revokeFinish = 'profile:revokeFinish'
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

// Payload Types
type _AddProofPayload = $ReadOnly<{|platform: More.PlatformsExpandedType|}>
type _BackToProfilePayload = void
type _CancelAddProofPayload = void
type _CancelPgpGenPayload = void
type _CheckProofPayload = void
type _CleanupUsernamePayload = void
type _DropPgpPayload = $ReadOnly<{|kid: RPCTypes.KID|}>
type _EditAvatarPayload = void
type _EditProfilePayload = $ReadOnly<{|bio: string, fullname: string, location: string|}>
type _FinishRevokingPayload = void
type _FinishedWithKeyGenPayload = $ReadOnly<{|shouldStoreKeyOnServer: boolean|}>
type _GeneratePgpPayload = void
type _OnClickAvatarPayload = $ReadOnly<{|username: string, openWebsite?: ?boolean|}>
type _OutputInstructionsActionLinkPayload = void
type _RecheckProofPayload = $ReadOnly<{|sigID: string|}>
type _RevokeFinishPayload = void
type _RevokeFinishPayloadError = $ReadOnly<{|error: string|}>
type _ShowUserProfilePayload = $ReadOnly<{|username: string|}>
type _SubmitBTCAddressPayload = void
type _SubmitRevokeProofPayload = $ReadOnly<{|proofId: string|}>
type _SubmitUsernamePayload = void
type _SubmitZcashAddressPayload = void
type _UpdateErrorTextPayload = $ReadOnly<{|errorText: string, errorCode: ?number|}>
type _UpdatePgpInfoPayload = $ReadOnly<{|pgpEmail1?: string, pgpEmail2?: string, pgpEmail3?: string, pgpErrorText?: string, pgpFullName?: string|}>
type _UpdatePgpPublicKeyPayload = $ReadOnly<{|publicKey: string|}>
type _UpdatePlatformPayload = $ReadOnly<{|platform: More.PlatformsExpandedType|}>
type _UpdateProofStatusPayload = $ReadOnly<{|found: boolean, status: RPCTypes.ProofStatus|}>
type _UpdateProofTextPayload = $ReadOnly<{|proof: string|}>
type _UpdateSigIDPayload = $ReadOnly<{|sigID: ?RPCTypes.SigID|}>
type _UpdateUsernamePayload = $ReadOnly<{|username: string|}>
type _UploadAvatarPayload = $ReadOnly<{|filename: string, crop?: RPCTypes.ImageCropRect|}>

// Action Creators
/**
 * Update any fields
 */
export const createUpdatePgpInfo = (payload: _UpdatePgpInfoPayload) => ({payload, type: updatePgpInfo})
export const createAddProof = (payload: _AddProofPayload) => ({payload, type: addProof})
export const createBackToProfile = (payload: _BackToProfilePayload) => ({payload, type: backToProfile})
export const createCancelAddProof = (payload: _CancelAddProofPayload) => ({payload, type: cancelAddProof})
export const createCancelPgpGen = (payload: _CancelPgpGenPayload) => ({payload, type: cancelPgpGen})
export const createCheckProof = (payload: _CheckProofPayload) => ({payload, type: checkProof})
export const createCleanupUsername = (payload: _CleanupUsernamePayload) => ({payload, type: cleanupUsername})
export const createDropPgp = (payload: _DropPgpPayload) => ({payload, type: dropPgp})
export const createEditAvatar = (payload: _EditAvatarPayload) => ({payload, type: editAvatar})
export const createEditProfile = (payload: _EditProfilePayload) => ({payload, type: editProfile})
export const createFinishRevoking = (payload: _FinishRevokingPayload) => ({payload, type: finishRevoking})
export const createFinishedWithKeyGen = (payload: _FinishedWithKeyGenPayload) => ({payload, type: finishedWithKeyGen})
export const createGeneratePgp = (payload: _GeneratePgpPayload) => ({payload, type: generatePgp})
export const createOnClickAvatar = (payload: _OnClickAvatarPayload) => ({payload, type: onClickAvatar})
export const createOutputInstructionsActionLink = (payload: _OutputInstructionsActionLinkPayload) => ({payload, type: outputInstructionsActionLink})
export const createRecheckProof = (payload: _RecheckProofPayload) => ({payload, type: recheckProof})
export const createRevokeFinish = (payload: _RevokeFinishPayload) => ({payload, type: revokeFinish})
export const createRevokeFinishError = (payload: _RevokeFinishPayloadError) => ({error: true, payload, type: revokeFinish})
export const createShowUserProfile = (payload: _ShowUserProfilePayload) => ({payload, type: showUserProfile})
export const createSubmitBTCAddress = (payload: _SubmitBTCAddressPayload) => ({payload, type: submitBTCAddress})
export const createSubmitRevokeProof = (payload: _SubmitRevokeProofPayload) => ({payload, type: submitRevokeProof})
export const createSubmitUsername = (payload: _SubmitUsernamePayload) => ({payload, type: submitUsername})
export const createSubmitZcashAddress = (payload: _SubmitZcashAddressPayload) => ({payload, type: submitZcashAddress})
export const createUpdateErrorText = (payload: _UpdateErrorTextPayload) => ({payload, type: updateErrorText})
export const createUpdatePgpPublicKey = (payload: _UpdatePgpPublicKeyPayload) => ({payload, type: updatePgpPublicKey})
export const createUpdatePlatform = (payload: _UpdatePlatformPayload) => ({payload, type: updatePlatform})
export const createUpdateProofStatus = (payload: _UpdateProofStatusPayload) => ({payload, type: updateProofStatus})
export const createUpdateProofText = (payload: _UpdateProofTextPayload) => ({payload, type: updateProofText})
export const createUpdateSigID = (payload: _UpdateSigIDPayload) => ({payload, type: updateSigID})
export const createUpdateUsername = (payload: _UpdateUsernamePayload) => ({payload, type: updateUsername})
export const createUploadAvatar = (payload: _UploadAvatarPayload) => ({payload, type: uploadAvatar})

// Action Payloads
export type AddProofPayload = {|+payload: _AddProofPayload, +type: 'profile:addProof'|}
export type BackToProfilePayload = {|+payload: _BackToProfilePayload, +type: 'profile:backToProfile'|}
export type CancelAddProofPayload = {|+payload: _CancelAddProofPayload, +type: 'profile:cancelAddProof'|}
export type CancelPgpGenPayload = {|+payload: _CancelPgpGenPayload, +type: 'profile:cancelPgpGen'|}
export type CheckProofPayload = {|+payload: _CheckProofPayload, +type: 'profile:checkProof'|}
export type CleanupUsernamePayload = {|+payload: _CleanupUsernamePayload, +type: 'profile:cleanupUsername'|}
export type DropPgpPayload = {|+payload: _DropPgpPayload, +type: 'profile:dropPgp'|}
export type EditAvatarPayload = {|+payload: _EditAvatarPayload, +type: 'profile:editAvatar'|}
export type EditProfilePayload = {|+payload: _EditProfilePayload, +type: 'profile:editProfile'|}
export type FinishRevokingPayload = {|+payload: _FinishRevokingPayload, +type: 'profile:finishRevoking'|}
export type FinishedWithKeyGenPayload = {|+payload: _FinishedWithKeyGenPayload, +type: 'profile:finishedWithKeyGen'|}
export type GeneratePgpPayload = {|+payload: _GeneratePgpPayload, +type: 'profile:generatePgp'|}
export type OnClickAvatarPayload = {|+payload: _OnClickAvatarPayload, +type: 'profile:onClickAvatar'|}
export type OutputInstructionsActionLinkPayload = {|+payload: _OutputInstructionsActionLinkPayload, +type: 'profile:outputInstructionsActionLink'|}
export type RecheckProofPayload = {|+payload: _RecheckProofPayload, +type: 'profile:recheckProof'|}
export type RevokeFinishPayload = {|+payload: _RevokeFinishPayload, +type: 'profile:revokeFinish'|}
export type RevokeFinishPayloadError = {|+error: true, +payload: _RevokeFinishPayloadError, +type: 'profile:revokeFinish'|}
export type ShowUserProfilePayload = {|+payload: _ShowUserProfilePayload, +type: 'profile:showUserProfile'|}
export type SubmitBTCAddressPayload = {|+payload: _SubmitBTCAddressPayload, +type: 'profile:submitBTCAddress'|}
export type SubmitRevokeProofPayload = {|+payload: _SubmitRevokeProofPayload, +type: 'profile:submitRevokeProof'|}
export type SubmitUsernamePayload = {|+payload: _SubmitUsernamePayload, +type: 'profile:submitUsername'|}
export type SubmitZcashAddressPayload = {|+payload: _SubmitZcashAddressPayload, +type: 'profile:submitZcashAddress'|}
export type UpdateErrorTextPayload = {|+payload: _UpdateErrorTextPayload, +type: 'profile:updateErrorText'|}
export type UpdatePgpInfoPayload = {|+payload: _UpdatePgpInfoPayload, +type: 'profile:updatePgpInfo'|}
export type UpdatePgpPublicKeyPayload = {|+payload: _UpdatePgpPublicKeyPayload, +type: 'profile:updatePgpPublicKey'|}
export type UpdatePlatformPayload = {|+payload: _UpdatePlatformPayload, +type: 'profile:updatePlatform'|}
export type UpdateProofStatusPayload = {|+payload: _UpdateProofStatusPayload, +type: 'profile:updateProofStatus'|}
export type UpdateProofTextPayload = {|+payload: _UpdateProofTextPayload, +type: 'profile:updateProofText'|}
export type UpdateSigIDPayload = {|+payload: _UpdateSigIDPayload, +type: 'profile:updateSigID'|}
export type UpdateUsernamePayload = {|+payload: _UpdateUsernamePayload, +type: 'profile:updateUsername'|}
export type UploadAvatarPayload = {|+payload: _UploadAvatarPayload, +type: 'profile:uploadAvatar'|}

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
  | EditAvatarPayload
  | EditProfilePayload
  | FinishRevokingPayload
  | FinishedWithKeyGenPayload
  | GeneratePgpPayload
  | OnClickAvatarPayload
  | OutputInstructionsActionLinkPayload
  | RecheckProofPayload
  | RevokeFinishPayload
  | RevokeFinishPayloadError
  | ShowUserProfilePayload
  | SubmitBTCAddressPayload
  | SubmitRevokeProofPayload
  | SubmitUsernamePayload
  | SubmitZcashAddressPayload
  | UpdateErrorTextPayload
  | UpdatePgpInfoPayload
  | UpdatePgpPublicKeyPayload
  | UpdatePlatformPayload
  | UpdateProofStatusPayload
  | UpdateProofTextPayload
  | UpdateSigIDPayload
  | UpdateUsernamePayload
  | UploadAvatarPayload
  | {type: 'common:resetStore', payload: null}
