// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
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
export const clearPlatformGeneric = 'profile:clearPlatformGeneric'
export const editAvatar = 'profile:editAvatar'
export const editProfile = 'profile:editProfile'
export const finishBlockUser = 'profile:finishBlockUser'
export const finishRevoking = 'profile:finishRevoking'
export const finishedWithKeyGen = 'profile:finishedWithKeyGen'
export const generatePgp = 'profile:generatePgp'
export const onClickAvatar = 'profile:onClickAvatar'
export const proofParamsReceived = 'profile:proofParamsReceived'
export const recheckProof = 'profile:recheckProof'
export const revokeFinish = 'profile:revokeFinish'
export const showUserProfile = 'profile:showUserProfile'
export const submitBTCAddress = 'profile:submitBTCAddress'
export const submitBlockUser = 'profile:submitBlockUser'
export const submitRevokeProof = 'profile:submitRevokeProof'
export const submitUnblockUser = 'profile:submitUnblockUser'
export const submitUsername = 'profile:submitUsername'
export const submitZcashAddress = 'profile:submitZcashAddress'
export const updateErrorText = 'profile:updateErrorText'
export const updatePgpInfo = 'profile:updatePgpInfo'
export const updatePgpPublicKey = 'profile:updatePgpPublicKey'
export const updatePlatform = 'profile:updatePlatform'
export const updatePlatformGenericChecking = 'profile:updatePlatformGenericChecking'
export const updatePlatformGenericURL = 'profile:updatePlatformGenericURL'
export const updatePromptShouldStoreKeyOnServer = 'profile:updatePromptShouldStoreKeyOnServer'
export const updateProofStatus = 'profile:updateProofStatus'
export const updateProofText = 'profile:updateProofText'
export const updateSigID = 'profile:updateSigID'
export const updateUsername = 'profile:updateUsername'
export const uploadAvatar = 'profile:uploadAvatar'

// Payload Types
type _AddProofPayload = {readonly platform: string; readonly reason: 'appLink' | 'profile'}
type _BackToProfilePayload = void
type _CancelAddProofPayload = void
type _CancelPgpGenPayload = void
type _CheckProofPayload = void
type _CleanupUsernamePayload = void
type _ClearPlatformGenericPayload = void
type _EditAvatarPayload = void
type _EditProfilePayload = {readonly bio: string; readonly fullname: string; readonly location: string}
type _FinishBlockUserPayload = {readonly error?: string}
type _FinishRevokingPayload = void
type _FinishedWithKeyGenPayload = {readonly shouldStoreKeyOnServer: boolean}
type _GeneratePgpPayload = void
type _OnClickAvatarPayload = {readonly username: string; readonly openWebsite?: boolean}
type _ProofParamsReceivedPayload = {readonly params: Types.ProveGenericParams}
type _RecheckProofPayload = {readonly sigID: string}
type _RevokeFinishPayload = {readonly error?: string}
type _ShowUserProfilePayload = {readonly username: string}
type _SubmitBTCAddressPayload = void
type _SubmitBlockUserPayload = {readonly username: string}
type _SubmitRevokeProofPayload = {readonly proofId: string}
type _SubmitUnblockUserPayload = {readonly username: string; readonly guiID: string}
type _SubmitUsernamePayload = void
type _SubmitZcashAddressPayload = void
type _UpdateErrorTextPayload = {readonly errorText: string; readonly errorCode?: number}
type _UpdatePgpInfoPayload = {
  readonly pgpEmail1?: string
  readonly pgpEmail2?: string
  readonly pgpEmail3?: string
  readonly pgpErrorText?: string
  readonly pgpFullName?: string
}
type _UpdatePgpPublicKeyPayload = {readonly publicKey: string}
type _UpdatePlatformGenericCheckingPayload = {readonly checking: boolean}
type _UpdatePlatformGenericURLPayload = {readonly url: string}
type _UpdatePlatformPayload = {readonly platform: More.PlatformsExpandedType}
type _UpdatePromptShouldStoreKeyOnServerPayload = {readonly promptShouldStoreKeyOnServer: boolean}
type _UpdateProofStatusPayload = {readonly found: boolean; readonly status: RPCTypes.ProofStatus}
type _UpdateProofTextPayload = {readonly proof: string}
type _UpdateSigIDPayload = {readonly sigID?: RPCTypes.SigID}
type _UpdateUsernamePayload = {readonly username: string}
type _UploadAvatarPayload = {readonly filename: string; readonly crop?: RPCTypes.ImageCropRect}

