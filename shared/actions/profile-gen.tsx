// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
import type * as RPCTypes from '../constants/types/rpc-gen'
import type * as Types from '../constants/types/profile'
import type * as More from '../constants/types/more'

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
export const hideStellar = 'profile:hideStellar'
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
export const wotVouch = 'profile:wotVouch'
export const wotVouchSetError = 'profile:wotVouchSetError'

// Action Creators
/**
 * Update any fields
 */
export const createUpdatePgpInfo = (
  payload: {
    readonly pgpEmail1?: string
    readonly pgpEmail2?: string
    readonly pgpEmail3?: string
    readonly pgpErrorText?: string
    readonly pgpFullName?: string
  } = {}
) => ({payload, type: updatePgpInfo as typeof updatePgpInfo})
export const createAddProof = (payload: {
  readonly platform: string
  readonly reason: 'appLink' | 'profile'
}) => ({payload, type: addProof as typeof addProof})
export const createBackToProfile = (payload?: undefined) => ({
  payload,
  type: backToProfile as typeof backToProfile,
})
export const createCancelAddProof = (payload?: undefined) => ({
  payload,
  type: cancelAddProof as typeof cancelAddProof,
})
export const createCancelPgpGen = (payload?: undefined) => ({
  payload,
  type: cancelPgpGen as typeof cancelPgpGen,
})
export const createCheckProof = (payload?: undefined) => ({payload, type: checkProof as typeof checkProof})
export const createCleanupUsername = (payload?: undefined) => ({
  payload,
  type: cleanupUsername as typeof cleanupUsername,
})
export const createClearPlatformGeneric = (payload?: undefined) => ({
  payload,
  type: clearPlatformGeneric as typeof clearPlatformGeneric,
})
export const createEditAvatar = (payload?: undefined) => ({payload, type: editAvatar as typeof editAvatar})
export const createEditProfile = (payload: {
  readonly bio: string
  readonly fullname: string
  readonly location: string
}) => ({payload, type: editProfile as typeof editProfile})
export const createFinishBlockUser = (payload: {readonly error?: string} = {}) => ({
  payload,
  type: finishBlockUser as typeof finishBlockUser,
})
export const createFinishRevoking = (payload?: undefined) => ({
  payload,
  type: finishRevoking as typeof finishRevoking,
})
export const createFinishedWithKeyGen = (payload: {readonly shouldStoreKeyOnServer: boolean}) => ({
  payload,
  type: finishedWithKeyGen as typeof finishedWithKeyGen,
})
export const createGeneratePgp = (payload?: undefined) => ({payload, type: generatePgp as typeof generatePgp})
export const createHideStellar = (payload: {readonly hidden: boolean}) => ({
  payload,
  type: hideStellar as typeof hideStellar,
})
export const createOnClickAvatar = (payload: {
  readonly username: string
  readonly openWebsite?: boolean
}) => ({payload, type: onClickAvatar as typeof onClickAvatar})
export const createProofParamsReceived = (payload: {readonly params: Types.ProveGenericParams}) => ({
  payload,
  type: proofParamsReceived as typeof proofParamsReceived,
})
export const createRecheckProof = (payload: {readonly sigID: string}) => ({
  payload,
  type: recheckProof as typeof recheckProof,
})
export const createRevokeFinish = (payload: {readonly error?: string} = {}) => ({
  payload,
  type: revokeFinish as typeof revokeFinish,
})
export const createShowUserProfile = (payload: {readonly username: string}) => ({
  payload,
  type: showUserProfile as typeof showUserProfile,
})
export const createSubmitBTCAddress = (payload?: undefined) => ({
  payload,
  type: submitBTCAddress as typeof submitBTCAddress,
})
export const createSubmitBlockUser = (payload: {readonly username: string}) => ({
  payload,
  type: submitBlockUser as typeof submitBlockUser,
})
export const createSubmitRevokeProof = (payload: {readonly proofId: string}) => ({
  payload,
  type: submitRevokeProof as typeof submitRevokeProof,
})
export const createSubmitUnblockUser = (payload: {readonly username: string; readonly guiID: string}) => ({
  payload,
  type: submitUnblockUser as typeof submitUnblockUser,
})
export const createSubmitUsername = (payload?: undefined) => ({
  payload,
  type: submitUsername as typeof submitUsername,
})
export const createSubmitZcashAddress = (payload?: undefined) => ({
  payload,
  type: submitZcashAddress as typeof submitZcashAddress,
})
export const createUpdateErrorText = (payload: {
  readonly errorText: string
  readonly errorCode?: number
}) => ({payload, type: updateErrorText as typeof updateErrorText})
export const createUpdatePgpPublicKey = (payload: {readonly publicKey: string}) => ({
  payload,
  type: updatePgpPublicKey as typeof updatePgpPublicKey,
})
export const createUpdatePlatform = (payload: {readonly platform: More.PlatformsExpandedType}) => ({
  payload,
  type: updatePlatform as typeof updatePlatform,
})
export const createUpdatePlatformGenericChecking = (payload: {readonly checking: boolean}) => ({
  payload,
  type: updatePlatformGenericChecking as typeof updatePlatformGenericChecking,
})
export const createUpdatePlatformGenericURL = (payload: {readonly url: string}) => ({
  payload,
  type: updatePlatformGenericURL as typeof updatePlatformGenericURL,
})
export const createUpdatePromptShouldStoreKeyOnServer = (payload: {
  readonly promptShouldStoreKeyOnServer: boolean
}) => ({payload, type: updatePromptShouldStoreKeyOnServer as typeof updatePromptShouldStoreKeyOnServer})
export const createUpdateProofStatus = (payload: {
  readonly found: boolean
  readonly status: RPCTypes.ProofStatus
}) => ({payload, type: updateProofStatus as typeof updateProofStatus})
export const createUpdateProofText = (payload: {readonly proof: string}) => ({
  payload,
  type: updateProofText as typeof updateProofText,
})
export const createUpdateSigID = (payload: {readonly sigID?: RPCTypes.SigID} = {}) => ({
  payload,
  type: updateSigID as typeof updateSigID,
})
export const createUpdateUsername = (payload: {readonly username: string}) => ({
  payload,
  type: updateUsername as typeof updateUsername,
})
export const createUploadAvatar = (payload: {
  readonly filename: string
  readonly crop?: RPCTypes.ImageCropRect
}) => ({payload, type: uploadAvatar as typeof uploadAvatar})
export const createWotVouch = (payload: {
  readonly username: string
  readonly guiID: string
  readonly verificationType: string
  readonly statement: string
  readonly otherText: string
  readonly proofs: Array<RPCTypes.WotProof>
}) => ({payload, type: wotVouch as typeof wotVouch})
export const createWotVouchSetError = (payload: {readonly error: string}) => ({
  payload,
  type: wotVouchSetError as typeof wotVouchSetError,
})

