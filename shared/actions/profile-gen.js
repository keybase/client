// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier */

import * as I from 'immutable'
import * as RPCTypes from '../constants/types/flow-types'
import * as More from '../constants/types/more'
import * as Types from '../constants/types/profile'

// Constants
export const resetStore = 'common:resetStore' // not a part of profile but is handled by every reducer
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
export const waiting = 'profile:waiting'

// Action Creators
export const createAddProof = (payload: {|+platform: More.PlatformsExpandedType|}) => ({error: false, payload, type: addProof})
export const createBackToProfile = () => ({error: false, payload: undefined, type: backToProfile})
export const createCancelAddProof = () => ({error: false, payload: undefined, type: cancelAddProof})
export const createCancelPgpGen = () => ({error: false, payload: undefined, type: cancelPgpGen})
export const createCheckProof = () => ({error: false, payload: undefined, type: checkProof})
export const createCleanupUsername = () => ({error: false, payload: undefined, type: cleanupUsername})
export const createDropPgp = (payload: {|+kid: RPCTypes.KID|}) => ({error: false, payload, type: dropPgp})
export const createEditProfile = (payload: {|+bio: string, +fullname: string, +location: string|}) => ({error: false, payload, type: editProfile})
export const createFinishRevoking = () => ({error: false, payload: undefined, type: finishRevoking})
export const createFinishedWithKeyGen = (payload: {|+shouldStoreKeyOnServer: boolean|}) => ({error: false, payload, type: finishedWithKeyGen})
export const createGeneratePgp = () => ({error: false, payload: undefined, type: generatePgp})
export const createOnClickAvatar = (payload: {|+username: string, +openWebsite?: ?boolean|}) => ({error: false, payload, type: onClickAvatar})
export const createOnClickFollowers = (payload: {|+username: string, +openWebsite?: ?boolean|}) => ({error: false, payload, type: onClickFollowers})
export const createOnClickFollowing = (payload: {|+username: string, +openWebsite?: ?boolean|}) => ({error: false, payload, type: onClickFollowing})
export const createOutputInstructionsActionLink = () => ({error: false, payload: undefined, type: outputInstructionsActionLink})
export const createRevokeFinish = () => ({error: false, payload: undefined, type: revokeFinish})
export const createRevokeFinishError = (payload: {|+error: string|}) => ({error: true, payload, type: revokeFinish})
export const createRevokeWaiting = (payload: {|+waiting: boolean|}) => ({error: false, payload, type: revokeWaiting})
export const createShowUserProfile = (payload: {|+username: string|}) => ({error: false, payload, type: showUserProfile})
export const createSubmitBTCAddress = () => ({error: false, payload: undefined, type: submitBTCAddress})
export const createSubmitRevokeProof = (payload: {|+proofId: string|}) => ({error: false, payload, type: submitRevokeProof})
export const createSubmitUsername = () => ({error: false, payload: undefined, type: submitUsername})
export const createSubmitZcashAddress = () => ({error: false, payload: undefined, type: submitZcashAddress})
export const createUpdateErrorText = (payload: {|+errorText?: ?string, +errorCode?: ?number|}) => ({error: false, payload, type: updateErrorText})
export const createUpdatePgpInfo = (payload: {|+info: $Shape<Types.PgpInfo>|}) => ({error: false, payload, type: updatePgpInfo})
export const createUpdatePgpInfoError = (payload: {|+error: Types.PgpInfoError|}) => ({error: true, payload, type: updatePgpInfo})
export const createUpdatePgpPublicKey = (payload: {|+publicKey: string|}) => ({error: false, payload, type: updatePgpPublicKey})
export const createUpdatePlatform = (payload: {|+platform: More.PlatformsExpandedType|}) => ({error: false, payload, type: updatePlatform})
export const createUpdateProofStatus = (payload: {|+found: boolean, +status: RPCTypes.ProofStatus|}) => ({error: false, payload, type: updateProofStatus})
export const createUpdateProofText = (payload: {|+proof: string|}) => ({error: false, payload, type: updateProofText})
export const createUpdateSigID = (payload: {|+sigID: ?RPCTypes.SigID|}) => ({error: false, payload, type: updateSigID})
export const createUpdateUsername = (payload: {|+username: string|}) => ({error: false, payload, type: updateUsername})
export const createWaiting = (payload: {|+waiting: boolean|}) => ({error: false, payload, type: waiting})