// Action Creators
/**
 * Update any fields
 */
export const createUpdatePgpInfo = (
  payload: _UpdatePgpInfoPayload = Object.freeze({})
): UpdatePgpInfoPayload => ({payload, type: updatePgpInfo})
export const createAddProof = (payload: _AddProofPayload): AddProofPayload => ({payload, type: addProof})
export const createBackToProfile = (payload: _BackToProfilePayload): BackToProfilePayload => ({
  payload,
  type: backToProfile,
})
export const createCancelAddProof = (payload: _CancelAddProofPayload): CancelAddProofPayload => ({
  payload,
  type: cancelAddProof,
})
export const createCancelPgpGen = (payload: _CancelPgpGenPayload): CancelPgpGenPayload => ({
  payload,
  type: cancelPgpGen,
})
export const createCheckProof = (payload: _CheckProofPayload): CheckProofPayload => ({
  payload,
  type: checkProof,
})
export const createCleanupUsername = (payload: _CleanupUsernamePayload): CleanupUsernamePayload => ({
  payload,
  type: cleanupUsername,
})
export const createClearPlatformGeneric = (
  payload: _ClearPlatformGenericPayload
): ClearPlatformGenericPayload => ({payload, type: clearPlatformGeneric})
export const createEditAvatar = (payload: _EditAvatarPayload): EditAvatarPayload => ({
  payload,
  type: editAvatar,
})
export const createEditProfile = (payload: _EditProfilePayload): EditProfilePayload => ({
  payload,
  type: editProfile,
})
export const createFinishBlockUser = (
  payload: _FinishBlockUserPayload = Object.freeze({})
): FinishBlockUserPayload => ({payload, type: finishBlockUser})
export const createFinishRevoking = (payload: _FinishRevokingPayload): FinishRevokingPayload => ({
  payload,
  type: finishRevoking,
})
export const createFinishedWithKeyGen = (payload: _FinishedWithKeyGenPayload): FinishedWithKeyGenPayload => ({
  payload,
  type: finishedWithKeyGen,
})
export const createGeneratePgp = (payload: _GeneratePgpPayload): GeneratePgpPayload => ({
  payload,
  type: generatePgp,
})
export const createOnClickAvatar = (payload: _OnClickAvatarPayload): OnClickAvatarPayload => ({
  payload,
  type: onClickAvatar,
})
export const createProofParamsReceived = (
  payload: _ProofParamsReceivedPayload
): ProofParamsReceivedPayload => ({payload, type: proofParamsReceived})
export const createRecheckProof = (payload: _RecheckProofPayload): RecheckProofPayload => ({
  payload,
  type: recheckProof,
})
export const createRevokeFinish = (
  payload: _RevokeFinishPayload = Object.freeze({})
): RevokeFinishPayload => ({payload, type: revokeFinish})
export const createShowUserProfile = (payload: _ShowUserProfilePayload): ShowUserProfilePayload => ({
  payload,
  type: showUserProfile,
})
export const createSubmitBTCAddress = (payload: _SubmitBTCAddressPayload): SubmitBTCAddressPayload => ({
  payload,
  type: submitBTCAddress,
})
export const createSubmitBlockUser = (payload: _SubmitBlockUserPayload): SubmitBlockUserPayload => ({
  payload,
  type: submitBlockUser,
})
export const createSubmitRevokeProof = (payload: _SubmitRevokeProofPayload): SubmitRevokeProofPayload => ({
  payload,
  type: submitRevokeProof,
})
export const createSubmitUnblockUser = (payload: _SubmitUnblockUserPayload): SubmitUnblockUserPayload => ({
  payload,
  type: submitUnblockUser,
})
export const createSubmitUsername = (payload: _SubmitUsernamePayload): SubmitUsernamePayload => ({
  payload,
  type: submitUsername,
})
export const createSubmitZcashAddress = (payload: _SubmitZcashAddressPayload): SubmitZcashAddressPayload => ({
  payload,
  type: submitZcashAddress,
})
export const createUpdateErrorText = (payload: _UpdateErrorTextPayload): UpdateErrorTextPayload => ({
  payload,
  type: updateErrorText,
})
export const createUpdatePgpPublicKey = (payload: _UpdatePgpPublicKeyPayload): UpdatePgpPublicKeyPayload => ({
  payload,
  type: updatePgpPublicKey,
})
export const createUpdatePlatform = (payload: _UpdatePlatformPayload): UpdatePlatformPayload => ({
  payload,
  type: updatePlatform,
})
export const createUpdatePlatformGenericChecking = (
  payload: _UpdatePlatformGenericCheckingPayload
): UpdatePlatformGenericCheckingPayload => ({payload, type: updatePlatformGenericChecking})
export const createUpdatePlatformGenericURL = (
  payload: _UpdatePlatformGenericURLPayload
): UpdatePlatformGenericURLPayload => ({payload, type: updatePlatformGenericURL})
export const createUpdatePromptShouldStoreKeyOnServer = (
  payload: _UpdatePromptShouldStoreKeyOnServerPayload
): UpdatePromptShouldStoreKeyOnServerPayload => ({payload, type: updatePromptShouldStoreKeyOnServer})
export const createUpdateProofStatus = (payload: _UpdateProofStatusPayload): UpdateProofStatusPayload => ({
  payload,
  type: updateProofStatus,
})
export const createUpdateProofText = (payload: _UpdateProofTextPayload): UpdateProofTextPayload => ({
  payload,
  type: updateProofText,
})
export const createUpdateSigID = (payload: _UpdateSigIDPayload = Object.freeze({})): UpdateSigIDPayload => ({
  payload,
  type: updateSigID,
})
export const createUpdateUsername = (payload: _UpdateUsernamePayload): UpdateUsernamePayload => ({
  payload,
  type: updateUsername,
})
export const createUploadAvatar = (payload: _UploadAvatarPayload): UploadAvatarPayload => ({
  payload,
  type: uploadAvatar,
})

