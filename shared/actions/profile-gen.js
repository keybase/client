// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier */

import {type ReturnType} from '../constants/types/more'
import * as Constants from '../constants/profile'
import * as RPCTypes from '../constants/types/flow-types'
import * as More from '../constants/types/more'

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
export const createAddProof = (payload: {|platform: More.PlatformsExpandedType|}) => ({error: false, payload, type: addProof})
export const createBackToProfile = () => ({error: false, payload: undefined, type: backToProfile})
export const createCancelAddProof = () => ({error: false, payload: undefined, type: cancelAddProof})
export const createCancelPgpGen = () => ({error: false, payload: undefined, type: cancelPgpGen})
export const createCheckProof = () => ({error: false, payload: undefined, type: checkProof})
export const createCleanupUsername = () => ({error: false, payload: undefined, type: cleanupUsername})
export const createDropPgp = (payload: {|kid: RPCTypes.KID|}) => ({error: false, payload, type: dropPgp})
export const createEditProfile = (payload: {|bio: string, fullName: string, location: string|}) => ({error: false, payload, type: editProfile})
export const createFinishRevoking = () => ({error: false, payload: undefined, type: finishRevoking})
export const createFinishedWithKeyGen = (payload: {|shouldStoreKeyOnServer: boolean|}) => ({error: false, payload, type: finishedWithKeyGen})
export const createGeneratePgp = () => ({error: false, payload: undefined, type: generatePgp})
export const createOnClickAvatar = (payload: {|username: string, openWebsite: ?boolean|}) => ({error: false, payload, type: onClickAvatar})
export const createOnClickFollowers = (payload: {|username: string, openWebsite: ?boolean|}) => ({error: false, payload, type: onClickFollowers})
export const createOnClickFollowing = (payload: {|username: string, openWebsite: ?boolean|}) => ({error: false, payload, type: onClickFollowing})
export const createOutputInstructionsActionLink = () => ({error: false, payload: undefined, type: outputInstructionsActionLink})
export const createRevokeFinish = () => ({error: false, payload: undefined, type: revokeFinish})
export const createRevokeFinishError = (payload: {|error: string|}) => ({error: true, payload, type: revokeFinish})
export const createRevokeWaiting = (payload: {|waiting: boolean|}) => ({error: false, payload, type: revokeWaiting})
export const createShowUserProfile = (payload: {|username: string|}) => ({error: false, payload, type: showUserProfile})
export const createSubmitBTCAddress = () => ({error: false, payload: undefined, type: submitBTCAddress})
export const createSubmitRevokeProof = (payload: {|proofId: string|}) => ({error: false, payload, type: submitRevokeProof})
export const createSubmitUsername = () => ({error: false, payload: undefined, type: submitUsername})
export const createSubmitZcashAddress = () => ({error: false, payload: undefined, type: submitZcashAddress})
export const createUpdateErrorText = (payload: {|errorText: ?string, errorCode: ?number|}) => ({error: false, payload, type: updateErrorText})
export const createUpdatePgpInfo = (payload: {|info: $Shape<Constants.PgpInfo>|}) => ({error: false, payload, type: updatePgpInfo})
export const createUpdatePgpInfoError = (payload: {|error: Constants.PgpInfoError|}) => ({error: true, payload, type: updatePgpInfo})
export const createUpdatePgpPublicKey = (payload: {|publicKey: string|}) => ({error: false, payload, type: updatePgpPublicKey})
export const createUpdatePlatform = (payload: {|platform: More.PlatformsExpandedType|}) => ({error: false, payload, type: updatePlatform})
export const createUpdateProofStatus = (payload: {|found: boolean, status: RPCTypes.ProofStatus|}) => ({error: false, payload, type: updateProofStatus})
export const createUpdateProofText = (payload: {|proof: string|}) => ({error: false, payload, type: updateProofText})
export const createUpdateSigID = (payload: {|sigID: ?RPCTypes.SigID|}) => ({error: false, payload, type: updateSigID})
export const createUpdateUsername = (payload: {|username: string|}) => ({error: false, payload, type: updateUsername})
export const createWaiting = (payload: {|waiting: boolean|}) => ({error: false, payload, type: waiting})