// Action Payloads
export type AddProofPayload = More.ReturnType<typeof createAddProof>
export type BackToProfilePayload = More.ReturnType<typeof createBackToProfile>
export type CancelAddProofPayload = More.ReturnType<typeof createCancelAddProof>
export type CancelPgpGenPayload = More.ReturnType<typeof createCancelPgpGen>
export type CheckProofPayload = More.ReturnType<typeof createCheckProof>
export type CleanupUsernamePayload = More.ReturnType<typeof createCleanupUsername>
export type DropPgpPayload = More.ReturnType<typeof createDropPgp>
export type EditProfilePayload = More.ReturnType<typeof createEditProfile>
export type FinishRevokingPayload = More.ReturnType<typeof createFinishRevoking>
export type FinishedWithKeyGenPayload = More.ReturnType<typeof createFinishedWithKeyGen>
export type GeneratePgpPayload = More.ReturnType<typeof createGeneratePgp>
export type OnClickAvatarPayload = More.ReturnType<typeof createOnClickAvatar>
export type OnClickFollowersPayload = More.ReturnType<typeof createOnClickFollowers>
export type OnClickFollowingPayload = More.ReturnType<typeof createOnClickFollowing>
export type OutputInstructionsActionLinkPayload = More.ReturnType<typeof createOutputInstructionsActionLink>
export type RevokeFinishPayload = More.ReturnType<typeof createRevokeFinish>
export type RevokeWaitingPayload = More.ReturnType<typeof createRevokeWaiting>
export type ShowUserProfilePayload = More.ReturnType<typeof createShowUserProfile>
export type SubmitBTCAddressPayload = More.ReturnType<typeof createSubmitBTCAddress>
export type SubmitRevokeProofPayload = More.ReturnType<typeof createSubmitRevokeProof>
export type SubmitUsernamePayload = More.ReturnType<typeof createSubmitUsername>
export type SubmitZcashAddressPayload = More.ReturnType<typeof createSubmitZcashAddress>
export type UpdateErrorTextPayload = More.ReturnType<typeof createUpdateErrorText>
export type UpdatePgpInfoPayload = More.ReturnType<typeof createUpdatePgpInfo>
export type UpdatePgpPublicKeyPayload = More.ReturnType<typeof createUpdatePgpPublicKey>
export type UpdatePlatformPayload = More.ReturnType<typeof createUpdatePlatform>
export type UpdateProofStatusPayload = More.ReturnType<typeof createUpdateProofStatus>
export type UpdateProofTextPayload = More.ReturnType<typeof createUpdateProofText>
export type UpdateSigIDPayload = More.ReturnType<typeof createUpdateSigID>
export type UpdateUsernamePayload = More.ReturnType<typeof createUpdateUsername>
export type WaitingPayload = More.ReturnType<typeof createWaiting>

// All Actions
// prettier-ignore
export type Actions =
  | More.ReturnType<typeof createAddProof>
  | More.ReturnType<typeof createBackToProfile>
  | More.ReturnType<typeof createCancelAddProof>
  | More.ReturnType<typeof createCancelPgpGen>
  | More.ReturnType<typeof createCheckProof>
  | More.ReturnType<typeof createCleanupUsername>
  | More.ReturnType<typeof createDropPgp>
  | More.ReturnType<typeof createEditProfile>
  | More.ReturnType<typeof createFinishRevoking>
  | More.ReturnType<typeof createFinishedWithKeyGen>
  | More.ReturnType<typeof createGeneratePgp>
  | More.ReturnType<typeof createOnClickAvatar>
  | More.ReturnType<typeof createOnClickFollowers>
  | More.ReturnType<typeof createOnClickFollowing>
  | More.ReturnType<typeof createOutputInstructionsActionLink>
  | More.ReturnType<typeof createRevokeFinish>
  | More.ReturnType<typeof createRevokeFinishError>
  | More.ReturnType<typeof createRevokeWaiting>
  | More.ReturnType<typeof createShowUserProfile>
  | More.ReturnType<typeof createSubmitBTCAddress>
  | More.ReturnType<typeof createSubmitRevokeProof>
  | More.ReturnType<typeof createSubmitUsername>
  | More.ReturnType<typeof createSubmitZcashAddress>
  | More.ReturnType<typeof createUpdateErrorText>
  | More.ReturnType<typeof createUpdatePgpInfo>
  | More.ReturnType<typeof createUpdatePgpInfoError>
  | More.ReturnType<typeof createUpdatePgpPublicKey>
  | More.ReturnType<typeof createUpdatePlatform>
  | More.ReturnType<typeof createUpdateProofStatus>
  | More.ReturnType<typeof createUpdateProofText>
  | More.ReturnType<typeof createUpdateSigID>
  | More.ReturnType<typeof createUpdateUsername>
  | More.ReturnType<typeof createWaiting>
  | {type: 'common:resetStore', payload: void}