// Action Payloads
export type AddProofPayload = {readonly payload: _AddProofPayload; readonly type: typeof addProof}
export type BackToProfilePayload = {
  readonly payload: _BackToProfilePayload
  readonly type: typeof backToProfile
}
export type CancelAddProofPayload = {
  readonly payload: _CancelAddProofPayload
  readonly type: typeof cancelAddProof
}
export type CancelPgpGenPayload = {readonly payload: _CancelPgpGenPayload; readonly type: typeof cancelPgpGen}
export type CheckProofPayload = {readonly payload: _CheckProofPayload; readonly type: typeof checkProof}
export type CleanupUsernamePayload = {
  readonly payload: _CleanupUsernamePayload
  readonly type: typeof cleanupUsername
}
export type ClearPlatformGenericPayload = {
  readonly payload: _ClearPlatformGenericPayload
  readonly type: typeof clearPlatformGeneric
}
export type EditAvatarPayload = {readonly payload: _EditAvatarPayload; readonly type: typeof editAvatar}
export type EditProfilePayload = {readonly payload: _EditProfilePayload; readonly type: typeof editProfile}
export type FinishBlockUserPayload = {
  readonly payload: _FinishBlockUserPayload
  readonly type: typeof finishBlockUser
}
export type FinishRevokingPayload = {
  readonly payload: _FinishRevokingPayload
  readonly type: typeof finishRevoking
}
export type FinishedWithKeyGenPayload = {
  readonly payload: _FinishedWithKeyGenPayload
  readonly type: typeof finishedWithKeyGen
}
export type GeneratePgpPayload = {readonly payload: _GeneratePgpPayload; readonly type: typeof generatePgp}
export type OnClickAvatarPayload = {
  readonly payload: _OnClickAvatarPayload
  readonly type: typeof onClickAvatar
}
export type ProofParamsReceivedPayload = {
  readonly payload: _ProofParamsReceivedPayload
  readonly type: typeof proofParamsReceived
}
export type RecheckProofPayload = {readonly payload: _RecheckProofPayload; readonly type: typeof recheckProof}
export type RevokeFinishPayload = {readonly payload: _RevokeFinishPayload; readonly type: typeof revokeFinish}
export type ShowUserProfilePayload = {
  readonly payload: _ShowUserProfilePayload
  readonly type: typeof showUserProfile
}
export type SubmitBTCAddressPayload = {
  readonly payload: _SubmitBTCAddressPayload
  readonly type: typeof submitBTCAddress
}
export type SubmitBlockUserPayload = {
  readonly payload: _SubmitBlockUserPayload
  readonly type: typeof submitBlockUser
}
export type SubmitRevokeProofPayload = {
  readonly payload: _SubmitRevokeProofPayload
  readonly type: typeof submitRevokeProof
}
export type SubmitUnblockUserPayload = {
  readonly payload: _SubmitUnblockUserPayload
  readonly type: typeof submitUnblockUser
}
export type SubmitUsernamePayload = {
  readonly payload: _SubmitUsernamePayload
  readonly type: typeof submitUsername
}
export type SubmitZcashAddressPayload = {
  readonly payload: _SubmitZcashAddressPayload
  readonly type: typeof submitZcashAddress
}
export type UpdateErrorTextPayload = {
  readonly payload: _UpdateErrorTextPayload
  readonly type: typeof updateErrorText
}
export type UpdatePgpInfoPayload = {
  readonly payload: _UpdatePgpInfoPayload
  readonly type: typeof updatePgpInfo
}
export type UpdatePgpPublicKeyPayload = {
  readonly payload: _UpdatePgpPublicKeyPayload
  readonly type: typeof updatePgpPublicKey
}
export type UpdatePlatformGenericCheckingPayload = {
  readonly payload: _UpdatePlatformGenericCheckingPayload
  readonly type: typeof updatePlatformGenericChecking
}
export type UpdatePlatformGenericURLPayload = {
  readonly payload: _UpdatePlatformGenericURLPayload
  readonly type: typeof updatePlatformGenericURL
}
export type UpdatePlatformPayload = {
  readonly payload: _UpdatePlatformPayload
  readonly type: typeof updatePlatform
}
export type UpdatePromptShouldStoreKeyOnServerPayload = {
  readonly payload: _UpdatePromptShouldStoreKeyOnServerPayload
  readonly type: typeof updatePromptShouldStoreKeyOnServer
}
export type UpdateProofStatusPayload = {
  readonly payload: _UpdateProofStatusPayload
  readonly type: typeof updateProofStatus
}
export type UpdateProofTextPayload = {
  readonly payload: _UpdateProofTextPayload
  readonly type: typeof updateProofText
}
export type UpdateSigIDPayload = {readonly payload: _UpdateSigIDPayload; readonly type: typeof updateSigID}
export type UpdateUsernamePayload = {
  readonly payload: _UpdateUsernamePayload
  readonly type: typeof updateUsername
}
export type UploadAvatarPayload = {readonly payload: _UploadAvatarPayload; readonly type: typeof uploadAvatar}