// Action Payloads
export type AddProofPayload = ReturnType<typeof createAddProof>
export type BackToProfilePayload = ReturnType<typeof createBackToProfile>
export type CancelAddProofPayload = ReturnType<typeof createCancelAddProof>
export type CancelPgpGenPayload = ReturnType<typeof createCancelPgpGen>
export type CheckProofPayload = ReturnType<typeof createCheckProof>
export type CleanupUsernamePayload = ReturnType<typeof createCleanupUsername>
export type ClearPlatformGenericPayload = ReturnType<typeof createClearPlatformGeneric>
export type EditAvatarPayload = ReturnType<typeof createEditAvatar>
export type EditProfilePayload = ReturnType<typeof createEditProfile>
export type FinishBlockUserPayload = ReturnType<typeof createFinishBlockUser>
export type FinishRevokingPayload = ReturnType<typeof createFinishRevoking>
export type FinishedWithKeyGenPayload = ReturnType<typeof createFinishedWithKeyGen>
export type GeneratePgpPayload = ReturnType<typeof createGeneratePgp>
export type HideStellarPayload = ReturnType<typeof createHideStellar>
export type OnClickAvatarPayload = ReturnType<typeof createOnClickAvatar>
export type ProofParamsReceivedPayload = ReturnType<typeof createProofParamsReceived>
export type RecheckProofPayload = ReturnType<typeof createRecheckProof>
export type RevokeFinishPayload = ReturnType<typeof createRevokeFinish>
export type ShowUserProfilePayload = ReturnType<typeof createShowUserProfile>
export type SubmitBTCAddressPayload = ReturnType<typeof createSubmitBTCAddress>
export type SubmitBlockUserPayload = ReturnType<typeof createSubmitBlockUser>
export type SubmitRevokeProofPayload = ReturnType<typeof createSubmitRevokeProof>
export type SubmitUnblockUserPayload = ReturnType<typeof createSubmitUnblockUser>
export type SubmitUsernamePayload = ReturnType<typeof createSubmitUsername>
export type SubmitZcashAddressPayload = ReturnType<typeof createSubmitZcashAddress>
export type UpdateErrorTextPayload = ReturnType<typeof createUpdateErrorText>
export type UpdatePgpInfoPayload = ReturnType<typeof createUpdatePgpInfo>
export type UpdatePgpPublicKeyPayload = ReturnType<typeof createUpdatePgpPublicKey>
export type UpdatePlatformGenericCheckingPayload = ReturnType<typeof createUpdatePlatformGenericChecking>
export type UpdatePlatformGenericURLPayload = ReturnType<typeof createUpdatePlatformGenericURL>
export type UpdatePlatformPayload = ReturnType<typeof createUpdatePlatform>
export type UpdatePromptShouldStoreKeyOnServerPayload = ReturnType<
  typeof createUpdatePromptShouldStoreKeyOnServer
>
export type UpdateProofStatusPayload = ReturnType<typeof createUpdateProofStatus>
export type UpdateProofTextPayload = ReturnType<typeof createUpdateProofText>
export type UpdateSigIDPayload = ReturnType<typeof createUpdateSigID>
export type UpdateUsernamePayload = ReturnType<typeof createUpdateUsername>
export type UploadAvatarPayload = ReturnType<typeof createUploadAvatar>
export type WotVouchPayload = ReturnType<typeof createWotVouch>
export type WotVouchSetErrorPayload = ReturnType<typeof createWotVouchSetError>

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
  | HideStellarPayload
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
  | WotVouchPayload
  | WotVouchSetErrorPayload
  | {readonly type: 'common:resetStore', readonly payload: undefined}