// Action Payloads
export type AddProofPayload = ReturnType<typeof createAddProof>
export type BackToProfilePayload = ReturnType<typeof createBackToProfile>
export type CancelAddProofPayload = ReturnType<typeof createCancelAddProof>
export type CancelPgpGenPayload = ReturnType<typeof createCancelPgpGen>
export type CheckProofPayload = ReturnType<typeof createCheckProof>
export type CleanupUsernamePayload = ReturnType<typeof createCleanupUsername>
export type DropPgpPayload = ReturnType<typeof createDropPgp>
export type EditProfilePayload = ReturnType<typeof createEditProfile>
export type FinishRevokingPayload = ReturnType<typeof createFinishRevoking>
export type FinishedWithKeyGenPayload = ReturnType<typeof createFinishedWithKeyGen>
export type GeneratePgpPayload = ReturnType<typeof createGeneratePgp>
export type OnClickAvatarPayload = ReturnType<typeof createOnClickAvatar>
export type OnClickFollowersPayload = ReturnType<typeof createOnClickFollowers>
export type OnClickFollowingPayload = ReturnType<typeof createOnClickFollowing>
export type OutputInstructionsActionLinkPayload = ReturnType<typeof createOutputInstructionsActionLink>
export type RevokeFinishPayload = ReturnType<typeof createRevokeFinish>
export type RevokeWaitingPayload = ReturnType<typeof createRevokeWaiting>
export type ShowUserProfilePayload = ReturnType<typeof createShowUserProfile>
export type SubmitBTCAddressPayload = ReturnType<typeof createSubmitBTCAddress>
export type SubmitRevokeProofPayload = ReturnType<typeof createSubmitRevokeProof>
export type SubmitUsernamePayload = ReturnType<typeof createSubmitUsername>
export type SubmitZcashAddressPayload = ReturnType<typeof createSubmitZcashAddress>
export type UpdateErrorTextPayload = ReturnType<typeof createUpdateErrorText>
export type UpdatePgpInfoPayload = ReturnType<typeof createUpdatePgpInfo>
export type UpdatePgpPublicKeyPayload = ReturnType<typeof createUpdatePgpPublicKey>
export type UpdatePlatformPayload = ReturnType<typeof createUpdatePlatform>
export type UpdateProofStatusPayload = ReturnType<typeof createUpdateProofStatus>
export type UpdateProofTextPayload = ReturnType<typeof createUpdateProofText>
export type UpdateSigIDPayload = ReturnType<typeof createUpdateSigID>
export type UpdateUsernamePayload = ReturnType<typeof createUpdateUsername>
export type WaitingPayload = ReturnType<typeof createWaiting>

// All Actions
// prettier-ignore
export type Actions =
  | ReturnType<typeof createAddProof>
  | ReturnType<typeof createBackToProfile>
  | ReturnType<typeof createCancelAddProof>
  | ReturnType<typeof createCancelPgpGen>
  | ReturnType<typeof createCheckProof>
  | ReturnType<typeof createCleanupUsername>
  | ReturnType<typeof createDropPgp>
  | ReturnType<typeof createEditProfile>
  | ReturnType<typeof createFinishRevoking>
  | ReturnType<typeof createFinishedWithKeyGen>
  | ReturnType<typeof createGeneratePgp>
  | ReturnType<typeof createOnClickAvatar>
  | ReturnType<typeof createOnClickFollowers>
  | ReturnType<typeof createOnClickFollowing>
  | ReturnType<typeof createOutputInstructionsActionLink>
  | ReturnType<typeof createRevokeFinish>
  | ReturnType<typeof createRevokeFinishError>
  | ReturnType<typeof createRevokeWaiting>
  | ReturnType<typeof createShowUserProfile>
  | ReturnType<typeof createSubmitBTCAddress>
  | ReturnType<typeof createSubmitRevokeProof>
  | ReturnType<typeof createSubmitUsername>
  | ReturnType<typeof createSubmitZcashAddress>
  | ReturnType<typeof createUpdateErrorText>
  | ReturnType<typeof createUpdatePgpInfo>
  | ReturnType<typeof createUpdatePgpInfoError>
  | ReturnType<typeof createUpdatePgpPublicKey>
  | ReturnType<typeof createUpdatePlatform>
  | ReturnType<typeof createUpdateProofStatus>
  | ReturnType<typeof createUpdateProofText>
  | ReturnType<typeof createUpdateSigID>
  | ReturnType<typeof createUpdateUsername>
  | ReturnType<typeof createWaiting>
  | {type: 'common:resetStore', payload: void}