// All Actions
// prettier-ignore
export type Actions =
  | AddProofPayload
  | BackToProfilePayload
  | CancelAddProofPayload
  | CancelPgpGenPayload
  | CheckProofPayload
  | CleanupUsernamePayload
  | ClearPlatformGenericPayload
  | EditAvatarPayload
  | EditProfilePayload
  | FinishBlockUserPayload
  | FinishRevokingPayload
  | FinishedWithKeyGenPayload
  | GeneratePgpPayload
  | OnClickAvatarPayload
  | ProofParamsReceivedPayload
  | RecheckProofPayload
  | RevokeFinishPayload
  | ShowUserProfilePayload
  | SubmitBTCAddressPayload
  | SubmitBlockUserPayload
  | SubmitRevokeProofPayload
  | SubmitUnblockUserPayload
  | SubmitUsernamePayload
  | SubmitZcashAddressPayload
  | UpdateErrorTextPayload
  | UpdatePgpInfoPayload
  | UpdatePgpPublicKeyPayload
  | UpdatePlatformGenericCheckingPayload
  | UpdatePlatformGenericURLPayload
  | UpdatePlatformPayload
  | UpdatePromptShouldStoreKeyOnServerPayload
  | UpdateProofStatusPayload
  | UpdateProofTextPayload
  | UpdateSigIDPayload
  | UpdateUsernamePayload
  | UploadAvatarPayload
  | {type: 'common:resetStore', payload: {}}
